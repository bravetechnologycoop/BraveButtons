# BraveButtons [![Build Status](https://travis-ci.com/bravetechnologycoop/BraveButtons.svg?branch=master)](https://travis-ci.com/bravetechnologycoop/BraveButtons)


# How to set up a local server dev environment

1. clone this repository

1. cd into the `server` directory

1. run `sudo apt install postgresql` to install postgres

1. in `/etc/postgresql/<VERSION>/main/pg_hba.conf` change `local ... all ... all ... peer` to `local ... all ... all ... md5`

1. copy `.env.example` to `.env` and fill out variables appropriately for your local environment

1. run `source .env`

1. run `sudo ./setup_postgresql.sh`

1. to check that everything is working, run `npm test` and check that the tests pass.

1. to run the server locally and see the dashboard, run `NODE_ENV=test node server.js` and browse to `localhost:8000`

# How to run the linter

1. cd into the `server` directory or the `pairing-tool` directory, depending
on which you want to lint

1. run `npm install`

1. run `npm run lint`

# How to set up a generic Raspberry Pi environment (for a Brave Hub or the pairing tool):

1. use either Balena Etcher or Raspberry Pi Imager to flash the SD card with Raspbian Buster

1. create a file named `ssh` in the boot partition of the SD card

1. install the SD card into the raspberry pi, connect it to power and ethernet

1. plug the RPi into a router that you have admin access to and determine its IP address

1. ssh into the raspberry pi

1. install git: `sudo apt install git`

1. clone this repository.

# How to set up the pairing tool

1. follow the generic RPi setup instructions above

1. cd into the `BraveButtons/pairing-tool` directory

1. run `npm install`

1. run `sudo ./start_flicd.sh`

1. to start the pairing tool, run `npm start`

# How to set up a Brave Hub

1. follow the generic RPi setup instructions above

1. cd into the `BraveButtons/pi` directory

1. copy `template.pi_config.ini` to `pi_config.ini` and fill out variables
appropriates for your local environment

1. run `sudo ./setup_pi.sh pi_config.ini`

# How to set up a Brave Hub using Ansible

1. follow the generic RPi setup instructions above

1. install ansible (see https://docs.ansible.com/ansible/latest/installation_guide/intro_installation.html)

1. on your local machine, ensure that this repo (BraveButtons) and the config repo (BraveButtonsConfig) are present

1. ensure that the new Brave Hub has been added to the appropriate inventory file

1. ensure that the new Brave Hub's password has been added to the appropriate `group_vars` file

1. run `ssh-agent bash` to start a new `ssh-agent` shell

1. run `ssh-add ~/.ssh/id_rsa` to add your ssh key to `ssh-agent` (for access to the remote access server)

1. run the following mega-command:

```
ansible-playbook -i ./BraveButtonsConfig/ansible/<inventory file name> \
                 -i '<local IP address of the RPi>,' \
                 -e 'target_alias=<alias of new RPi in inventory>' \
                 ./BraveButtons/ops/setup_pi.yaml \
                 --ask-vault-pass
```

# How to deploy updates to the RPi fleet using Ansible

1. ssh into the appropriate remote access server

1. ensure that the BraveButtons and BraveButtonsConfig repos are up to date

1. run the following command:

```
ansible-playbook -i ./BraveButtonsConfig/ansible/<inventory file name> \
                 ./BraveButtons/ops/update_pi_fleet.yaml \
                 --ask-vault-pass
```

# How to run tests for the raspberry pi code:

1. install pytest and pytest-cov (run `pip3 install pytest pytest-cov`)

1. cd into the `pi` directory

1. run `/home/pi/.local/bin/pytest --cov=heartbeat`

# How to install PostgreSQL on a Mac

1. Download the PostgreSQL 9.5 installer from https://www.enterprisedb.com/downloads/postgres-postgresql-downloads and follow the installation instructions

1. Add psql to the path
   `PATH="/Library/PostgreSQL/9.5/bin:$PATH"`

1. Run `setup_postgresql_local.sh`

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

1. Download the Travis CLI `brew install travis` or `gem install travis`

1. cd to anywhere in this repo

1. For a given `VAR_NAME` that you want to have value `secret_value`, run
   `travis encrypt --pro VAR_NAME=secret_value`
   which will ask for your GitHub username and password and then
   output your encrypted variable

1. Copy the encrypted variable into `.travis.yml`

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

# How to pair a button with the 'Internet Request' Flic action

1. Once you've run the pairing tool and button registering scripts, pair the button and select 'Internet Request' from the list of Flic actions. NOTE: this method will *not work from a button that has been paired to a smartphone*. *A Flic hub is required to make this work*

2. Select the POST request button, and input the url as follows:
`https://chatbot.brave.coop/flic_button_request?presses=1` for the 'Click' and 'Hold' actions, and
`https://chatbot.brave.coop/flic_button_request?presses=2` for the 'Double Click' action
