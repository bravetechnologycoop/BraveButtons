# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Please note that the date associated with a release is the date the code
was committed to the `master` branch. This is not necessarily the date that
the code was deployed.

## [Unreleased]
### Added
- Changelog (CU-5wd4g9).
- Environment variables to Travis config (CU-b4m32r).

## [1.4.3] - 2020-08-18
### Added
- Installation instructions to the README.

### Changed
- Replace cron cert renewal with simple weekly restart.
- Update node to v12.18.3 for heartbeat and chatbot.
- Installation script improvements.

### Fixed
- Better fix for darkstat parsing edge case.

### Security
- Upgrade lodash and minimist.

## [1.4.2] - 2020-08-06
### Changed
- Specify Postgres and Node versions for Travis.

### Fixed
- Darkstat parsing edge case.

## [1.4.1] - 2020-07-24
### Added
- Ability to mute heartbeat alerts.

### Security
- Upgrade acorn.

## [1.4.0] - 2020-04-06
### Added
- ESLint for chatbot.
- Ability to hide systems on heartbeat dashboard.
- Script to add buttons in a batch.
- Pairing tool for buttons.
- Installation model for chatbot.
- Installation-specific incident categories.

### Fixed
- Malformed text in chatbot category response.
- Wifi on Raspbian Buster.

### Security
- Patched DoS vulnerability.

## [1.3.0] - 2019-11-15
### Added
- All BraveChatbot code moved from its own repo to the `chatbot` directory.
- Istanbul.js for code coverage.
- Log rotation.
- Alert flag to Sessions table.

### Changed
- Installation script takes `installationName` as a parameter.
- Travis runs both chatbot and pi tests.
- Made setup scripts executable.

### Fixed
- Bug in chatbot cert renewal.

### Security
- `npm audit` fixes.

## [1.2.1-chatbot] - 2019-08-13
### Fixed
- Bug in `sendStaffAlertForSession`.

### Security
- Update Twilio library.

## [1.2-chatbot] - 2019-07-16
### Added
- Everything else chatbot-related.
- New Dashboard that automatically refreshes itself.
- PostgreSQL migration structure.

### Changed
- Use PostgreSQL instead of NeDB.
- Use async/await for DB handling and tests.
- Improve server tests.
- Use real Twilio phone numbers in the tests.
- Date format in log files.
- Increase life of login cookie.

### Fixed
- Concurrency issue.

### Removed
- Global state.
- Old Dashboard.

## [1.0-chatbot] - 2018-12-19
### Added
- Initial chatbot.

## [1.2-pi-heartbeat] - 2019-07-16
### Added
- Travis CI to run automated tests.
- Heartbeat code to regularly ping the Flic Hub and send resulting data to the server.
- Wifi connectivity for the Raspberry Pi.

### Changed
- Specify separate test requirements for pip.
- pi install script uses config file instead of interactive input.

## [1.0-pi-heartbeat] - 2019-01-11
### Added
- Initial pi.

[Unreleased]: https://github.com/bravetechnologycoop/BraveButtons/compare/v1.4.3...HEAD
[1.4.3]: https://github.com/bravetechnologycoop/BraveButtons/compare/v1.4.2...v1.4.3
[1.4.2]: https://github.com/bravetechnologycoop/BraveButtons/compare/v1.4.1...v1.4.2
[1.4.1]: https://github.com/bravetechnologycoop/BraveButtons/compare/v1.4...v1.4.1
[1.4.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v1.3...v1.4
[1.3.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v1.2.1-chatbot...v1.3
[1.2.1-chatbot]: https://github.com/bravetechnologycoop/BraveButtons/compare/v1.2-chatbot...v1.2.1-chatbot
[1.2-chatbot]: https://github.com/bravetechnologycoop/BraveButtons/compare/v1.0-chatbot...v1.2-chatbot
[1.0-chatbot]: https://github.com/bravetechnologycoop/BraveButtons/compare/v1.2-pi-heartbeat...v1.0-chatbot
[1.2-pi-heartbeat]: https://github.com/bravetechnologycoop/BraveButtons/compare/v1.0-pi-heartbeat...v1.2-pi-heartbeat
[1.0-pi-heartbeat]: https://github.com/bravetechnologycoop/BraveButtons/releases/tag/v1.0-pi-heartbeat
