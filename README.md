# BraveButtons [![Build Status](https://app.travis-ci.com/bravetechnologycoop/BraveButtons.svg?branch=main)](https://app.travis-ci.com/bravetechnologycoop/BraveButtons)

# How to release a new production version & update the entire Button system (server and RPi fleet)

The following instructions apply if you are deploying a new version of the code, optionally including
updates to the config repo and/or changes to the config repo schema. If you are only deploying changes
to the config repo that do not change the schema (eg. adding a new hub, or changing a WiFi password)
then it is not necessary to create a new numbered version. In this case you can skip step 1 and skip
making a new tag during step 2. This is essentially redeploying an older version with new config.

1. check the deployment ClickUp Task for any comments or SubTasks that could affect these deployment steps.

1. on your local machine, in the `BraveButtons` repository:

   1. pull the latest code ready for release: `git checkout main && git pull origin main`

   1. decide on an appropriate version number for the new version

   1. update CHANGELOG.md by moving everything in `Unreleased` to a section for the new version

   1. make a new commit directly on `main` which only updates the changelog

   1. tag the new commit - for example, if the version number is v1.0.0, use `git tag v1.0.0`

   1. push the new version to GitHub: `git push origin main --tags`

   1. update the `production` branch: `git checkout production && git merge main && git push origin production`

1. on your local machine, in the `BraveButtonsConfig` repository:

   1. ensure you have the latest version of the code: `git pull origin main`

   1. tag the latest commit with the same version number used above, ie. `git tag v1.0.0`

   1. update the `production` branch: `git checkout production && git merge main && git push origin production --tags`

1. send a message to the `#buttons-aa-general` Slack channel letting everyone know that you are doing a deployment and to expect some downtime.

1. send a text message to all of the Responder phones letting them know that you are doing some routine maintenance, there will be downtime, and that you will notify them when everything is back to normal again.

   1. verify that all the active Buttons clients are in the the Twilio Studio Flow "Buttons deployment started notification". Make any necessary updates and Publish

   1. use the Flow by hitting the designated `POST` endpoint with

      - Basic auth username = Twilio account SID
      - Basic auth password = Twilio auth token
      - form-data Body
        - To: The phone number to send the final confirmation text to (i.e. your phone number)
        - From: Any number in the format +12223334444 (we don't use this number for anything, but Twilio will complain if it's missing or incorrectly formatted)

1. on the production Buttons server (access using ssh):

   1. cd into the `BraveButtons/server` directory

   1. shut down the server process and ensure that environment variables are not cached: `pm2 kill`

1. on the production remote access server (access using ssh):

   1. update the code: `cd ~/BraveButtons && git checkout production && git pull origin production`

   1. update the config: `cd ~/BraveButtonsConfig && git checkout production && git pull origin production`

   1. run the following command:

      ```
      ansible-playbook -i ~/BraveButtonsConfig/ansible/inventory-prod.yaml ~/BraveButtons/ops/update_pi_fleet.yaml --ask-vault-pass
      ```

   Optionally, you can deploy to a subset of the fleet by adding `--limit <host or group name from inventory file>` to the `ansible-playbook` command.

1. back on the production Buttons server (access using ssh):

   1. pull the latest production code: `git checkout production && git pull origin production`

   1. run the server setup script: `sudo ./setup_server.sh ./.env`

1. open the chatbot and heartbeat dashboards and confirm that everything appears to be working normally

1. the Twilio Studio Flow "Buttons deployment completed notification"

1. send a text message to all of the Responder phones letting them know that everything is back to normal

   1. verify that all the active Buttons clients are in the the Twilio Studio Flow "Buttons deployment completed notification". Make any necessary updates and Publish

   1. use the Flow by hitting the designated `POST` endpoint with

      - Basic auth username = Twilio account SID
      - Basic auth password = Twilio auth token
      - form-data Body
        - To: The phone number to send the final confirmation text to (i.e. your phone number)
        - From: Any number in the format +12223334444 (we don't use this number for anything, but Twilio will complain if it's missing or incorrectly formatted)

1. send a message to the `#buttons-aa-general` Slack channel letting everyone know that the deployment is finished and list the changes in this deployment from the `CHANGELOG`

# How to deploy a new version of the Lambda function

1. cd into the `lambda` directory

1. run `./setup_lambda.sh`

1. login to the AWS account for the envrionment where you want to deploy the version

1. navigate to Lambda --> Functions

1. click on 'lora-parse'

1. click on 'Upload from' --> .zip file

1. upload the newly generated file `lambda/buttons_lambda.zip`

# How to set up a local server dev environment

1. clone this repository

1. cd into the `server` directory

1. run `sudo apt install postgresql` to install postgres

1. in `/etc/postgresql/<VERSION>/main/pg_hba.conf` change `local ... all ... all ... peer` to `local ... all ... all ... md5`

1. copy `.env.example` to `.env` and fill out variables appropriately for your local environment

1. run `source .env`

1. run `sudo PG_PORT=$PG_PORT PG_USER=$PG_USER PG_PASSWORD=$PG_PASSWORD PG_HOST=$PG_HOST ./setup_postgresql_local_dev.sh`

1. to check that everything is working, run `npm test` and check that the tests pass.

1. to run the server locally and see the dashboard, run `NODE_ENV=test node server.js` and browse to `localhost:8000`

# How to run the linter

1. cd into the `server` directory or the `pairing-tool` directory, depending
   on which you want to lint

1. run `npm install`

1. run `npm run lint`

# Description of the template files in `./pi/templates`

Each of the files in `./pi/templates` is a template for a system configuration file on the RPi.
These templates are read by `setup_pi.sh`, modified if needed using values from `pi_config.ini`, and copied to the appropriate location in the file system.

Information about many of these config files can be found in the ARP proxy documentation here: https://wiki.debian.org/BridgeNetworkConnectionsProxyArp

In all of these template files, strings that LOOK_LIKE_THIS will get replaced with values from `pi_config.ini` during the execution of the setup script.

- **autossh_systemd_unit_file.txt** allows systemd to robustly run autossh as a background process. autossh provides our SSH access to the hubs via the remote access server.

- **avahi_daemon.txt** is a configuration file for avahi-daemon, used to enable mDNS relaying (see the documentation linked above).

- **darkstat_init.txt** is a configuration file which enables darkstat, sets the interface for it to listen on, and sets the port that the darkstat admin interface is served on.

- **dhcp_helper.txt** is the configuration file for dhcp-helper, which allows DHCP to work over the network bridge that we create.

- **heartbeat_systemd_unit_file.txt** allows systemd to robustly run our `heartbeat.py` script as a background process.

- **interfaces.txt** is a template file for `/etc/network/interfaces`, the main system file for configuring networking interfaces (eg. the built in ethernet port).

- **wpa_supplicant.txt** is a template file for `/etc/wpa_supplicant/wpa_supplicant.conf`, the main system file for configuring wireless internet access (ie. WiFi).

# How to set up a generic Raspberry Pi environment (for a development environment Brave Hub or the pairing tool):

1. use either Balena Etcher or Raspberry Pi Imager to flash the SD card with Raspbian Buster (Lite)

1. create a file named `ssh` in the boot partition of the SD card

1. install the SD card into the raspberry pi, connect it to power and ethernet

1. plug the RPi into a router that you have admin access to and determine its IP address

1. ssh into the raspberry pi

1. install git: `sudo apt install git`

1. clone this repository.

1. check out the latest production version `git checkout production && git pull origin production`

# How to configure new Buttons

1. create a Button Config CSV

   1. option 1: Use the Pairing Tool (recommended when pairing a lot of Buttons or when pairing Buttons that need a new phone number)

      1. ssh into the RPi that is running the pairing tool

      1. follow the generic RPi setup instructions above

      1. cd into the `BraveButtons/pairing-tool` directory

      1. run `sudo ./setup_pi.sh`

      1. copy `.env.example` to `.env` and fill out variables appropriately for the environment where you want the Buttons to be paired into, if not already done

      1. run `sudo ./start_flicd.sh`

      1. to start the pairing tool, run `npm start` and follow the on-screen prompts

      1. copy the resulting `pairing-tool-output-*.csv` file to the `BraveButtonsConfig/button_config` folder your local machine

   1. option 2: Use the Flic App (recommended when pairing a small number of replacement Buttons)

      1. plug in a Flic Hub that you have access to

      1. open the Flic App on a phone and pair the Button to the Hub

      1. on the newly added Button add the "Internet Request" to `POST https://chatbot-dev.brave.coop/flic_button_press?apikey=<FLIC_BUTTON_PRESS_API_KEY value from .env or 1Password>`

      1. press the Button and see it jiggle in the Flic App

      1. login to `chatbot-dev.brave.coop` and look at the logs using `pm2 logs`. You will see a line similar to

         `Bad request to /flic_button_press: Serial Number is not registered. Serial Number for '416' is BA48-A35308`

      1. on your local machine, create a CSV file in the `BraveButtonsConfig/button_config` folder that conforms to the rest of the CSV files in that folder, uses any unused GUID as the `button_id` and uses the `serial_number` from the log. Do this as many times as needed to make a line in the CSV for every Button you want to pair

      1. **_IMPORTANT_** be sure to have a single blank line at the end of the CSV or else the last button will not end up in the database. Copy the other files to be sure that you do this correctly

   1. rename it to be similar to the other `.csv` files in that folder

   1. commit the file to the `BraveButtonsConfig` repo

   1. scp the CSV file to the `chatbot` or `chatbot-dev` server depending on where you want to add the Buttons

1. add the Buttons to the database

   1. ssh onto the `chatbot` or `chatbot-dev` server depending on where you want to add the Buttons

   1. run the `BraveButtons/server/db/add_buttons_to_client.sh` script with the `BraveButtons/server/.env` file and the CSV file that you just SCP'ed here

1. pair the Buttons to their real Hub

   1. open the Flic App on a phone, connect to the Hub, and pair all the Buttons to it and name each Button

   1. configure a single Button's "Click" action (do not add anything under "Double Click" or "Hold") by adding an "Internet Request" to `POST https://chatbot-dev.brave.coop/flic_button_press?apikey=<FLIC_BUTTON_PRESS_API_KEY value from .env or 1Password>`

   1. to configure the rest of the Buttons in bulk, open the Button whose configuration you want to clone, go to "Settings" --> "Clone Config" --> "Select All"

# How to set up a Brave Hub without Ansible

1. follow the generic RPi setup instructions above

1. cd into the `BraveButtons/pi` directory

1. copy `example.pi_config.ini` to `pi_config.ini` and fill out variables appropriately for your local environment

1. run `sudo ./setup_pi.sh pi_config.ini`

# Description of the Brave Buttons config repo

The config repo stores many of the files used to configure the Button Hub fleet. It has the following directory structure:

- BraveButtonsConfig
  - ansible
    - group_vars
    - inventory-file.yaml
  - button_config
    - button-config-1.csv
    - button-config-2.csv
  - pi_config
    - pi-config-1.ini
    - pi-config-2.ini

**ansible** contains files used by Ansible to identify and connect to the different devices that make up the Button Hub fleet.

- **group_vars** contains files that store passwords used to access the Raspberry Pi environment for each group of Button Hubs. These files are encrypted at rest using Ansible Vault.

- **inventory-file.yaml** is an example of an inventory file that contains a formatted YAML object describing the different devices that Ansible can access.

**button_config** contains files generated during the Button pairing process. These files can be ingested by scripts located in `./server/db/` that add buttons to our database.

**pi_config** contains INI files used by the `./pi/setup_pi.sh` script to configure the system. These INI files are also used by `./pi/heartbeat.py` as a source of config.

# How to set up a Brave Hub using Ansible

1. on your local machine:

   1. install the latest Balena Etcher or Raspberry Pi Imager

   1. download the latest Raspbian **Buster Lite** image (do not use Bullseye)

   1. install ansible (see https://docs.ansible.com/ansible/latest/installation_guide/intro_installation.html)

   1. if your local machine is a Linux environment, install sshpass, which is used by ansible: `apt install sshpass`

1. Copy the Serial Number and Factory Password from the back of the Flic Hub to the Buttons Config Google Sheet

1. Plug the Flic Hub into a router that you had admin access to, determine its MAC address, and add it to the Buttons Config Google Sheet

1. use either Balena Etcher or Raspberry Pi Imager to flash the SD card with Raspbian **Buster Lite**

1. create a file named `ssh` in the boot partition of the SD card

1. install the SD card into the raspberry pi, connect it to power and ethernet

1. plug the RPi into a router that you have admin access to and determine its IP address

1. on your local machine, ensure that this repo (BraveButtons) and the config repo (BraveButtonsConfig) are present and are on their latest `production` branches

1. In BraveButtonsConfig:

   1. ensure that the new Brave Hub has been added to the appropriate inventory file in `BraveButtonsConfig/ansible`

   1. ensure that the new Brave Hub's password has been added to the appropriate file in `BraveButtonsConfig/ansible/group_vars`

   1. create the new Brave Hub's `.ini` file in `/pi_congfig` and fill in the appropriate values

1. run `ssh-agent bash` to start a new `ssh-agent` shell

1. run `ssh-add ~/.ssh/id_rsa` to add your ssh key to `ssh-agent` (for access to the remote access server)

1. if you have not already used SSH to connect to the RPi from your local machine, manually attempt to do so with the default password. This will ensure that the RPi's SSH public key is accepted by your machine while programming is in progress.

1. run the following mega-command:

   ```
   ansible-playbook -i ./BraveButtonsConfig/ansible/<inventory file name> \
                 -i '<local IP address of the RPi>,' \
                 -e 'target_alias=<alias of new RPi in inventory>' \
                 ./BraveButtons/ops/setup_pi.yaml \
                 --ask-vault-pass
   ```

1. ssh into the RPi with its new password and restart the RPi by running `sudo reboot now`

1. if the RPi is configured to use wifi, unplug it from the router

1. ssh into the RPi through the remote access server and

   1. copy the system_id from `/usr/local/brave/system_id` and add it to the Button Config Google Sheet

   1. if the RPi is configured to use wifi, copy the wlan0's ether MAC address from `ifconfig` and add it to the Buttons Config Google Sheet

1. add an entry for the new hub to the `hubs` table in the db with the `system_id` from the previous step

# How to check the logs

- To view the logs on the server, first SSH into the server.

  - Run `pm2 logs` to follow a tail of both console and error logs

  - Run `less ~/.pm2/logs/BraveServer-out.log` to view the console logs or `less ~/.pm2/logs/BraveServer-error.log` to view the error logs

  - Run `tail -f ~/.pm2/logs/BraveServer-out.log` to follow the tail of the console logs or `tail -f ~/.pm2/logs/BraveServer-error.log` to follow the tail of the error logs

  - Run `zcat ~/.pm2/logs/<filename.log.gz> | less` to view any of the archived logs in `~/.pm2/logs`

- To view the logs on the Raspberry Pi, first SSH into the remote access server and then SSH into the pi

  - Run `tail -f /var/log/brave/heartbeat.log` to follow the tail of the logs

  - Run `less /var/log/brave/<logfilename>` to view any of the logs in `/var/log/brave`

# How to run tests for the raspberry pi code:

1. install pytest and pytest-cov (run `pip3 install pytest pytest-cov`)

1. cd into the `pi` directory

1. run `/home/pi/.local/bin/pytest --cov=heartbeat`

# How to add a PostgreSQL migration script

This strategy assumes that each migration script in the `db` directory has a unique positive integer migration ID,
and that each script's migration ID is exactly one greater than the previous script's migration ID.
Otherwise, the scripts will not run.

1. Copy `db/000-template.sql` and name it with its migration ID (padded with zeros) followed by a short description of what it does

1. Update the file with its migration ID and the new migration scripts

1. Add the call to the migration script to setup_postgresql.sh

# How to access a remote database

To access the remote database you'll first need to add the IP you're trying to access it form to the "trusted sources" section of the digital ocean database console located at https://cloud.digitalocean.com/databases/button-db

To connect, use the connection details available from the connection pools page on Digital Ocean - there should be a pool for testing and one for production, and connection details will be available as individual parameters, a connection string, and as a psql command with the necessary flags filled in https://cloud.digitalocean.com/databases/button-db/pools

`PGPASSWORD=<password> psql -U <user> -h <hostname>.com -p <port> -d <database> --set=sslmode=require`

You can also append the standard psql flags (like -c for commands or -f for file input)

# How to view which migration scripts have been run and when

```
SELECT *
FROM migrations
ORDER BY id;
```

# How to add or change an encrypted Travis environment variable

Reference: https://docs.travis-ci.com/user/environment-variables/#encrypting-environment-variables

1. Download the Travis CLI `gem install travis`

1. cd to anywhere in this repo

1. temporarily create a personal access token on GitHub https://github.com/settings/tokens with the following permissions:

   - `repo`
   - `read:packages`
   - `read:org`
   - `read:public_key`
   - `read:repo_hook`
   - `user`
   - `read:discussion`
   - `read:enterprise`

1. login using `travis login --pro --github-token <token from github>`

1. For a given `VAR_NAME` that you want to have value `secret_value`, run
   `travis encrypt --pro VAR_NAME=secret_value`
   which will ask for your GitHub username and password and then
   output your encrypted variable

1. Copy the encrypted variable into `.travis.yml`

1. Delete your personal access token from GitHub

# How to run a migration script

Run the setup_postgresql.sh script, making sure to provide the necessary environment variables before the command. The command needs values for PG_PASSWORD, PG_HOST, PG_USER, and PG_PORT, which will be available in the [connection details section of the managed database page on Digital Ocean.]https://cloud.digitalocean.com/databases/button-db)

`PG_PASSWORD=password PG_USER=database PG_HOST=hostname PG_PORT=port ./setup_postgresql.sh`

# How to migrate data from one PostgreSQL database to another

The standard way to migrate data is to use the pg_dump command to create a backup of the old database (which is just a sequence of PostgreSQL commands) and to feed this file to the new database.

If you're migrating from a local database to a remote database that has already had users created and migration scripts run on it, you'll want to create this backup without owners (using the -O flag) and specify to only dump the data, not the schema (with the --data-only flag).

You can either pipe the output of pg_dump directly to the new database

`pg_dump --data-only -O pg_brave | PGPASSWORD=password psql -U db_user -h dbhost.com -p 12345 -d targetdatabase --set=sslmode=require`

or save it to an intervening file, and then input this file to the database

`pg_dump --data-only -O pg_brave > bravedata.sql`

`PGPASSWORD=password psql -U db_user -h dbhost.com -p 12345 -d targetdatabase --set=sslmode=require < bravedata.sql`

When performing a migration, make sure to connect directly to the target database rather than through a connection pool.
