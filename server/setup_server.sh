#!/bin/bash

set -e
original_dir=$(pwd)
cd $(dirname "$0")
export HOME=$(bash <<< "echo ~$SUDO_USER")

if [[ $EUID > 0 ]]; then
    echo "this script needs sudo privelages to run correctly."
    cd $original_dir
    exit 1

elif [[ ! -e brave_config.json ]]; then
    echo "please upload the brave_config.json file before running this setup script."
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
    npm install
    npm install -g pm2 n
    n stable

    certbot certonly --standalone 

    echo "0 0 * * 0 certbot renew --pre-hook 'env HOME=$HOME pm2 stop BraveHeartbeatServer' --post-hook 'env HOME=$HOME pm2 start BraveHeartbeatServer'" > crontab.tmp
    crontab crontab.tmp
    rm crontab.tmp
    
    pm2 install pm2-logrotate
    pm2 set pm2-logrotate:max_size 10M
    pm2 set pm2-logrotate:compress true
    pm2 startup systemd
    pm2 start ecosystem.config.js --env production

    cd $original_dir
fi 
