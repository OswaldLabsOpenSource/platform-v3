# Oswald Labs Platform

[![Travis CI](https://img.shields.io/travis/OswaldLabsOpenSource/platform-v3.svg)](https://travis-ci.org/OswaldLabsOpenSource/platform-v3)
[![Uptime](https://img.shields.io/uptimerobot/ratio/m783310179-93cf2fccbc14bf47eb9c6fe1)](https://status.oswaldlabs.com)
![Number of events](https://platform-beta.oswaldlabs.com/v1/public/open-data-badge)
[![Dependencies](https://img.shields.io/david/OswaldLabsOpenSource/platform-v3.svg)](https://github.com/OswaldLabsOpenSource/platform-v3/blob/master/package.json)
[![Powered by Staart](https://img.shields.io/badge/based_on-staart-brightgreen.svg)](https://github.com/o15y/staart)
[![Contributors](https://img.shields.io/github/contributors/OswaldLabsOpenSource/platform-v3.svg)](https://github.com/OswaldLabsOpenSource/platform-v3/graphs/contributors)
[![GitHub](https://img.shields.io/github/license/OswaldLabsOpenSource/platform-v3.svg)](https://github.com/OswaldLabsOpenSource/platform-v3/blob/master/LICENSE)
![Type definitions](https://img.shields.io/badge/types-TypeScript-blue.svg)

**⚠️ BREAKING CHANGES:** This repository contains code for Oswald Labs Platform v3, completely rewritten in TypeScript based on [Staart](https://github.com/o15y/staart). It contains breaking changes from v2 and shouldn't be used in production.

## 👩‍💻 Development

### Caching

There are different types of caching used:
- Redis for JWT invalidation
- AWS S3 for read aloud cache
- [Fraud](https://github.com/AnandChowdhary/fraud) for reading mode cache

Fraud is used because we don't want reading mode data to be cached forever. It's cached in the container and would be deleted as soon as we create a new image or restart the container, which happens often enough.

## 📄 License

- Code: [MIT](https://github.com/o15y/staart/blob/master/LICENSE)
- Logo and assets: Proprietary
