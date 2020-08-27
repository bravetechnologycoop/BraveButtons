# BraveButtons [![Build Status](https://travis-ci.com/bravetechnologycoop/BraveButtons.svg?branch=master)](https://travis-ci.com/bravetechnologycoop/BraveButtons)


# How to set up a local chatbot dev environment

1. clone this repository

1. cd into the `chatbot` directory

1. run `sudo apt install postgresql` to install postgres

1. in `/etc/postgresql/<VERSION>/main/pg_hba.conf` change `local ... all ... all ... peer` to `local ... all ... all ... md5`

1. copy `.env.example` to `.env` and fill out variables appropriately for your local environment

1. run `source .env`

1. run `sudo ./setup_postgresql.sh`

1. to check that everything is working, run `npm test` and check that the tests pass.

1. to run the server locally and see the dashboard, run `NODE_ENV=test node server.js` and browse to `localhost:8000`

# How to run the linter

1. cd into the `chatbot` directory

1. run `npm install`

1. run `npx eslint .`

# How to set up a local heartbeat dev environment

1. cd into the `heartbeat` directory

1. copy `template.brave_config.json` to `brave_config.json` and fill out variables
appropriates for your local environment

1. run `npm install`

1. run `node server.js`

1. to see the dashboard, go to http://localhost:8000/dashboard

# How to set up a generic Raspberry Pi environment (for a Brave Hub or the pairing tool):

1. use Balena Etcher to flash the SD card with Raspbian Buster

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

1. follow the generic RPi setup instruction above

1. cd into the `BraveButtons/pi` directory

1. copy `template.pi_config.ini` to `pi_config.ini` and fill out variables
appropriates for your local environment

1. run `sudo ./setup_pi.sh pi_config.ini`

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
# How to access a remote database

To access the remote database you'll first need to add the IP you're trying to access it form to the "trusted sources" section of the digital ocean database console located at https://cloud.digitalocean.com/databases/button-db?i=c5171f

On the same page you'll see options for credentials for connecting to the database - both as connection strings and as a psql command with the necessary flags filled in. The syntax is as follows:

`PGPASSWORD=<password> psql -U <user> -h <hostname>.com -p <port> -d <database> --set=sslmode=require`

And you can use the standard psql flags (like -c for commands or -f for file input)

# How to migrate data from one PostgreSQL database to another

The standard way to migrate data is to use the pg_dump command to create a backup of the old database (which is just a sequence of PostgreSQL commands) and to feed this file to the new database.

If you're migrating from a local database to a remote database that has already had users created and migration scripts run on it, you'll want to create this backup without owners (using the -O flag) and specify to only dump the data, not the schema (with the --data-only flag)

You can either pipe the output of pg_dump directly to the new database

 `pgdump --data-only -O pg_brave | PGPASSWORD=password psql -U db_user -h dbhost.com -p 12345 -d targetdatabase --set=sslmode=require`

or save it to an intervening file, and then input this file to the database

`pgdump --data-only -O pg_brave > bravedata.sql`
`PGPASSWORD=password psql -U db_user -h dbhost.com -p 12345 -d targetdatabase --set=sslmode=require < bravedata.sql`
