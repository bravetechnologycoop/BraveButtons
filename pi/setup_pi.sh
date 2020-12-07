#!/bin/bash

set -e
BASEDIR=$(dirname "$0")

if [[ $EUID > 0 ]]; then
  echo "this script needs sudo privelages to run correctly."
  exit 1
elif [[ ! -n "$1" ]]; then
  echo "please supply the path to the config file as the first argument when running this script."
  exit 1
else

  while IFS="=" read -r name value; do
    if [[ "$name" == "hostname" ]]; then
      hostname="$value"
    elif [[ "$name" == "remoteAccessPort" ]]; then
      remoteAccessPort="$value"
    elif [[ "$name" == "remoteAccessServerFQDN" ]]; then
      remoteAccessServerFQDN="$value"
    elif [[ "$name" == "ssid" ]]; then
      ssid="$value"
    elif [[ "$name" == "psk" ]]; then
      psk="$value"
    elif [[ "$name" == "fallback_ssid" ]]; then
      fallback_ssid="$value"
    elif [[ "$name" == "fallback_psk" ]]; then
      fallback_psk="$value"
    elif [[ "$name" == "flic_hub_interface" ]]; then
      flic_hub_interface="$value"
    elif [[ "$name" == "network_interface" ]]; then
      network_interface="$value"
    fi
  done < $1

  if [[ ! -v hostname ]] || [[ ! -v remoteAccessPort ]] || [[ ! -v remoteAccessServerFQDN ]]; then
    echo "the configuration file for this script is invalid."
    exit 1
  fi

  # as of Raspbian Buster, this is required for wifi to work
  rfkill unblock wifi

  apt update
  apt install -y darkstat python3-gpiozero autossh ssh parprouted dhcp-helper avahi-daemon python3-pip
  pip3 install python-daemon

  darkstat_init_file=$(<$BASEDIR/templates/darkstat_init.txt)
  darkstat_init_file="${darkstat_init_file//FLIC_HUB_INTERFACE/$flic_hub_interface}"
  echo "$darkstat_init_file" > /etc/darkstat/init.cfg
  
  dhcp_helper_file=$(<$BASEDIR/templates/dhcp_helper.txt)
  dhcp_helper_file="${dhcp_helper_file//NETWORK_INTERFACE/$network_interface}"
  echo "$dhcp_helper_file" > /etc/default/dhcp-helper

  # if we're using wifi then we need to configure wpa_suppplicant with this line
  wpa_conf_config=''
  if [[ "$network_interface" == "wlan0"  ]]; then
    wpa_conf_config='wpa-conf /etc/wpa_supplicant/wpa_supplicant.conf'

    wpa_supplicant_config_file=$(<$BASEDIR/templates/wpa_supplicant.txt)
    wpa_supplicant_config_file="${wpa_supplicant_config_file//FALLBACK_SSID/$fallback_ssid}"
    wpa_supplicant_config_file="${wpa_supplicant_config_file//FALLBACK_PSK/$fallback_psk}"
    wpa_supplicant_config_file="${wpa_supplicant_config_file//SSID/$ssid}"
    wpa_supplicant_config_file="${wpa_supplicant_config_file//PSK/$psk}"
    echo "$wpa_supplicant_config_file" > /etc/wpa_supplicant/wpa_supplicant.conf
  fi

  interfaces_file=$(<$BASEDIR/templates/interfaces.txt)
  interfaces_file="${interfaces_file//FLIC_HUB_INTERFACE/$flic_hub_interface}"
  interfaces_file="${interfaces_file//NETWORK_INTERFACE/$network_interface}"
  interfaces_file="${interfaces_file//WPA_CONF/$wpa_conf_config}"
  echo "$interfaces_file" > /etc/network/interfaces

  cat "$BASEDIR/templates/avahi_daemon.txt" > /etc/avahi/avahi-daemon.conf

  echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/local.conf
 
  mkdir -p /var/log/brave
  touch /var/log/brave/heartbeat-out.log
  touch /var/log/brave/heartbeat-err.log
  chown pi:pi /var/log/brave /var/log/brave/heartbeat-out.log /var/log/brave/heartbeat-err.log

  mkdir -p /usr/local/brave
  touch /usr/local/brave/system_id
  chown pi:pi /usr/local/brave /usr/local/brave/system_id
  chmod 700 /usr/local/brave

  hosts_file=$(</etc/hosts)
  hosts_file="${hosts_file//raspberrypi/$hostname}"
  echo "$hosts_file" > /etc/hosts
  echo "$hostname" > /etc/hostname

  if [[ ! -e /home/pi/.ssh/id_rsa ]]; then
    mkdir -p /home/pi/.ssh
    ssh-keygen -t rsa -N "" -f /home/pi/.ssh/id_rsa
    chown -R pi:pi /home/pi/.ssh
    echo "SSH public key:"
    cat /home/pi/.ssh/id_rsa.pub
    read -p "please copy the SSH public key to the remote access server. press [Enter] when you are finished."
  fi

  autossh_systemd_unit_file=$(<$BASEDIR/templates/autossh_systemd_unit_file.txt)
  autossh_systemd_unit_file="${autossh_systemd_unit_file//REMOTE_ACCESS_PORT/$remoteAccessPort}"
  autossh_systemd_unit_file="${autossh_systemd_unit_file//REMOTE_ACCESS_SERVER_FQDN/$remoteAccessServerFQDN}"
  echo "$autossh_systemd_unit_file" > /etc/systemd/system/brave-autossh.service

  heartbeatScriptDir="$(pwd)/$BASEDIR"
  heartbeatScriptDir=${heartbeatScriptDir%"/."}
  heartbeat_systemd_unit_file=$(<$BASEDIR/templates/heartbeat_systemd_unit_file.txt)
  heartbeat_systemd_unit_file="${heartbeat_systemd_unit_file//HEARTBEAT_SCRIPT_DIR/$heartbeatScriptDir}"
  echo "$heartbeat_systemd_unit_file" > /etc/systemd/system/brave-heartbeat.service

  systemctl daemon-reload
  systemctl enable brave-heartbeat.service
  systemctl enable brave-autossh.service
  systemctl enable darkstat
  systemctl enable dhcp-helper

  echo "setup complete - please reboot the RPi."
fi
