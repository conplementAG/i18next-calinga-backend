import i18next from "i18next";
import { CalingaBackend, CalingaBackendOptions } from "./";
import axios from "axios";
import { mocked } from 'ts-jest/utils'

jest.mock("axios");
const axiosMock = mocked(axios, true);
i18next.init();
let options: CalingaBackendOptions;

describe("read", () => {
  beforeEach(() => {
    options = {};
  })

  describe("service not reachable", () => {
    describe("no cache configured", () => {
      describe("no resources provided", () => {
        it("should return nothing", done => {
          setupService(false);
          const backend = new CalingaBackend(i18next.services, options);

          backend.read("en", "default", (error, data) => {
            expect(data).toBeUndefined();
            done();
          });
        })
      })

      describe("resources provided", () => {
        it("should return translations from resources", done => {
          setupService(false);
          setupResources();
          const backend = new CalingaBackend(i18next.services, options);

          backend.read("en", "default", (error, data) => {
            expect(data).toBeDefined();
            expect(data["origin"]).toBe("from resources");
            done();
          });
        })
      })
    })

    describe("cache configured", () => {
      it("should return translations from cache", done => {
        setupService(false);
        setupResources();
        setupCache();
        const backend = new CalingaBackend(i18next.services, options);

        backend.read("en", "default", (error, data) => {
          expect(data).toBeDefined();
          expect(data["origin"]).toBe("from cache");
          done();
        });
      })
    })
  })

  describe("service reachable", () => {
    it("should return translations from service", done => {
      setupService(true);
      setupCache();
      setupResources();
      const backend = new CalingaBackend(i18next.services, options);

      backend.read("en", "default", (error, data) => {
        expect(data).toBeDefined();
        expect(data["origin"]).toBe("from service");
        done();
      });
    })

    describe("cache configured", () => {
      it("writes response to cache", done => {
        setupService(true);
        setupCache();
        setupResources();
        const backend = new CalingaBackend(i18next.services, options);

        backend.read("en", "default", async (error, data) => {
          const cachedData = await options.cache.read("calinga_translations_default_en")
          expect(JSON.parse(cachedData)["origin"]).toBe("from service");
          done();
        });
      })
    })
  })
});

function setupResources() {
  options.resources = {
    "en": {
      "default": {
        "origin": "from resources"
      }
    }
  };
}

function setupCache() {
  const locale = {
    "origin": "from cache"
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
  }
}

function setupService(available: boolean) {
  if (available) {
    axiosMock.get.mockReturnValue(Promise.resolve({ status: 200, data: {"origin": "from service"}}));
  } else {
    axiosMock.get.mockReturnValue(Promise.resolve({ status: 404 }));
  }
}
