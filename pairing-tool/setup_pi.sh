#!/bin/bash

set -e

if [[ $EUID > 0 ]]; then
  echo "this script needs sudo privelages to run correctly."
  exit 1
else
  apt update --allow-releaseinfo-change
  apt install -y vim nodejs npm

  # install stable version of node
  npm install -g n
  n stable

  # the node command changed location, this updates the PATH to reflect this
  PATH="$PATH"

  # install dependencies
  su pi -c 'npm ci'
fi
