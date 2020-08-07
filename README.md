# BraveButtons [![Build Status](https://travis-ci.com/bravetechnologycoop/BraveButtons.svg?branch=master)](https://travis-ci.com/bravetechnologycoop/BraveButtons)


# How to set up a local chatbot dev environment

1. clone this repository

1. cd into the `chatbot` directory

1. run `sudo apt install postgresql` to install postgres

1. in `/etc/postgresql/<VERSION>/main/pg_hba.conf` change 'local ... all ... all ... peer' to 'local ... all ... all ... md5'

1. copy .env.example to .env and fill out variables appropriately for your local environment

1. run `source .env`

1. run `sudo ./setup_postgresql.sh`

1. to check that everything is working, run `npm test` and check that the tests pass.

# How to run the linter

1. cd into the `chatbot` directory

1. run `npm install`

1. run `npx eslint .`

# How to set up the network monitor on a raspberry pi:

- format the SD card
- use Etcher to flash the SD card with Raspbian Stretch
- create a file named `ssh` in the boot partition of the SD card
- install the SD card into the raspberry pi, connect it to power and ethernet
- ssh into the raspberry pi, clone this repository, and run `sudo pi/setup_pi.sh`

# How to run tests for the raspberry pi code:

- install pytest and pytest-cov (using pip)
- `cd` into the `pi` directory
- run `pytest --cov=heartbeat`

# How to install PostgreSQL on a Mac

1. Download the PostgreSQL 9.5 installer from https://www.enterprisedb.com/downloads/postgres-postgresql-downloads and follow the installation instructions

1. Add psql to the path
   `PATH="/Library/PostgreSQL/9.5/bin:$PATH"`

1. Run `setup_postgresql.sh`

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

