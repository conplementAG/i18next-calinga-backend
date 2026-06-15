import i18next from 'i18next';
import { CalingaBackend, CalingaBackendOptions } from './';
import axios from 'axios';

const keyName = 'origin';
const language = 'en';
const namespace = 'default';

const fromResourcesTranslation = 'from resources';
const fromCacheTranslation = 'from cache';
const fromServiceTranslation = 'from service';

jest.mock('axios');
const axiosMock = jest.mocked(axios);
i18next.init();
let options: CalingaBackendOptions;

beforeEach(() => {
    options = {
        organization: 'conplement',
        team: 'Default Team',
        project: 'example',
        serviceBaseUrl: 'https://api.calinga.io/v3/',
    };
    delete (axios.defaults.headers as any)['api-token'];
    CalingaBackend.languages = [];
    (CalingaBackend as any).onLanguagesChanged = undefined;
    axiosMock.get.mockReset();
});

describe('read', () => {
    describe('service not reachable', () => {
        describe('no cache configured', () => {
            describe('no resources provided', () => {
                it('should return nothing', (done) => {
                    setupServiceUnavailable();
                    const backend = new CalingaBackend(i18next.services, options, {});

                    backend.read(language, namespace, (error, data) => {
                        expect(data).toBeUndefined();
                        done();
                    });
                });
            });

            describe('resources provided', () => {
                it('should return translations from resources', (done) => {
                    setupServiceUnavailable();
                    setupResources();
                    const backend = new CalingaBackend(i18next.services, options, {});

                    backend.read(language, namespace, (error, data) => {
                        expect(data).toBeDefined();
                        expect((data as any)[keyName]).toBe(fromResourcesTranslation);
                        done();
                    });
                });
            });
        });

        describe('cache configured', () => {
            it('should return translations from cache', (done) => {
                setupServiceUnavailable();
                setupResources();
                setupCache();
                const backend = new CalingaBackend(i18next.services, options, {});

                backend.read(language, namespace, (error, data) => {
                    expect(data).toBeDefined();
                    expect((data as any)[keyName]).toBe(fromCacheTranslation);
                    done();
                });
            });
        });
    });

    describe('service reachable', () => {
        it('should return translations from service', (done) => {
            setupServiceAvailable();
            const backend = new CalingaBackend(i18next.services, options, {});

            backend.read(language, namespace, (error, data) => {
                expect(data).toBeDefined();
                expect((data as ResourceKey)[keyName]).toBe(fromServiceTranslation);
                done();
            });
        });

        it('notifies backendConnector with service data on 200', (done) => {
            setupServiceAvailable();
            const backendConnectorMock = {
                loaded: (name: string, err: any, data: any) => {
                    expect(data).toMatchObject({ [keyName]: fromServiceTranslation });
                    done();
                },
            };
            const backend = new CalingaBackend(
                { ...i18next.services, backendConnector: backendConnectorMock },
                options,
                {}
            );
            backend.read(language, namespace, () => {});
        });

        it('sends includeDrafts query param when option enabled', (done) => {
            setupServiceAvailable();
            const backend = new CalingaBackend(
                i18next.services,
                { ...options, includeDrafts: true },
                {}
            );

            backend.read(language, namespace, () => {
                const getCall = axiosMock.get.mock.calls.find(
                    ([url]) => !url.endsWith('/languages')
                );
                expect(getCall![1]!.params.includeDrafts).toBe(true);
                done();
            });
        });

        it('does not crash when backendConnector is undefined', (done) => {
            setupServiceAvailable();
            const backend = new CalingaBackend(i18next.services, options, {});

            backend.read(language, namespace, (error, data) => {
                expect(data).toBeDefined();
                expect((data as any)[keyName]).toBe(fromCacheTranslation);
                done();
            });
        });

        describe('cache configured', () => {
            it('writes response to cache', (done) => {
                setupServiceAvailable();
                setupCache();
                const backend = new CalingaBackend(i18next.services, options, {});

                backend.read(language, namespace, async () => {
                    const cachedData = await options.cache!.read('calinga_translations_default_en');
                    expect(JSON.parse(cachedData)[keyName]).toBe(fromServiceTranslation);
                    done();
                });
            });

            it('sends If-None-Match header with cached etag', (done) => {
                setupServiceAvailable();
                setupCacheWithEtag('etag-abc123');
                const backend = new CalingaBackend(i18next.services, options, {});

                backend.read(language, namespace, () => {
                    const getCall = axiosMock.get.mock.calls.find(
                        ([url]) => !url.endsWith('/languages')
                    );
                    expect(getCall![1]!.headers['If-None-Match']).toBe('etag-abc123');
                    done();
                });
            });

            it('does not update cache on 304 response', (done) => {
                setupServiceReturns304();
                setupCache();
                const backend = new CalingaBackend(i18next.services, options, {});

                backend.read(language, namespace, async () => {
                    const cachedData = await options.cache!.read('calinga_translations_default_en');
                    expect(JSON.parse(cachedData)[keyName]).toBe(fromCacheTranslation);
                    done();
                });
            });
        });
    });

    describe('error handling', () => {
        it('falls back to cached data when axios throws', (done) => {
            setupServiceThrows();
            setupCache();
            const backend = new CalingaBackend(i18next.services, options, {});

            backend.read(language, namespace, (error, data) => {
                expect(error).toBeNull();
                expect(data).toBeDefined();
                expect((data as ResourceKey)[keyName]).toBe(fromCacheTranslation);
                done();
            });
        });

        it('calls callback with error when axios throws and no fallback data', (done) => {
            setupServiceThrows();
            const backend = new CalingaBackend(i18next.services, options, {});

            backend.read(language, namespace, (error, data) => {
                expect(error).toBeDefined();
                expect(data).toBeNull();
                done();
            });
        });
    });
});

describe('read with keys filter', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        options = {
            organization: 'conplement',
            team: 'Default Team',
            project: 'example',
            serviceBaseUrl: 'https://api.calinga.io/v3/',
        };
    });

    it('issues POST with keyNames body when keys option is set', (done) => {
        setupServiceAvailableWithFilteredPost();
        options.keys = [keyName];
        const backend = new CalingaBackend(i18next.services, options, {});

        backend.read(language, namespace, (error, data) => {
            expect(error).toBeNull();
            expect((data as any)[keyName]).toBe(fromServiceTranslation);

            const postCalls = axiosMock.post.mock.calls;
            const translationsCall = postCalls.find((c) => (c[0] as string).endsWith(`/languages/${language}`));
            expect(translationsCall).toBeDefined();
            expect(translationsCall![1]).toEqual({ keyNames: [keyName] });

            const translationsGet = axiosMock.get.mock.calls.find((c) =>
                (c[0] as string).endsWith(`/languages/${language}`)
            );
            expect(translationsGet).toBeUndefined();

            done();
        });
    });

    it('writes filtered response to cache', (done) => {
        setupServiceAvailableWithFilteredPost();
        const cache: Record<string, string> = {};
        options.cache = {
            read: (key) => Promise.resolve(cache[key]),
            write: (key, value) => {
                cache[key] = value;
                return Promise.resolve();
            },
        };
        options.keys = [keyName];
        const backend = new CalingaBackend(i18next.services, options, {});

        backend.read(language, namespace, () => {
            const slot = Object.keys(cache).find((k) => k.startsWith('calinga_translations_default_en_'));
            expect(slot).toBeDefined();
            expect(JSON.parse(cache[slot!])[keyName]).toBe(fromServiceTranslation);
            done();
        });
    });

    it('returns an error to the callback when the filtered response is empty', (done) => {
        setupServiceAvailableWithEmptyFilteredPost();
        options.keys = [keyName];
        const loggerErrorMock = jest.fn();
        const services = { ...i18next.services, logger: { ...i18next.services.logger, error: loggerErrorMock } };
        const backend = new CalingaBackend(services as any, options, {});

        backend.read(language, namespace, (error, data) => {
            expect(error).toBeDefined();
            expect(error).not.toBeNull();
            expect((error as Error).message).toMatch(/keys not found/i);
            expect(data).toBeNull();
            expect(loggerErrorMock).toHaveBeenCalled();
            done();
        });
    });

    it('uses a separate cache slot for each distinct keys list', (done) => {
        setupServiceAvailableWithFilteredPost();
        const cache: Record<string, string> = {
            calinga_translations_default_en: JSON.stringify({ [keyName]: fromCacheTranslation }),
        };
        options.cache = {
            read: (key) => Promise.resolve(cache[key]),
            write: (key, value) => {
                cache[key] = value;
                return Promise.resolve();
            },
        };
        options.keys = [keyName];
        const backend = new CalingaBackend(i18next.services, options, {});

        backend.read(language, namespace, (error, data) => {
            expect(error).toBeNull();
            expect((data as any)[keyName]).toBe(fromServiceTranslation);
            expect(cache['calinga_translations_default_en']).toBe(
                JSON.stringify({ [keyName]: fromCacheTranslation })
            );
            const filteredSlots = Object.keys(cache).filter(
                (k) => k.startsWith('calinga_translations_default_en_') && k !== 'calinga_translations_default_en'
            );
            expect(filteredSlots.length).toBe(1);
            done();
        });
    });

    it('falls back to GET when keys option is unset', (done) => {
        setupServiceAvailable();
        const backend = new CalingaBackend(i18next.services, options, {});

        backend.read(language, namespace, () => {
            const translationsPost = axiosMock.post.mock.calls.find((c) =>
                (c[0] as string).endsWith(`/languages/${language}`)
            );
            expect(translationsPost).toBeUndefined();
            done();
        });
    });
});

describe('init', () => {
    describe('devmode enabled', () => {
        it('adds cimode to the languages', (done) => {
            setupServiceAvailable();
            CalingaBackend.onLanguagesChanged = () => {
                expect(CalingaBackend.languages).toContain('cimode');
                expect(CalingaBackend.languages).toContain('en');
                done();
            };
            new CalingaBackend(i18next.services, { ...options, devMode: true }, {});
        });
    });

    describe('devmode not enabled', () => {
        it('returns only languages from service', (done) => {
            setupServiceAvailable();
            CalingaBackend.onLanguagesChanged = () => {
                expect(CalingaBackend.languages).toContain('de');
                expect(CalingaBackend.languages).toContain('en');
                done();
            };
            new CalingaBackend(i18next.services, options, {});
        });
    });

    it('uses default serviceBaseUrl when not provided', (done) => {
        setupServiceAvailable();
        const optionsWithoutUrl: CalingaBackendOptions = { ...options };
        delete optionsWithoutUrl.serviceBaseUrl;
        const backend = new CalingaBackend(i18next.services, optionsWithoutUrl, {});

        backend.read(language, namespace, () => {
            const loadUrl = axiosMock.get.mock.calls
                .map(([u]) => u)
                .find((u) => !u.endsWith('/languages'));
            expect(loadUrl).toMatch(/^https:\/\/api\.calinga\.io\/v3\//);
            done();
        });
    });

    it('uses provided serviceBaseUrl when set', (done) => {
        setupServiceAvailable();
        const backend = new CalingaBackend(
            i18next.services,
            { ...options, serviceBaseUrl: 'https://custom.example.com/' },
            {}
        );

        backend.read(language, namespace, () => {
            const loadUrl = axiosMock.get.mock.calls
                .map(([u]) => u)
                .find((u) => !u.endsWith('/languages'));
            expect(loadUrl!.startsWith('https://custom.example.com/')).toBe(true);
            done();
        });
    });

    it('replaces ns="translation" with project name', () => {
        setupServiceAvailable();
        const i18nOptions: any = { ns: 'translation' };
        new CalingaBackend(i18next.services, options, i18nOptions);
        expect(i18nOptions.ns).toBe('example');
    });

    it('replaces ns=["translation"] with project name', () => {
        setupServiceAvailable();
        const i18nOptions: any = { ns: ['translation'] };
        new CalingaBackend(i18next.services, options, i18nOptions);
        expect(i18nOptions.ns).toBe('example');
    });

    it('replaces defaultNS="translation" with project name', () => {
        setupServiceAvailable();
        const i18nOptions: any = { defaultNS: 'translation' };
        new CalingaBackend(i18next.services, options, i18nOptions);
        expect(i18nOptions.defaultNS).toBe('example');
    });

    it('returns early when services is falsy without throwing', () => {
        expect(() => new CalingaBackend(undefined as any, options, {})).not.toThrow();
    });

    it('leaves custom ns unchanged', () => {
        setupServiceAvailable();
        const i18nOptions: any = { ns: 'myns' };
        new CalingaBackend(i18next.services, options, i18nOptions);
        expect(i18nOptions.ns).toBe('myns');
    });

    it('sets axios api-token header when apiToken provided', () => {
        setupServiceAvailable();
        new CalingaBackend(i18next.services, { ...options, apiToken: 'secret-token' }, {});
        expect((axios.defaults.headers as any)['api-token']).toBe('secret-token');
    });

    it('does not set axios api-token header when apiToken absent', () => {
        setupServiceAvailable();
        new CalingaBackend(i18next.services, options, {});
        expect((axios.defaults.headers as any)['api-token']).toBeUndefined();
    });
});

describe('loadLanguages', () => {
    it('keeps languages empty when service returns non-200', (done) => {
        axiosMock.get.mockResolvedValue({ status: 500 });
        new CalingaBackend(i18next.services, options, {});

        setTimeout(() => {
            expect(CalingaBackend.languages).toEqual([]);
            done();
        }, 50);
    });

    it('does not crash when onLanguagesChanged is not set', (done) => {
        setupServiceAvailable();
        new CalingaBackend(i18next.services, options, {});

        setTimeout(() => {
            expect(CalingaBackend.languages).toContain('en');
            done();
        }, 50);
    });
});

function setupResources() {
    options.resources = {
        [language]: {
            [namespace]: {
                [keyName]: fromResourcesTranslation,
            },
        },
    };
}

function setupCache() {
    const locale = {
        [keyName]: fromCacheTranslation,
    };
    const cache: any = {
        calinga_translations_default_en: JSON.stringify(locale),
    };
    options.cache = {
        read(key: string) {
            return Promise.resolve(cache[key]);
        },
        write(key: string, value: string) {
            cache[key] = value;
            return Promise.resolve();
        },
    };
}

function setupCacheWithEtag(etag: string) {
    const locale = {
        [keyName]: fromCacheTranslation,
    };
    const cache: any = {
        calinga_translations_default_en: JSON.stringify(locale),
        calinga_etag_default_en: etag,
    };
    options.cache = {
        read(key: string) {
            return Promise.resolve(cache[key]);
        },
        write(key: string, value: string) {
            cache[key] = value;
            return Promise.resolve();
        },
    };
}

function setupServiceUnavailable() {
    axiosMock.get.mockReturnValue(Promise.resolve({ status: 404 }));
}

function setupServiceAvailable() {
    axiosMock.get.mockImplementation((url: string, o?: any) => {
        if (url.endsWith('/languages')) {
            return Promise.resolve({
                status: 200,
                data: [
                    { name: 'de', isReference: false },
                    { name: 'en', isReference: true },
                ],
            });
        } else {
            return Promise.resolve({
                status: 200,
                headers: { etag: '123' },
                data: { [keyName]: fromServiceTranslation },
            });
        }
    });
}

function setupServiceReturns304() {
    axiosMock.get.mockImplementation((url, o) => {
        if (url.endsWith('/languages')) {
            return Promise.resolve({
                status: 200,
                data: [
                    { name: 'de', isReference: false },
                    { name: 'en', isReference: true },
                ],
            });
        } else {
            return Promise.resolve({ status: 304 });
        }
    });
}

function setupServiceThrows() {
    axiosMock.get.mockImplementation((url, o) => {
        if (url.endsWith('/languages')) {
            return Promise.resolve({
                status: 200,
                data: [
                    { name: 'de', isReference: false },
                    { name: 'en', isReference: true },
                ],
            });
        } else {
            return Promise.reject(new Error('Network error'));
        }
    });
}

function setupServiceAvailableWithFilteredPost() {
    axiosMock.get.mockImplementation((url) => {
        if (url.endsWith('/languages')) {
            return Promise.resolve({
                status: 200,
                data: [
                    { name: 'de', isReference: false },
                    { name: 'en', isReference: true },
                ],
            });
        }
        return Promise.resolve({ status: 404 });
    });
    axiosMock.post.mockImplementation(() =>
        Promise.resolve({ status: 200, headers: { etag: '123' }, data: { [keyName]: fromServiceTranslation } })
    );
}

function setupServiceAvailableWithEmptyFilteredPost() {
    axiosMock.get.mockImplementation((url) => {
        if (url.endsWith('/languages')) {
            return Promise.resolve({
                status: 200,
                data: [
                    { name: 'de', isReference: false },
                    { name: 'en', isReference: true },
                ],
            });
        }
        return Promise.resolve({ status: 404 });
    });
    axiosMock.post.mockImplementation(() => Promise.resolve({ status: 200, headers: {}, data: {} }));
}
