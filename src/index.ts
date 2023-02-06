import { BackendModule, Services, ReadCallback, Resource, InitOptions } from 'i18next';
import axios from 'axios';

export interface Cache {
    /**
     * Reads a locale from cache.
     * @param {string} key - the key which was used to save the locale in the cache.
     * @returns {Promise<string>} - A Promise that when resolved, returns the json serialized locale.
     */
    read(key: string): Promise<string>;

    /**
     * Writes a locale from cache.
     * @param {string} key - the key which will be used to save the locale in the cache.
     * @param {string} value - The json serialized locale.
     * @returns {Promise<string>} - A Promise that when resolved, indicates that the locale was stored.
     */
    write(key: string, value: string): Promise<void>;
}

export interface CalingaBackendOptions {
    /*
     * The name of the calinga organization
     */
    organization: string;
    /*
     * The name of the calinga team
     */
    team: string;
    /*
     * The name of the calinga project
     */
    project: string;
    /*
     * The base URL of the Calinga service. Should not be changed.
     */
    serviceBaseUrl?: string;
    /*
     * A cache to store locales that were returned from the Calinga service
     */
    cache?: Cache;
    /*
     * Preshipped translations, similar to i18next's options.resources.
     */
    resources?: Resource;

    /*
     * Adds a development language if set to 'true'
     */
    devMode?: boolean;

    /**
     * Fetch draft translations if available
     */
    includeDrafts?: boolean;

    /**
     * API Token for the Project if required
     */
    apiToken?: string;
}

function isI18NextDefaultNamespace(optionValue: any) {
    return (
        optionValue === 'translation' ||
        (Object.prototype.toString.call(optionValue) === '[object Array]' &&
            optionValue.length === 1 &&
            optionValue[0] === 'translation')
    );
}

function setApiToken(token: string)
{
    axios.defaults.headers['api-token'] = token;
}

export class CalingaBackend implements BackendModule<CalingaBackendOptions> {
    static type = 'backend';
    type: 'backend';

    services: Services;
    options: CalingaBackendOptions;

    loadPath = '{{organization}}/{{team}}/{{project}}/languages/{{language}}';
    localesPath = '{{organization}}/{{team}}/{{project}}/languages';

    static languages: string[];
    static onLanguagesChanged: (languages: string[]) => void;

    constructor(services: Services, backendOptions: CalingaBackendOptions, options: InitOptions) {
        this.init(services, backendOptions, options);
    }

    public init(services: Services, backendOptions: CalingaBackendOptions, options: InitOptions) {
        if (!services) {
            return;
        }

        this.services = services;
        this.options = { ...this.getDefaultOptions(), ...backendOptions };

        if (backendOptions) {
            if (isI18NextDefaultNamespace(options.ns)) {
                options.ns = backendOptions.project;
            }
            if (isI18NextDefaultNamespace(options.defaultNS)) {
                options.defaultNS = backendOptions.project;
            }
        }

        if(backendOptions.apiToken){
            setApiToken(backendOptions.apiToken);
        }

        if (this.services) {
            this.loadLanguages();
        }
    }

    public create(languages: string[], namespace: string, key: string, fallbackValue: string) {}

    public async read(language: string, namespace: string, callback: ReadCallback) {
        let data;
        let etag = '';

        if (this.options.resources) {
            const languageResources = this.options.resources[language];
            if (languageResources) {
                data = languageResources[namespace];
            }
        }

        if (this.options.cache) {
            const cachedData = await this.options.cache.read(this.buildKey(namespace, language));

            if (cachedData) {
                etag = await this.options.cache.read(this.buildEtagKey(namespace, language));
                data = { ...data, ...JSON.parse(cachedData) };
                callback(null, data)
                return;
            }
        }

        const backendConnector = this.services.backendConnector;
        const url = this.services.interpolator.interpolate(
            this.options.serviceBaseUrl + this.loadPath,
            {
                language,
                project: namespace,
                organization: this.options.organization,
                team: this.options.team,
            },
            language,
            {}
        );

        try {
            const response = await axios.get(url, {
                validateStatus: (status) => status === 200 || status === 304,
                headers: { 'If-None-Match': etag },
                params: { includeDrafts: this.options.includeDrafts },
            });
            if (response.status === 200) {
                data = { ...data, ...response.data };
                if (this.options.cache) {
                    await this.options.cache.write(this.buildEtagKey(namespace, language), response.headers['etag']);
                    await this.options.cache.write(this.buildKey(namespace, language), JSON.stringify(response.data));
                }
                backendConnector?.loaded(`${language}|${namespace}`, null, data);
            }
            callback(null, data);
        } catch (error) {
            backendConnector?.loaded(`${language}|${namespace}`, error, null);
            callback(error, null);
            this.services.logger.error('load translations failed', error);
        }
    }

    private loadLanguages() {
        if (this.options.devMode) {
            CalingaBackend.languages = ['cimode'];
        } else {
            CalingaBackend.languages = [];
        }

        const url = this.services.interpolator.interpolate(
            this.options.serviceBaseUrl + this.localesPath,
            {
                project: this.options.project,
                organization: this.options.organization,
                team: this.options.team,
            },
            undefined,
            {}
        );
        try {
            axios.get(url).then((response) => {
                if (response.status === 200) {
                    const languages = response.data.map((l) => l.name);
                    if (this.options.devMode) {
                        languages.push('cimode');
                    }
                    CalingaBackend.languages = languages;
                    if (CalingaBackend.onLanguagesChanged) {
                        CalingaBackend.onLanguagesChanged(languages);
                    }
                }
            });
        } catch (error) {
            this.services.logger.error('load languages failed', error);
        }
    }

    private getDefaultOptions(): Partial<CalingaBackendOptions> {
        return {
            serviceBaseUrl: 'https://api.calinga.io/v3/',
        };
    }

    private buildKey(namespace: string, language: string) {
        return `calinga_translations_${namespace}_${language}`;
    }

    private buildEtagKey(namespace: string, language: string) {
        return `calinga_etag_${namespace}_${language}`;
    }
}
