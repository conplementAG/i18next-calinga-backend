# i18next-calinga-backend

[![Build Status](https://dev.azure.com/conplementag/Calinga/_apis/build/status/i18next-calinga-backend%20CI%20Build?branchName=master)](https://dev.azure.com/conplementag/Calinga/_build/latest?definitionId=119&branchName=master)
[![NPM](https://img.shields.io/npm/v/i18next-calinga-backend)](https://www.npmjs.com/package/i18next-calinga-backend)

An i18next backend to connect to the Calinga service.

## Getting Started

### Installation

```
npm install i18next-calinga-backend
```

### Usage

```ts
import i18n from 'i18next';
import { CalingaBackend, CalingaBackendOptions } from 'i18next-calinga-backend';

...

const backendOptions: CalingaBackendOptions = {
    organization: '<YOUR_ORGANIZATION_NAME_HERE>',
    team: '<YOUR_TEAM_NAME_HERE>',
    project: '<YOUR_PROJECT_NAME_HERE>',
    apiToken: '<YOUR_PROJECTS_API_TOKEN_HERE>'
    resources: {
        en: {
            default: en
        },
        de: {
            default: de
        }
    }
};

i18n
  .use(CalingaBackend)
  .init({
    backend: backendOptions,
    ...
  });

```

### Usage with React

For use in React or React Native also add the following lines to the init options:

```ts
react: {
    bindI18n: 'loaded';
}
```

### Namespaces

If custom namespaces are used e.g.

```ts
i18next.init({
    ...
    ns:['myNamespace1'],
    ...
  }
```

these namespaces must match project names in calinga and translations will be fetched from there accordingly.

### List of available languages

Available languages can be accessed at `CalingaBackend.languages` or by addding a handler for `CalingaBackend.onLanguageChanged`.
If `devMode` is set to `true` in `CalingaBackendOptions` this list also contains a language that shows keys (cimode).

### Draft translations

Set the `includeDrafts` option to `true` if your project has drafts enabled and you want so to see the pending version of your translations.

### Filtering by keys

If your application only uses a known subset of the keys configured in your Calinga project, set the `keys` option to that list. The backend will then call the Consumer API's filtered endpoint and only fetch translations for those keys. When the option is omitted or set to an empty array, all translations are fetched as before.

```ts
const backendOptions: CalingaBackendOptions = {
    organization: '<YOUR_ORGANIZATION_NAME_HERE>',
    team: '<YOUR_TEAM_NAME_HERE>',
    project: '<YOUR_PROJECT_NAME_HERE>',
    apiToken: '<YOUR_PROJECTS_API_TOKEN_HERE>',
    keys: ['welcome', 'logout', 'errors.notFound']
};
```

The filter applies to every translation request made by the backend (i.e. for every language and namespace loaded by i18next). If none of the requested keys are known to the server, the i18next load callback is invoked with an error.

> **Note:** The `keys` option is intended as a **static, app-wide configuration** — typically a fixed list of keys your application is known to use. If a `cache` is configured, a separate cache slot is created per distinct keys list, so changing the list at runtime works correctly. However, generating a different keys list on every load (e.g. per screen, per user, per request) is **not** a supported use case: the cache effectively becomes useless (every list is a cache miss) and the cache grows unbounded as orphan slots accumulate.

### Example

For a full integration sample for nodejs including a cache have a look [here](https://github.com/conplementAG/calinga-nodejs-demo).
