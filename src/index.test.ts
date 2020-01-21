import i18next from 'i18next';
import { CalingaBackend, CalingaBackendOptions } from './';
import axios from 'axios';
import { mocked } from 'ts-jest/utils';

const keyName = 'origin';
const language = 'en';
const namespace = 'default';

const fromResourcesTranslation = 'from resources';
const fromCacheTranslation = 'from cache';
const fromServiceTranslation = 'from service';

jest.mock('axios');
const axiosMock = mocked(axios, true);
i18next.init();
let options: CalingaBackendOptions;

describe('read', () => {
    beforeEach(() => {
        options = {
            project: 'example',
            serviceBaseUrl: 'https://api.calinga.io/v1/'
        };
    });

    describe('service not reachable', () => {
        describe('no cache configured', () => {
            describe('no resources provided', () => {
                it('should return nothing', done => {
                    setupService(false);
                    const backend = new CalingaBackend(i18next.services, options, {});

                    backend.read(language, namespace, (error, data) => {
                        expect(data).toBeUndefined();
                        done();
                    });
                });
            });

            describe('resources provided', () => {
                it('should return translations from resources', done => {
                    setupService(false);
                    setupResources();
                    const backend = new CalingaBackend(i18next.services, options, {});

                    backend.read(language, namespace, (error, data) => {
                        expect(data).toBeDefined();
                        expect(data[keyName]).toBe(fromResourcesTranslation);
                        done();
                    });
                });
            });
        });

        describe('cache configured', () => {
            it('should return translations from cache', done => {
                setupService(false);
                setupResources();
                setupCache();
                const backend = new CalingaBackend(i18next.services, options, {});

                backend.read(language, namespace, (error, data) => {
                    expect(data).toBeDefined();
                    expect(data[keyName]).toBe(fromCacheTranslation);
                    done();
                });
            });
        });
    });

    describe('service reachable', () => {
        console.log('broken tset');
        it('should return translations from service', done => {
            setupService(true);
            setupCache();
            setupResources();

            const backendConnectorMock = {
                loaded: (name, err, data) => {
                    expect(data).toMatchObject({ [keyName]: fromServiceTranslation });
                    done();
                }
            };

            const backend = new CalingaBackend(
                { ...i18next.services, backendConnector: backendConnectorMock },
                options,
                {}
            );

            backend.read(language, namespace, (error, data) => {
                expect(data).toBeDefined();
                expect(data[keyName]).toBe(fromCacheTranslation);
                done();
            });
        });

        describe('cache configured', () => {
            it('writes response to cache', done => {
                setupService(true);
                setupCache();
                setupResources();
                const backendConnectorMock = {
                    loaded: (name, err, data) => {
                        expect(data).toMatchObject({ [keyName]: fromServiceTranslation });
                        done();
                    }
                };

                const backend = new CalingaBackend(
                    { ...i18next.services, backendConnector: backendConnectorMock },
                    options,
                    {}
                );

                backend.read(language, namespace, async (error, data) => {
                    const cachedData = await options.cache.read('calinga_translations_default_en');
                    expect(JSON.parse(cachedData)[keyName]).toBe(fromCacheTranslation);
                    done();
                });
            });
        });
    });
});

describe('init', () => {
    describe('devmode enabled', () => {
        it('adds cimode to the languages', done => {
            setupService(true);
            CalingaBackend.onLanguagesChanged = l => {
                expect(CalingaBackend.languages).toContain('cimode');
                expect(CalingaBackend.languages).toContain('en');
                done();
            };
            const backend = new CalingaBackend(i18next.services, { ...options, devMode: true }, {});
        });
    });

    describe('devmode not enabled', () => {
        it('returns only languages from service', done => {
            setupService(true);
            CalingaBackend.onLanguagesChanged = l => {
                expect(CalingaBackend.languages).toContain('de');
                expect(CalingaBackend.languages).toContain('en');
                done();
            };
            const backend = new CalingaBackend(i18next.services, options, {});
        });
    });
});

function setupResources() {
    options.resources = {
        [language]: {
            [namespace]: {
                [keyName]: fromResourcesTranslation
            }
        }
    };
}

function setupCache() {
    const locale = {
        [keyName]: fromCacheTranslation
    };
    const cache = {
        calinga_translations_default_en: JSON.stringify(locale)
    };
    options.cache = {
        read(key: string) {
            return Promise.resolve(cache[key]);
        },
        write(key: string, value: string) {
            cache[key] = value;
            return Promise.resolve();
        }
    };
}

function setupService(available: boolean) {
    if (available) {
        axiosMock.get.mockImplementation((url, o) => {
            if (url.startsWith(options.serviceBaseUrl + 'translations')) {
                return Promise.resolve({ status: 200, data: { [keyName]: fromServiceTranslation } });
            } else if (url.startsWith(options.serviceBaseUrl + 'locales')) {
                return Promise.resolve({
                    status: 200,
                    data: [
                        { name: 'de', isReference: false },
                        { name: 'en', isReference: true }
                    ]
                });
            }
        });
    } else {
        axiosMock.get.mockReturnValue(Promise.resolve({ status: 404 }));
    }
}
