import { BackendModule, Services, ReadCallback, Resource, InitOptions } from "i18next";
import md5 from "md5";
import axios from "axios";

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
  /**
   * The version of the Calinga project
   */
  version?: string;
  /**
   * The base URL of the Calinga service. Should not be changed.
   */
  serviceBaseUrl?: string;
  /**
   * A cache to store locales that were returned from the Calinga service
   */
  cache?: Cache;
  /**
   * Preshipped translations, similar to i18next's options.resources.
   */
  resources?: Resource;
}

export class CalingaBackend implements BackendModule<CalingaBackendOptions> {
  static type = 'backend';
  type: 'backend';

  services: Services;
  options: CalingaBackendOptions;

  loadPath = 'translations/{{project}}/{{version}}/{{language}}';

  constructor(services: Services, options: CalingaBackendOptions) {
    this.init(services, options);
  }

  public init(services: Services, backendOptions: CalingaBackendOptions) {
    this.services = services;
    this.options = { ...this.getDefaultOptions(), ...backendOptions };
  }

  public create(languages: string[], namespace: string, key: string, fallbackValue: string) {

  }

  public async read(language: string, namespace: string, callback: ReadCallback) {
    const url = this.services.interpolator.interpolate(
      this.options.serviceBaseUrl + this.loadPath,
      {
        language,
        project: namespace,
        version: this.options.version
      },
      language,
      {}
    );

    let data;
    let checkSum = "";

    if (this.options.resources) {
      data = this.options.resources[language][namespace];
    }

    if (this.options.cache) {
      const cachedData = await this.options.cache.read(this.buildKey(namespace, language));

      if (cachedData) {
        checkSum = md5(cachedData);
        data = { ...data, ...JSON.parse(cachedData) };
      }
    }

    try {
      const response = await axios.get(url, { headers: { "If-None-Match": checkSum } });
      if (response.status !== 200) {
        return callback(null, data);
      } else {
        data = { ...data, ...response.data};
        if (this.options.cache) {
          this.options.cache
            .write(this.buildKey(namespace, language), JSON.stringify(response.data))
            .then(() => callback(null, data));
        } else {
          callback(null, data);
        }
      }
    } catch (error) {
      callback(error, null);
    }
  }

  private getDefaultOptions(): CalingaBackendOptions {
    return {
      serviceBaseUrl: 'https://prod.cali.conplement.cloud/api/v1/',
      version: 'v1'
    }
  }

  private buildKey(namespace: string, language: string) {
    return `calinga_translations_${namespace}_${language}`;
  }
}
