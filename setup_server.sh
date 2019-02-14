#!/bin/bash

set -e
original_dir=$(pwd)
cd $(dirname "$0")

if [[ $EUID > 0 ]]; then
    echo "this script needs sudo privelages to run correctly."
    cd $original_dir
    exit 1

else
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
    apt-get install -y nodejs npm certbot
    npm install -g pm2 n
    n stable
    npm install

    certbot certonly --standalone 

    echo "0 0 * * 0 certbot renew --pre-hook 'pm2 stop server' --post-hook 'pm2 start server'" > crontab.tmp
    crontab crontab.tmp
    rm crontab.tmp
    
    pm2 startup systemd
    pm2 start server.js

    cd $original_dir
fi 
