#!/bin/bash

set -e
original_dir=$(pwd)
cd $(dirname "$0")

if [[ $EUID > 0 ]]; then
    echo "this script needs sudo privileges to run correctly."
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

    echo "please enter two IP addresses to allowlist for SSH (separated by a space):"
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
    PATH=$PATH        # needed to set the new path for this version of node
    setcap cap_net_bind_service=+ep /usr/local/bin/node   # allows non-root to use port 443
    npm ci

    echo "Please enter in order the name and responder phone number and one fallback phone number for the first installation (separated by a space):" 
    echo "NOTE that this will have no effect if this script has already been run"
    read installationName responderNumber fallbackNumber

    certbot certonly --standalone

    # Allow brave user access to certificate even if these commands have already been run before
    # https://stackoverflow.com/questions/48078083/lets-encrypt-ssl-couldnt-start-by-error-eacces-permission-denied-open-et#answer-54903098
    addgroup nodecert || true
    adduser brave nodecert || true
    adduser root nodecert || true
    chgrp -R nodecert /etc/letsencrypt/live
    chgrp -R nodecert /etc/letsencrypt/archive
    chmod -R 750 /etc/letsencrypt/live
    chmod -R 750 /etc/letsencrypt/archive

    # setup log directory for cron issues
    mkdir -p /var/log/brave
    chmod 777 /var/log/brave
    touch /var/log/brave/pm2-crontab.log
    chmod 666 /var/log/brave/pm2-crontab.log

    # restart server weekly to ensure it uses the latest certificates (certbot renews them automatically)
    echo "
    @weekly /usr/sbin/runuser -u brave -- /usr/local/bin/pm2 restart BraveServer >> /var/log/brave/pm2-crontab.log 2>&1
    " | crontab -

    runuser -u brave -- pm2 install pm2-logrotate
    runuser -u brave -- pm2 set pm2-logrotate:max_size 10M
    runuser -u brave -- pm2 set pm2-logrotate:compress true
    runuser -u brave -- pm2 set pm2-logrotate:rotateInterval '0 0 1 1 *'
    env PATH=$PATH:/usr/local/bin /usr/local/lib/node_modules/pm2/bin/pm2 startup systemd -u brave --hp /home/brave

    # stop the process if it's running
    runuser -u brave -- pm2 stop ecosystem.config.js --env production

    # update the database
    ./setup_postgresql.sh $installationName $responderNumber $fallbackNumber

    # start a new process is started
    runuser -u brave -- pm2 start ecosystem.config.js --env production
    
    cd $original_dir
fi
