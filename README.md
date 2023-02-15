# i18next-calinga-backend

[![Build Status](https://dev.azure.com/conplementag/Calinga/_apis/build/status/i18next-calinga-backend%20CI%20Build?branchName=master)](https://dev.azure.com/conplementag/Calinga/_build/latest?definitionId=119&branchName=master)
[![NPM](https://img.shields.io/npm/v/i18next-calinga-backend)](https://www.npmjs.com/package/i18next-calinga-backend)

An i18next backend to connect to the Calinga service.

## Getting Started

Installation:

```
npm install i18next-calinga-backend
```

Usage:

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

For use in React or React Native also add the following lines to the init options:

```ts
react: {
    bindI18n: 'loaded';
}
```

Available languages can be accessed at `CalingaBackend.languages` or by addding a handler for `CalingaBackend.onLanguageChanged`.
If `devMode` is set to `true` in `CalingaBackendOptions` this list also contains a language that shows keys (cimode).

Set the `includeDrafts` option to `true` if your project has drafts enabled and you want so to see the pending version of your translations.

For a full integration sample for nodejs including a cache have a look [here](https://github.com/conplementAG/calinga-nodejs-demo).
