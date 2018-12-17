#!/bin/bash

set -e
BASEDIR=$(dirname "$0")

if [[ $EUID > 0 ]]; then
  echo "this script needs sudo privelages to run correctly."
  exit 1

else
  apt-get update
  apt-get install -y darkstat bridge-utils python3-gpiozero autossh ssh
  pip3 install python-daemon

  cat "$BASEDIR/darkstat_init.txt" > /etc/darkstat/init.cfg
  cat "$BASEDIR/interfaces.txt" > /etc/network/interfaces
  
  mkdir -p /var/log/brave
  touch /var/log/brave/heartbeat-out.log
  touch /var/log/brave/heartbeat-err.log
  chown pi:pi /var/log/brave /var/log/brave/heartbeat-out.log /var/log/brave/heartbeat-err.log

  mkdir -p /usr/local/brave
  touch /usr/local/brave/system_id
  chown pi:pi /usr/local/brave /usr/local/brave/system_id
  chmod 700 /usr/local/brave

  echo "please enter the hostname to use for this device:"
  read hostname
  
  hosts_file=$(</etc/hosts)
  hosts_file="${hosts_file//raspberrypi/$hostname}"
  echo "$hosts_file" > /etc/hosts
  echo "$hostname" > /etc/hostname

  mkdir /home/pi/.ssh
  ssh-keygen -t rsa -N "" -f /home/pi/.ssh/id_rsa
  chown -R pi:pi /home/pi/.ssh
  echo "SSH public key:"
  cat /home/pi/.ssh/id_rsa.pub
  read -p "please copy the SSH public key to the remote access server. press [Enter] when you are finished."
  echo "please enter the port number to use for remote SSH access to this device:"
  read remoteAccessPort

  autossh_systemd_unit_file=$(<$BASEDIR/autossh_systemd_unit_file.txt)
  autossh_systemd_unit_file="${autossh_systemd_unit_file//REMOTE_ACCESS_PORT/$remoteAccessPort}"
  echo "$autossh_systemd_unit_file" > /etc/systemd/system/brave-autossh.service

  heartbeat_systemd_unit_file=$(<$BASEDIR/heartbeat_systemd_unit_file.txt)
  heartbeat_systemd_unit_file="${heartbeat_systemd_unit_file//HEARTBEAT_SCRIPT_PATH/$(pwd)/$BASEDIR/heartbeat.py}"
  echo "$heartbeat_systemd_unit_file" > /etc/systemd/system/brave-heartbeat.service

  systemctl daemon-reload
  systemctl enable brave-heartbeat.service
  systemctl enable brave-autossh.service
  systemctl enable darkstat

  echo "setup almost complete. rebooting..."
  reboot now
fi
