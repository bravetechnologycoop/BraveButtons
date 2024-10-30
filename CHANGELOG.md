# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Please note that the date associated with a release is the date the code
was committed to the `main` branch. This is not necessarily the date that
the code was deployed.

## [Unreleased]

### Added
- Added `newButton.mst` mustache file for adding new buttons (CU-86dug9udj).
- Added function `renderNewButtonPage` in `dashboard.js` to render the new mustache file (CU-86dug9udj).
- Added validator `validateNewButton` in `dashboard.js` to validate inputs from the form (CU-86dug9udj).
- Added function `submitNewButton` in `dashboard.js` to handle functionality of submitting new buttons (CU-86dug9udj).
- Added function `createButtonFromBrowserForm` in `db.js` to handle inserting new buttons to the database (CU-86dug9udj).
- Added new route for POST function of new button (CU-86dug9udj).
- Added function `getButtonWithDeviceId` in `db.js` for integration testing of add buttons (CU-86dug9udj).
- Added `submitNewButtonTest.js` file wiht integartion tests for adding new buttons (CU-86dug9udj).

### Changed
- Changed header to include `New Button` button (CU-86dug9udj).
- Moved all the post functions up to put it above API routes in `routes.js` (CU-86dug9udj).

## [14.0.0] - 2024-10-22

### Added 

- Added `ClientExtension.js` with class `ClientExtension` to be used in adding and editing clients (CU-86du23zth).
- Added device dashboard page with `locationsDashboard.mst` mustache file (CU-86du23zth).
- Added new CSS for the device dashboard page in `locationsCSSPartial.mst` (CU-86du23zth).
- Added update client page with `updateClient.mst` mustache file (CU-86du23zth).
- Added `renderUpdateClient` function in `dashboard.js` to render the mustache file (CU-86du23zth).
- Added `validateUpdateClient` function in `dashboard.js` to validate the update client form (CU-86du23zth).
- Added `submitUpdateClient` function in `dashboard.js` to submit the update client form (CU-86du23zth).
- Added new client page with `newClient.mst` mustache file.
- Added `renderNewClientPage` function in `dashboard.js` to render the mustache file (CU-86du23zth).
- Added `validateNewClient` function in `dashboard.js` to validate the new client form (CU-86du23zth).
- Added `submitNewClient` function in `dashboard.js` to submit the new client form (CU-86du23zth).
- Added update gateway page with `updateGateway.mst` mustache file (CU-86du23zth).
- Added `renderUpdateGatewayPage` function in `dashboard.js` to render the mustache file (CU-86du23zth).
- Added `validateUpdateGateway` function in `dashboard.js` to validate the update gateway form (CU-86du23zth).
- Added `submitUpdateGateway` function in `dashboard.js` to submit the update gateway form (CU-86du23zth).
- Added new gateway page with `newGateway.mst` mustache file (CU-86du23zth).
- Added `renderNewGatewayPage` function in `dashboard.js` to render the mustache file (CU-86du23zth).
- Added `validateNewGateway` function in `dashboard.js` to validate the new gateway form (CU-86du23zth).
- Added `submitNewGateway` function in `dashboard.js` to submit the new gateway form (CU-86du23zth).
- Added update button page with `updateButton.mst` mustache file (CU-86du23zth).
- Added `renderUpdateButtonPage` function in `dashboard.js` to render the mustache file (CU-86du23zth).
- Added `validateUpdateButton` function in `dashboard.js` to validate the update button form (CU-86du23zth).
- Added `submitUpdateButton` function in `dashboard.js` to submit the update button form (CU-86du23zth).
- Added `buttonFormCSSPartial.mst` that has all the CSS for every form page in the dashboard (CU-86du23zth).
- Added `New Clients` and `New Gateway` buttons to the nav bar (CU-86du23zth).
- Added `Edit Gateway` buttons to the vitals page next to each gateway (CU-86du23zth).
- Added several new routing to route pages into each other in `routes.js` (CU-86du23zth).
- Added function `createClientExtensionFromRow` in `db,js` for new pages (CU-86du23zth).
- Added function `getGatewayWithGatewayId` in `db,js` for new pages (CU-86du23zth).
- Added function `getHistoryOfSessions` in `db,js` for new pages (CU-86du23zth).
- Added function `getButtonWithDeviceId` in `db,js` for new pages (CU-86du23zth).
- Added function `getClientExtensionWithClientId` in `db,js` for new pages (CU-86du23zth).
- Added function `getMostRecentSessionWithDevice` in `db,js` for new pages (CU-86du23zth).
- Added function `updateClient` in `db,js` for new pages (CU-86du23zth).
- Added function `createClientExtension` in `db,js` for new pages (CU-86du23zth).
- Added function `updateClientExtension` in `db,js` for new pages (CU-86du23zth).
- Added function `createGatewayFromBrowserForm` in `db,js` for new pages (CU-86du23zth).
- Added function `updateButton` in `db,js` for new pages (CU-86du23zth).
- Added function `updateGateway` in `db,js` for new pages (CU-86du23zth).

### Changed

- Updated the .env.example and README for Buttons (CU-86duebt59)
- Changed `clientPage.mst` to show all current client buttons instead of all vitals (CU-86du23zth).
- Changed `renderButtonDetailsPage` function in `dashboard.js` to reflect new page changes for the client page (CU-86du23zth).

## [13.12.0] - 2024-09-12

### Added

- Added city, projects to clients_extension (CU-86du6jp33)
- Added migration script to change the default value in the `incident_categories` column to `{"Overdose Event","Safer Use","Conflict Resolution","Test"}` (CU-86du7hv9b)
- Added migration script to insert `organization`, `funder`, and `postal_code` columns into the `clients_extention` table (CU-86du6jp33).
- New REST API routes (still require test cases before further use) (CU-86dugzyzh).

## [13.11.0] - 2024-08-20

### Added

- Added Github Actions file `CI.yml` in `.github/workflows` to run along with Travis CI (CU-86dthadwg).
- Added a button in `clientVitals.mst` and `vitals.mst` to show and hide RSSI and SNR values (CU-86du4cpm8). 

### Changed

- Reworded button connection changes in `common.en.json`, changed wording from 'there has been' to 'there were' (CU-86drtnekh).
- Removed `.travis.yml` file to stop using Travis CI (CU-86dthadwg).
- Changed Build Status badge in the README (CU-86dthadwg).
- Changed README instructions for adding encrypted variables for Travis to instructions for adding secrets in Github Actions (CU-86dthadwg).
- Changed `clientVitals.mst` and `vitals.mst` to have RSSI and SNR values hidden by default (CU-86du4cpm8).

## [13.10.0] - 2024-07-02

### Added

- Added migration script to index the locationId column in the devices table (CU-86dtm6em1).
- Dev deployment steps in the README (CU-86dqu45n1).
- New column in the dashboard that shows signal strength (CU-86dttbgmh).
- Colours (red, green or yellow) for RSSI and SNR values on the dashboard to show connection strength (CU-86dttbgmh).
- Added threshold values for RSSI and SNR values as environment variables (CU-86dttbgmh).

### Changed

- Updated npm package `braces` to fix pull request vulnerability (CU-86dtu06ga). 
- Updated `renderVitalsPage` and `renderClientVitalsPage` in `dashboard.js` to include rssi and snr threshold values (CU-86dttbgmh).
- Updated `renderVitalsPage` and `renderClientVitalsPage` in `dashboard.js` to include rssi and snr threshold logic (CU-86dttbgmh).
- Disabled vitals for buttons with offline gateways (CU-86dtkwpn9).

## [13.9.0] - 2024-06-04

### Added

- Wrote a new migration script 44 to fix the mistake of RSSI and SNR not being in the trigger function in script 42 (CU-86dtk5h8k).
- Configured buttons for RAK7201v2, now version 2 buttons will send out alerts (CU-86dte4ejq).

### Changed

- Postgres configuration to allow separate database names and users, and new environment variable `PG_DATABASE` (CU-86791yyvg).
- Development web server port from 8000 to 8001 in the event that the Sensor and Buttons server are running on the same machine (CU-86791yyvg).

## [13.8.0] - 2024-04-01

### Added

- Database type `device_type_enum`, columns `device_type`, `locationid` to table `devices`, and column `is_resettable` to table `sessions` (CU-86791yyvg).

### Changed

- Database table `buttons` rename to `devices`, and column `button_serial_number` rename to `serial_number` for table `devices` (CU-86791yyvg).
- Database column `button_id` rename to `device_id` for tables `buttons_vitals`, `buttons_vitals_cache`, `sessions` (CU-86791yyvg).
- Various database indexes, constraints, and triggers for consistent naming (CU-86791yyvg).

### Removed

- Database table `notifications` (CU-86791yyvg).

## [13.7.1] - 2024-03-05

### Added

- `VITALS_MINUTES_BETWEEN_HEARTBEAT_CHECKS` environment variable to specify the frequency of vitals heartbeat checks in minutes (CU-86drtj00f).

## [13.7.0] - 2024-02-27

### Changed

- English-French bilingual translations for button status changes (CU-860raw0d7).
- Method of translation for button status changes (CU-860raw0d7).

## [13.6.0] - 2024-02-06

### Removed

- Session model (moved to brave-alert-lib) (CU-86791yyvg).

### Changed

- BraveAlerterConfigurator to reject the RESET state (CU-860r8k57h).
- `num_button_presses` column to be renamed to `number_of_alerts` to match BraveSensor (CU-86791yyvg).
- Button status changes Sentry log to become Twilio text messages (CU-860raw0d7).

## [13.5.0] - 2024-01-04

### Removed

- OneSignal functionality (CU-86dqkmhza).
- OneSignal remnants Alert API Key and Responder Push ID from database and dashboard (CU-86dqkmhza).

## [13.4.0] - 2023-12-14

### Added

- PA route /pa/health to check if database connection is working as expected (CU-86dqkw7ef).

## [13.3.0] - 2023-12-06

### Added

- Translations for the Alert Type in the JSON file for both English and Spanish (CU-86795d2nb).
- Sentry log per client that has a disconnected and/or reconnected button and no disconnected gateways (CU-860raw0d7).
- Integration tests for db.getActiveClients (CU-w9bcb5).
- Unit tests for pa.handleMessageClients (CU-w9bcb5).

### Changed

- PA API routes /pa/aws-device-registration, /pa/buttons-twilio-number to use googleHelpers.paAuthorize instead of clickUpHelpers.clickUpChecker (CU-8679128d6).
- API call /api/message-clients to become the PA API call /pa/message-clients, now authenticating with Google (CU-w9bcb5).
- getAlertTypeDisplayName function to support the 't' translation function (CU-86795d2nb).
- Upgraded `brave-alert-lib` to v11.0.1 (CU-86795d2nb).

## [13.2.0] - 2023-11-23

### Changed

- Body parsing middleware to match BraveSensor (moved from routes.js to server.js).
- Updated production deployment instructions in README.

### Added

- POST /api/message-clients sends a Twilio text message to all active clients (adapted from BraveSensor) (CU-w9bcb5).
- Unit tests for the authorize function in api.js (adapted from BraveSensor) (CU-w9bcb5).
- Integration tests for the /api/message-clients API call (adapted from BraveSensor) (CU-w9bcb5).

### Security

- Upgrade Chai and brave-alert-lib (CU-8678wgn0p).
- Upgrade babel dependencies.

## [13.1.0] - 2023-09-26

### Changed

- Enhanced Buttons DB Migration Process by introducing a dynamic execution of SQL migration Files (CU-8678vk9cj).

## [13.0.0] - 2023-09-14

### Added

- Logging RSSI and SNR values for each RAK Button message (CU-2a7dcrz).

### Removed

- Support for Flic Buttons (Buttons v2) (CU-860rj8dqc).

## [12.0.0] - 2023-07-24

### Changed

- Modified tests to be able to work on faster computers.

### Removed

- Pairing Tool and Raspberry Pi code (CU-860r70drx).

### Security

- Upgrade to Node.js 18.16.1 (CU-860pqat6u).

## [11.0.0] - 2023-04-10

### Changed

- Button add scripts ensure that the serial number is in lower case.
- Broke up the Client, Button, and Gateway `is_active` fields into the component parts: `is_displayed`, `is_sending_alerts`, and `is_sending_vitals` (CU-860q154rh).
- Only display Clients, Buttons, and Gateways in the dashboard if their `is_displayed` is true (CU-860q154rh).
- Only send vitals messages if the relevant `is_sending_vitals` is true (CU-860q154rh).
- Only send Button press alerts if the relevant `is_sending_vitals` is true (CU-860q154rh).

## [10.5.0] - 2023-01-30

### Security

- Updated dependencies (CU-860phzbq5).

## [10.4.0] -2023-12-22

### Changed

- Update AWS libraries (CU-3c6mw16).

### Added

- Spanish messages (CU-38tu7z8).
- Responder Phones as receipients of RAK Gateway disconnection, RAK Gateway reconnection, and RAK Button low battery messages (CU-3bft2mp).

## [10.3.0] - 2022-11-01

### Added

- RAK Button 4 can be used to trigger alerts (CU-2uadjfh).

## [10.2.0] - 2022-08-22

### Changed

- Improve Twilio number purchasing error messages.
- Dashboard to better display active and inactive clients.
- Updated deployment instructions in README.

### Added

- Disconnection/reconnection SMS messages to Heartbeat Phone Numbers for RAK Gateways (CU-208arfp).
- Low battery SMS messages to Heartbeat Phone Numbers for RAK Buttons (CU-208arfp).
- Disconnection/reconnection Sentry messages for RAK Buttons (CU-208arfp).`

## [10.1.0] - 2022-07-25

### Changed

- Upgraded to Node 16 and NodePostgres 8 (CU-28na1ge).
- Allow Twilio numbers to be shared across clients (CU-2fk3y8a).

### Added

- Buttons Vitals cache table of only the most recent heartbeat from each Button (CU-2dm6xaf).
- Gateway Vitals cache table of only the most recent seen timestamp from each Gateway (CU-2dm6xaf).
- Country, Country Subdivision, and Building Type columns to the CSV Export (CU-2c6crcn).

### Removed

- Auto-fresh on Vitals pages.

## [10.0.0] - 2022-07-07

### Changed

- Session schema to better match the desired shared schema.
- Allow multiple Responder Phones per Client (CU-2dm6x2j).

### Added

- Session and Buttons factories.
- Track the responsible Responder Phone for each session (CU-2dm6x2j).
- Responded At column to the CSV export.
- Bilingual English/French messages (CU-2dtutrx).

### Removed

- API endpoint for pressing a Radio Bridge LoRa button (CU-2fk4arw).
- Old `buttons_id` from the Buttons table.

### Fixed

- Race condition for quick responders.

## [9.0.0] - 2022-06-16

### Changed

- If the Last Uplink for a gateway is undefined, return `null` (CU-2dm6j58).

### Removed

- Notes and Fallback Twilio Status (CU-2cc1zuu).

### Fixed

- Text messages sent to the chatbot only interact with the most recent session (CU-q37bbk).

## [8.2.0] - 2022-06-02

### Changed

- Renamed buttons.unit column to buttons.display_name.
- Email address to contact if the clients are having troubles reconnecting their Buttons.
- Updated instructions for sending deployment notifications to Responder phones (CU-2ajy0ec).

### Added

- Endpoints for use by PA (CU-21ghk0x).
- Prepended "Unit " to all buttons in the DB (CU-271q69q).
- Default incident categories.

### Removed

- "Unit" from chatbot text messages (CU-271q69q).

### Security

- Updated dependencies.

## [8.1.0] - 2022-04-12

### Changed

- RAK Buttons 1, 2, and 4 no longer create a Button alert (CU-240e9z3).

## [8.0.0] - 2022-03-03

### Added

- RAK LoRa Gateway status to the Buttons Clients Vitals dashboard pages (CU-1zhg9m7).
- Flic Hub status to the Buttons Clients Vitals dashboard pages.
- Password-protected system-wide Buttons Vitals dashboard page within the Buttons Dashboard.

### Removed

- Heartbeat Dashboard.

### Fixed

- Number of DB connections needed to get the Buttons Vitals (CU-2b97ndm).

## [7.1.0] - 2022-02-10

### Added

- AWS RAK LoRa lambda function and instructions on how to deploy it (CU-1yuq5ju).
- API endpoint for pressing a RAK LoRa button (CU-1xcw5vn).
- API endpoint for RAK LoRa button heartbeats (CU-1v85k0d).
- Dashboard page to display RAK LoRa button heartbeats/battery levels (CU-1v85k0d).

### Changed

- Added missing rows to the `clients` table and started using them.

## [7.0.0] - 2022-01-20

### Added

- Descriptions of the config repo and the pi template files to the README (CU-vf8v9x, CU-vf96g1).
- Additional comments to `heartbeat.py` (CU-vf8v9x).
- Instructions for using the `--limit` flag with `ansible-playbook` (CU-vf96g1).
- Send outage notifications to responder phone along with instructions for power-cycling hubs (CU-vf8x83).
- Send reminders about hub outages (CU-vf8x83).
- Pairing tool can directly buy phone numbers from Twilio (CU-1tdma20).
- API endpoint for pressing a Radio Bridge LoRa button (CU-1v85jry).

### Changed

- `setup_pi.sh` sets the hostname in a more robust way (CU-40tzeq).
- Updated `add_hubs.sh` to include an installation id foreign key (CU-vf8x83).
- No longer required to type the certbot domain during deployment (CU-brhk3t).
- Branching scheme (CU-mn5q4g).
- Renamed `installations` to `clients`.

### Removed

- Usage of deprecated `body-parser` module (CU-13kqxyt).
- Usage of deprecated `moment` module for time-related code.
- IP-specific firewall rules in the server setup script (CU-brhk3t).
- Interactive DB configuration of the initial installation in the server setup script (CU-brhk3t).

### Fixed

- Documentation in `add_hubs.sh` script (CU-faxfbg).

### Security

- Updated dependencies.

## [6.1.0] - 2021-11-29

### Changed

- Improved darkstat parsing to look at all entries, to skip null IP addresses, and convert day(s) to seconds (CU-1k0zhbg).

## [6.0.0] - 2021-11-29

### Added

- Sound effects to push notifications (CU-10xfkhr).
- Additional hub programming instructions to the README (CU-vf96g1).

### Changed

- Allow releaseinfo changes on RPis (CU-1kxmhta).
- `setup_pi.yaml` triggers `apt update` in its own step because ansible's apt doesn't support allowing releaseinfo changes.

### Removed

- Hub modification endpoints (rename, mute, hide) (CU-dgm1bj).

### Security

- Improved cookie/session handling.

## [5.0.0] - 2021-10-18

### Added

- `responder_push_id` to the DB to store the Responder Device's Push Notification ID (CU-10xfkhr).
- `POST /alert/acknowledgeAlertSession` to acknowledge an alert session through the Alert App (CU-10xfkhr).
- `POST /alert/respondToAlertSession` to respond to an alert session through the Alert App (CU-10xfkhr).
- `POST /alert/setIncidentCategory` to set the incident category for an alert session through the Alert App (CU-10xfkhr).
- `GET /alert/activeAlerts` endpoint (CU-10xfkhr).

### Changed

- Updated `ALERT_STATE` to `CHATBOT_STATE`.
- `POST /alert/designatedevice` also logs the given Responder Push ID (CU-10xfkhr).

### Fixed

- No longer updates a session's Responded At time if given an invalid incident category (CU-1ae1j60).

## [4.1.0] - 2021-07-26

### Added

- Mocha debugging configuration for `/server`.
- `GET /alert/historicAlerts` endpoint (CU-hjwfx2).
- `GET /alert/newNotificationsCount` endpoint (CU-hjwcwk).
- Tracking of when sessions are first responded to (CU-hjwfx2).
- Security audit to Travis.

### Changed

- Updated deployment instructions (CU-wb8719).
- `POST /flic_button_press` returns 401 Unauthorized when given an invalid API key (CU-gwxnde).

### Fixed

- Time strings in CSV Export now have the correct hour and minute values (CU-zkkach).

## [4.0.0] - 2021-06-15

### Changed

- logSentry calls appear as messages instead of exceptions (CU-32a5wb).

### Fixed

- Error log for /alert/sms now has the correct route name.
- Setup script for Ubuntu 20.04 (CU-w5g52f).

### Removed

- `POST /` endpoint (CU-fmunf5).

### Security

- Update lodash and hosted-git-info (CU-v36yrt).

## [3.7.0] - 2021-05-21

### Changed

- Updated setup script for Ubuntu 20.04 (CU-dgmug8).

## [3.6.0] - 2021-05-17

### Added

- API Key for installations (CU-hjwazd).

### Changed

- Improved some API error messages.
- `heartbeat.py` extra delay in run loop now depends on run loop duration (CU-mrz5r1).
- `heartbeat.py` now retries the heartbeat HTTP request once before turning off the Flic hub.
- Sentry integration for tracking errors and outages (CU-32a5wb).

## [3.5.1] - 2021-04-19

### Fixed

- Now always gets the most recent unresponded session (CU-tb9pvc).

## [3.5.0] - 2021-04-19

### Added

- Send urgent message on button press if it has been >= 2 minutes since last session update, regardless of if it is a multiple of 5 presses (CU-j6y98q).
- Start new session if "current" session is waiting for reply and it has been >= 2 hours since last update (CU-j6yfct).
- Ability to have multiple fallback phone numbers (CU-pv8hd5).

### Changed

- Renamed `registry` table to `buttons` (CU-p107rc).

## [3.4.0] - 2021-03-29

### Added

- Add CSV button to dashboard (CU-c8htxp).

### Fixed

- Do not serve static files from server (CU-mz0td3).

## [3.3.0] - 2021-03-08

### Added

- Implement linting on Buttons repo (CU-eprhhn).

## Changed

- Use `npm ci` instead of `npm install` in Travis and the deployment scripts (CU-jcwffp).
- Added timestamps to error logs (CU-jcuw85).

## [3.2.0] - 2021-02-01

### Added

- Added wifi link quality monitoring to Brave Hub in heartbeat.py (CU-fmy630).

### Fixed

- Handle all promise rejections in async function (CU-brqahw).

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

[unreleased]: https://github.com/bravetechnologycoop/BraveButtons/compare/v14.0.0...HEAD
[14.0.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v13.12.0...v14.0.0
[13.12.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v13.11.0...v13.12.0
[13.11.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v13.10.0...v13.11.0
[13.10.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v13.9.0...v13.10.0git
[13.9.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v13.8.0...v13.9.0
[13.8.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v13.7.1...v13.8.0
[13.7.1]: https://github.com/bravetechnologycoop/BraveButtons/compare/v13.7.0...v13.7.1
[13.7.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v13.6.0...v13.7.0
[13.6.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v13.5.0...v13.6.0
[13.5.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v13.4.0...v13.5.0
[13.4.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v13.3.0...v13.4.0
[13.3.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v13.2.0...v13.3.0
[13.2.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v13.1.0...v13.2.0
[13.1.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v13.0.0...v13.1.0
[13.0.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v12.0.0...v13.0.0
[12.0.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v11.0.0...v12.0.0
[11.0.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v10.5.0...v11.0.0
[10.5.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v10.4.0...v10.5.0
[10.4.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v10.3.0...v10.4.0
[10.3.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v10.2.0...v10.3.0
[10.2.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v10.1.0...v10.2.0
[10.1.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v10.0.0...v10.1.0
[10.0.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v9.0.0...v10.0.0
[9.0.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v8.2.0...v9.0.0
[8.2.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v8.1.0...v8.2.0
[8.1.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v8.0.0...v8.1.0
[8.0.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v7.1.0...v8.0.0
[7.1.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v7.0.0...v7.1.0
[7.0.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v6.1.0...v7.0.0
[6.1.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v6.0.0...v6.1.0
[6.0.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v5.0.0...v6.0.0
[5.0.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v4.1.0...v5.0.0
[4.1.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v4.0.0...v4.1.0
[4.0.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v3.7.0...v4.0.0
[3.7.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v3.6.0...v3.7.0
[3.6.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v3.5.1...v3.6.0
[3.5.1]: https://github.com/bravetechnologycoop/BraveButtons/compare/v3.5.0...v3.5.1
[3.5.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v3.4.0...v3.5.0
[3.4.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v3.3.0...v3.4.0
[3.3.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v3.2.0...v3.3.0
[3.2.0]: https://github.com/bravetechnologycoop/BraveButtons/compare/v3.1.0...v3.2.0
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
