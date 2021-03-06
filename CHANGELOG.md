# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Please note that the date associated with a release is the date the code
was committed to the `master` branch. This is not necessarily the date that
the code was deployed.

## [Unreleased]
### Added
- Added wifi link quality monitoring to Brave Hub in heartbeat.py (CU-fmy630).

### Security
- Update Twilio references in order to get the latest version of axios (CU-j6yuzk).

## [3.1.0] - 2021-01-04
### Added
- Added landing page for chatbot dashboard so page will load when there are no installations selected or present (CU-gurbtf).
- Added Battery Level to sessions table and dashboard display (CU-fgyh0g).

### Changed
- Update to use brave-alert-lib v2.1.0 which includes Twilio validation (CU-dgmfbv).

## [3.0.0] - 2020-12-07
### Added
- `pi_setup.sh` and the associated template files now support network over PoE (CU-gcuhbk).
- Added is_active field to conditionally display only active installations in dashboard (CU-fwpya5).
- Log API key validity for `/flic_button_press` (CU-gwxnde).

### Changed
- Use the Brave Alert Library for the text message flow (CU-bar0fm).

### Fixed
- All installations now displayed in dropdown on dashboard, and page is responsive (CU-fmudrh).
- Built in documentation in `add_buttons.csv.example` and `add_installation.sh` (CU-f8w261).

## [2.1.0] - 2020-11-12
### Changed
- The time between the initial text message and the reminder is now 2 minutes (CU-eanm0j).
- Allow calls to `POST /flic_button_press` without the `button-battery-level` header (CU-f0w9qm).

### Fixed
- Double click handling (CU-f0w9qm).
- Button press counting for POST requests to '/' to workaround a MS Flow bug (CU-f0w9qm).
- Sent urgent text messages at the same frequency whether from '/' or '/flic_button_press' (CU-f0w9qm).

## [2.0.0] - 2020-10-29
### Added
- Deployment instructions in the README file (CU-d8rfw8).
- Unhide endpoint for the heartbeat (CU-bgke33).
- Heartbeat text message alert when the Last Seen (Ping) value is above a threshold (CU-crut3u).
- Automatic linting using Travis for the Server and the Pairing Tool (CU-cchv7x).
- Battery level logging for flic buttons that send requests using the 'Internet Request' action (CU-e4nkb0).
- Power over Ethernet support in pi_config.ini and setup_pi.sh (CU-erwdt4).
- Shell script for adding new hubs to database.

### Changed
- Merged heartbeat and chatbot functionality into a single application (CU-bgke33).
- Heartbeat text message alert now further details what triggered the alert (CU-crut3u).
- Increased alert message threshold for Heartbeat and Flic (Darkstat) (CU-70bdx5).
- In setup_pi.yaml, Ansible now updates the comment on the remote access authorized_keys file.

## [1.6.0] - 2020-10-05
### Added
- Column definitions to the Heartbeat Dashboard (CU-bgjqh5).
- Ansible playbooks for RPi setup and deployment of updates (CU-5jcgu2 and CU-5jcgvh).

### Changed
- db.js now loads different environment variables depending on NODE_ENV test flag (CU-byp1m3).
- Increased wait time in fallback message test to address race condition and reduce test flakiness (CU-3j6jj7).
- setup_pi.sh only echoes SSH public key and blocks if the SSH key does not exist
- setup_pi.sh no longer reboots the RPi

### Security
- Upgrade handlebars (CU-c6rgqh).
- Upgrade yargs-parser (CU-c6rgqh).

## [1.5.0] - 2020-09-04
### Added
- Changelog (CU-5wd4g9).
- Environment variables to Travis config (CU-b4m32r).
- More logging to the Raspberry Pi (CU-behg93).
- Instructions for interacting with remote managed database to README.
- Instructions for performing database migrations to README.
- `POST /unmute_system` API endpoint for the Heartbeat server (CU-baj2pv).

### Changed
- "From" phone number used to send messages to the fallback phone is specified in `.env` (CU-6ed85y).
- Local version of database setup script for use in TravisCI and local dev
- db.js file now creates pool with remote database parameters
- Heartbeat Dashboard displays whether a hub is muted or not (CU-baj2pv).

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

[Unreleased]: https://github.com/bravetechnologycoop/BraveButtons/compare/v3.1.0...HEAD
[3.1.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v3.0.0...v3.1.0
[3.0.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v2.1.0...v3.0.0
[2.1.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v1.6.0...v2.0.0
[1.6.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v1.4.3...v1.5.0
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
