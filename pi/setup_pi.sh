#!/bin/bash

set -e
BASEDIR=$(dirname "$0")

if [[ $EUID > 0 ]]; then
  echo "this script needs sudo privelages to run correctly."
  exit 1

else
  apt-get update
  apt-get install -y darkstat bridge-utils python3-gpiozero

  cat "$BASEDIR/darkstat_init.txt" > /etc/darkstat/init.cfg
  cat "$BASEDIR/interfaces.txt" > /etc/network/interfaces
  
  systemctl enable darkstat

  echo "@reboot python3 $(pwd)/$BASEDIR/heartbeat.py >> $(pwd)/$BASEDIR/heartbeat.log 2>&1" > "$BASEDIR/crontab.tmp"
  crontab "$BASEDIR/crontab.tmp"
  rm "$BASEDIR/crontab.tmp"

  echo "setup almost complete. rebooting..."
  reboot now
fi
