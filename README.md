# BraveButtons [![Build Status](https://app.travis-ci.com/bravetechnologycoop/BraveButtons.svg?branch=main)](https://app.travis-ci.com/bravetechnologycoop/BraveButtons)

# Production Deployment

## 1. Update git to reflect the new release

1. check the deployment ClickUp Task for any comments or SubTasks that could affect these deployment steps.

1. send a message to the `#buttons-aa-general` Slack channel letting everyone know that you are doing a deployment and to expect some downtime.

1. on your local machine, in the `BraveButtons` repository:

   1. pull the latest code ready for release: `git checkout main && git pull origin main`

   1. decide on an appropriate version number for the new version

   1. update CHANGELOG.md

      1. Add a new section header with the new version number and the current date below the `[Unreleased]` link so it will look like this: `[<new version number>] - YYYY-MM-DD`

      1. Create a new link for the new version near the bottom of the file that looks like this: `[<new version number>]: https://github.com/bravetechnologycoop/BraveButtons/compare/v<previous version number>...v<new version number`

      1. Update the `[unreleased]` link to `[unreleased]: https://github.com/bravetechnologycoop/BraveButtons/compare/v<new version number>...HEAD`

   1. make a new commit directly on `main` which only updates the CHANGELOG

   1. tag the new commit - for example, if the version number is v1.0.0, use `git tag v1.0.0`

   1. push the new version to GitHub: `git push origin main --tags`

   1. update the `production` branch: `git checkout production && git merge main && git push origin production`

## 2. Update the Environment Variables (if necessary)

1. on the production Buttons server (access using ssh):

   1. update the values in `~/BraveButtons/server/.env`

## 3. Notify the client Responder Phones

1. send a text message to all of the Responder phones letting them know that you are doing some routine maintenance, there will be downtime, and that you will notify them when everything is back to normal again.

   1. verify that all the active Buttons clients are in the the Twilio Studio Flow "Buttons deployment started notification". Make any necessary updates and Publish

   1. use the Flow by hitting the designated `POST` endpoint with

      - Basic auth username = Twilio account SID
      - Basic auth password = Twilio auth token
      - form-data Body
        - To: The phone number to send the final confirmation text to (i.e. your phone number)
        - From: Any number in the format +12223334444 (we don't use this number for anything, but Twilio will complain if it's missing or incorrectly formatted)

## 4. Deploy the server on Production

1. on the production Buttons server (access using ssh):

   1. cd into the `BraveButtons/server` directory

   1. shut down the server process and ensure that environment variables are not cached: `pm2 kill`

   1. pull the latest production code: `git checkout production && git pull origin production`

   1. run the server setup script: `sudo ./setup_server.sh ./.env`

## 5. Verify

1. open the production dashboard and confirm that everything appears to be working normally

1. Verify that the logs look reasonable

   1. on the production Buttons server (access using ssh):

      1. run `pm2 logs`

## 6. Notify the client Responder Phones

1. the Twilio Studio Flow "Buttons deployment completed notification"

1. send a text message to all of the Responder phones letting them know that everything is back to normal

   1. verify that all the active Buttons clients are in the the Twilio Studio Flow "Buttons deployment completed notification". Make any necessary updates and Publish

   1. use the Flow by hitting the designated `POST` endpoint with

      - Basic auth username = Twilio account SID
      - Basic auth password = Twilio auth token
      - form-data Body
        - To: The phone number to send the final confirmation text to (i.e. your phone number)
        - From: Any number in the format +12223334444 (we don't use this number for anything, but Twilio will complain if it's missing or incorrectly formatted)

## 8. Celebrate

1. send a message to the `#buttons-aa-general` Slack channel letting everyone know that the deployment is finished and list the changes in this deployment from the `CHANGELOG`

1. update the ClickUp Tasks

1. if appropriate, send a Feature Change Announcement email to the clients

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

1. to run the server locally and see the dashboard, run `npm start` and browse to `localhost:8000`

# How to run the linter

1. cd into the `server` directory or the `pairing-tool` directory, depending
   on which you want to lint

1. run `npm install`

1. run `npm run lint`

# How to configure new Buttons

1. See latest instructions here: https://app.clickup.com/2434616/v/dc/2a9hr-2261/2a9hr-7622

# Description of the Brave Buttons config repo

The config repo stores many of the files used to configure the Button Hub fleet. It has the following directory structure:

- buttons-config
  - button_config
    - button-config-1.csv
    - button-config-2.csv
  - gateway_config
    - dev
    - prod

**button_config** contains files generated during the Button provisioning process. These files can be ingested by scripts located in `./server/db/` that add buttons to our database.

**gateway_config** contains configuration files generated by the RAK Gateway that are uploaded into AWS IoT.

- **dev** RAK Gateways in the dev environment.

- **prod** RAK Gateways in the dev environment.

# How to check the logs

- To view the logs on the server, first SSH into the server.

  - Run `pm2 logs` to follow a tail of both console and error logs

  - Run `less ~/.pm2/logs/BraveServer-out.log` to view the console logs or `less ~/.pm2/logs/BraveServer-error.log` to view the error logs

  - Run `tail -f ~/.pm2/logs/BraveServer-out.log` to follow the tail of the console logs or `tail -f ~/.pm2/logs/BraveServer-error.log` to follow the tail of the error logs

  - Run `zcat ~/.pm2/logs/<filename.log.gz> | less` to view any of the archived logs in `~/.pm2/logs`

# How to add a PostgreSQL migration script

This strategy assumes that each migration script in the `db` directory has a unique positive integer migration ID,
and that each script's migration ID is exactly one greater than the previous script's migration ID.
Otherwise, the scripts will not run.

1. Copy `db/000-template.sql` and name it with its migration ID (padded with zeros) followed by a short description of what it does

1. Update the file with its migration ID and the new migration scripts

1. Add the call to the migration script to `setup_postgresql.sh`

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
