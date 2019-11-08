#!/bin/bash

set -e
original_dir=$(pwd)
cd $(dirname "$0")
export HOME=$(bash <<< "echo ~$SUDO_USER")

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

    apt-get update
    apt-get install software-properties-common
    add-apt-repository -y ppa:certbot/certbot
    apt-get update
    apt-get install -y nodejs npm certbot postgresql postgresql-contrib
    npm install -g pm2 n
    n stable
    npm install

    echo "Please enter in order the name and responder phone number and fallback phone number for the first installation (separated by a space):" 
    echo "NOTE that this will have no effect if this script has already been run"
    read installationName responderNumber fallbackNumber

    ./setup_postgresql.sh $installationName $responderNumber $fallbackNumber

    certbot certonly --standalone 

    echo "0 0 * * 0 certbot renew --pre-hook 'env HOME=$HOME pm2 stop server' --post-hook 'env HOME=$HOME pm2 start server'" > crontab.tmp
    crontab crontab.tmp
    rm crontab.tmp
    
    pm2 install pm2-logrotate
    pm2 set pm2-logrotate:max_size 10M
    pm2 set pm2-logrotate:compress true
    pm2 set pm2-logrotate:rotateInterval '0 0 1 1 *'    
    pm2 startup systemd
    pm2 start server.js

    cd $original_dir
fi
