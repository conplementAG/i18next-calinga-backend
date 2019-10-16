import { BackendModule, Services, ReadCallback, Resource, InitOptions } from "i18next";

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
  version: string;
  /**
   * The base URL of the Calinga service. Should not be changed.
   */
  serviceBaseUrl: string;
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

  public read(language: string, namespace: string, callback: ReadCallback) {
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

    this.ajax(url, this.options, (data, xhr) => {
      if (xhr.status >= 500 && xhr.status < 600) {
        return callback(new Error(`failed loading ${url}`), {}); //{} means retry
      }

      if (xhr.status !== 200) {
        if (this.options.cache) {
          this.options.cache
            .read(this.buildKey(namespace, language))
            .then(cachedData => {
              if (cachedData) {
                return callback(null, JSON.parse(cachedData));
              }
              if (this.options.resources) {
                return callback(null, this.options.resources[language][namespace]);
              }

              return callback(new Error('No fallback resources provided.'), null);
            });
        }
      } else {

        let ret;
        try {
          ret = JSON.parse(data);
        }
        catch (e) {
          return callback(new Error(`failed parsing ${url} to json`), null);
        }

        if (this.options.cache) {
          this.options.cache
            .write(this.buildKey(namespace, language), JSON.stringify(ret))
            .then(() => callback(null, ret));
        }
      }
    });
  }

  private getDefaultOptions(): CalingaBackendOptions {
    return {
      serviceBaseUrl: 'https://prod.cali.conplement.cloud/api/v1/',
      version: 'v1'
    }
  }

  private ajax(url, options, callback, data?) {
    try {
      const x = new (XMLHttpRequest || ActiveXObject)('MSXML2.XMLHTTP.3.0');
      x.open(data ? 'POST' : 'GET', url, 1);
      if (!options.crossDomain) {
        x.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
      }
      if (options.authorize && options.apiKey) {
        x.setRequestHeader('Authorization', options.apiKey);
      }
      if (data || options.setContentTypeJSON) {
        x.setRequestHeader('Content-type', 'application/json');
      }
      x.onreadystatechange = () => {
        if (x.readyState > 3 && callback) {
          callback(x.responseText, x);
        }
      };
      x.send(JSON.stringify(data));
    }
    catch (e) {
      if (window.console) {
        console.log(e);
      }
    }
  }

  private buildKey(namespace: string, language: string) {
    return `calinga_translations_${namespace}_${language}`;
  }
}
