# Oswald Labs Platform

|  | Status |
| - | - |
| Build | [![Travis CI](https://img.shields.io/travis/OswaldLabsOpenSource/platform-v3?label=Travis%20CI)](https://travis-ci.org/OswaldLabsOpenSource/platform-v3) [![Circle CI](https://img.shields.io/circleci/build/github/OswaldLabsOpenSource/platform-v3?label=Circle%20CI)](https://circleci.com/gh/OswaldLabsOpenSource/platform-v3) [![Azure Pipelines](https://dev.azure.com/anandchowdhary0001/Oswald%20Labs%20Platform/_apis/build/status/OswaldLabsOpenSource.platform-v3?branchName=master)](https://dev.azure.com/anandchowdhary0001/Oswald%20Labs%20Platform/_build/latest?definitionId=7&branchName=master) |
| Dependencies | [![Dependencies](https://img.shields.io/david/OswaldLabsOpenSource/platform-v3.svg)](https://david-dm.org/OswaldLabsOpenSource/platform-v3) [![Dev dependencies](https://img.shields.io/david/dev/OswaldLabsOpenSource/platform-v3.svg)](https://david-dm.org/OswaldLabsOpenSource/platform-v3) ![Vulnerabilities](https://img.shields.io/snyk/vulnerabilities/github/OswaldLabsOpenSource/platform-v3.svg) |
| Community | [![Contributors](https://img.shields.io/github/contributors/OswaldLabsOpenSource/platform-v3.svg)](https://github.com/OswaldLabsOpenSource/platform-v3/graphs/contributors) [![GitHub](https://img.shields.io/github/license/OswaldLabsOpenSource/platform-v3.svg)](https://github.com/OswaldLabsOpenSource/platform-v3/blob/master/LICENSE) [![Powered by Staart](https://img.shields.io/badge/based_on-staart-brightgreen.svg)](https://github.com/o15y/staart) ![Type definitions](https://img.shields.io/badge/types-TypeScript-blue.svg) |

**⚠️ BREAKING CHANGES:** This repository contains code for Oswald Labs Platform v3, completely rewritten in TypeScript based on [Staart](https://github.com/o15y/staart). It contains breaking changes from v2 and shouldn't be used in production.

## 👩‍💻 Development

### Caching

There are different types of caching used:
- Redis for JWT invalidation
- AWS S3 for read aloud cache
- [Fraud](https://github.com/AnandChowdhary/fraud) for reading mode cache

Fraud is used because we don't want reading mode data to be cached forever. It's cached in the container and would be deleted as soon as we create a new image or restart the container, which happens often enough.

## 📄 License

- Code: [MIT](https://github.com/OswaldLabsOpenSource/platform-v3/blob/master/LICENSE)
- Logo and assets: Proprietary
