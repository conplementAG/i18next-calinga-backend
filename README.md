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
    project: '<YOUR_PROJECT_NAME_HERE>'
    version: 'v1',
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
  bindI18n: 'loaded'
}
```

For a full integration sample for react native including a cache have a look [here](https://github.com/conplementAG/calinga-react-native-demo).
