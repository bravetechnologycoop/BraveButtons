#!/bin/bash

if [[ $EUID > 0 ]]; then
  echo "this script needs sudo privelages to run correctly."
  exit 1

else
  apt-get update
  apt-get install -y darkstat bridge-utils

  cat ./darkstat_init.txt > /etc/darkstat/init.cfg
  cat ./interfaces.txt >> /etc/network/interfaces
  
  service networking restart
  service darkstat start 
fi
