#!/bin/bash

set -e
original_dir=$(pwd)
cd $(dirname "$0")

if [[ $EUID > 0 ]]; then
    echo "this script needs sudo privelages to run correctly."
    cd $original_dir
    exit 1
elif [[ ! -n "$1" ]]; then
    echo "please supply the path to the .env file as the first argument when running this script."
    cd $original_dir
    exit 1
else
    while IFS="=" read -r name value; do
        if [[ "$name" == "PG_USER" ]]; then
            export PG_USER="$value"
        elif [[ "$name" == "PG_PASSWORD" ]]; then
            export PG_PASSWORD="$value"
        elif [[ "$name" == "PG_HOST" ]]; then
            export PG_HOST="$value"
        elif [[ "$name" == "PG_PORT" ]]; then
            export PG_PORT="$value"
        fi
    done < $1

    echo "please enter two IP addresses to whitelist for SSH (separated by a space):"
    read firstIP secondIP

    ufw default deny incoming
    ufw default allow outgoing
    ufw allow from $firstIP to any port 22
    ufw allow from $secondIP to any port 22
    ufw allow http
    ufw allow https
    ufw enable

    apt update
    apt install software-properties-common
    apt update
    apt install -y nodejs npm certbot postgresql postgresql-contrib
    npm install -g pm2 n
    n 12.18.3         # keep this in sync with .nvmrc for Travis
    npm ci

    echo "Please enter in order the name and responder phone number and one fallback phone number for the first installation (separated by a space):" 
    echo "NOTE that this will have no effect if this script has already been run"
    read installationName responderNumber fallbackNumber

    ./setup_postgresql.sh $installationName $responderNumber $fallbackNumber

    certbot certonly --standalone 

    # restart server weekly to ensure it uses the latest certificates (certbot renews them automatically)
    echo "
    PATH=/bin:/usr/bin:/usr/local/bin
    @weekly env pm2 restart BraveServer
    " | crontab -

    pm2 install pm2-logrotate
    pm2 set pm2-logrotate:max_size 10M
    pm2 set pm2-logrotate:compress true
    pm2 set pm2-logrotate:rotateInterval '0 0 1 1 *'    
    pm2 startup systemd

    # ensure that a new process is started or that a running process is restarted
    pm2 stop ecosystem.config.js --env production
    pm2 start ecosystem.config.js --env production
    
    cd $original_dir
fi
