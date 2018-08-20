#!/bin/bash

BASEDIR=$(dirname "$0")

if [[ $EUID > 0 ]]; then
  echo "this script needs sudo privelages to run correctly."
  exit 1

else
  apt-get update
  apt-get install -y darkstat bridge-utils

  cat "$BASEDIR/darkstat_init.txt" > /etc/darkstat/init.cfg
  cat "$BASEDIR/interfaces.txt" >> /etc/network/interfaces
  
  systemctl enable darkstat

  echo "*   *   *   *   *   python3 $BASEDIR/heartbeat.py" > "$BASEDIR/crontab.txt"
  crontab "$BASEDIR/crontab.txt"

  echo "setup almost complete. rebooting..."
  reboot now
fi
