import { BackendModule, Services, ReadCallback, Resource, InitOptions } from 'i18next';
import axios from 'axios';
import { name as packageName, version as packageVersion } from '../package.json';

const clientVersionHeader = { 'Client-Version': `${packageName}/${packageVersion}` };

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

    /**
     * If set, only translations for the given keys will be fetched from the
     * Calinga Consumer API. When omitted or empty, all translations are fetched as before.
     * 
     * One cache entry is generated per key list. Consider this when using many differing key lists.
     */
    keys?: string[];
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
    type: 'backend' = 'backend';

    services!: Services;
    options!: CalingaBackendOptions;

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
        let data: any;
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
                etag = (await this.options.cache.read(this.buildEtagKey(namespace, language))) || '';
                data = { ...data, ...JSON.parse(cachedData) };
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
            const filteredKeys = this.options.keys;
            const requestConfig = {
                validateStatus: (status: number) => status === 200 || status === 304,
                headers: { 'If-None-Match': etag, ...clientVersionHeader },
                params: { includeDrafts: this.options.includeDrafts },
            };
            const response = filteredKeys && filteredKeys.length > 0
                ? await axios.post(url, { keyNames: filteredKeys }, requestConfig)
                : await axios.get(url, requestConfig);
            if (response.status === 200) {
                if (filteredKeys && filteredKeys.length > 0 && (response.data == null || Object.keys(response.data).length === 0)) {
                    throw new Error(`Keys not found for language '${language}' in namespace '${namespace}'`);
                }
                data = { ...data, ...response.data };
                if (this.options.cache) {
                    await this.options.cache.write(this.buildEtagKey(namespace, language), response.headers['etag']);
                    await this.options.cache.write(this.buildKey(namespace, language), JSON.stringify(response.data));
                }
                backendConnector?.loaded(`${language}|${namespace}`, null, data);
            }
            callback(null, data);
        } catch (error) {
            if (data) {
                callback(null, data);
            } else {
                backendConnector?.loaded(`${language}|${namespace}`, error as Error, null);
                this.services.logger.error('load translations failed', error);
                callback(error as Error, null);
            }
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
            '',
            {}
        );
        try {
            axios.get(url, { headers: { ...clientVersionHeader } }).then((response) => {
                if (response.status === 200) {
                    const languages = response.data.map((l: { name: string }) => l.name);
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
        return `calinga_translations_${namespace}_${language}${this.keysSuffix()}`;
    }

    private buildEtagKey(namespace: string, language: string) {
        return `calinga_etag_${namespace}_${language}${this.keysSuffix()}`;
    }

    private keysSuffix(): string {
        const keys = this.options.keys;
        if (!keys || keys.length === 0) {
            return '';
        }
        const sorted = [...keys].sort().join('|');
        let hash = 0;
        for (let i = 0; i < sorted.length; i++) {
            hash = ((hash << 5) - hash) + sorted.charCodeAt(i);
            hash |= 0;
        }
        return `_${(hash >>> 0).toString(36)}`;
    }
}
