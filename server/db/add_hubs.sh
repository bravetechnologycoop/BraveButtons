#!/bin/bash

set -e
original_dir=$(pwd)
cd $(dirname "$0")

if [[ $EUID > 0 ]]; then
    echo "This script needs sudo privileges to run correctly."
    cd $original_dir
    exit 1
elif [[ ! -n "$2" ]]; then
    echo ""
    echo "Usage: $0 path_to_.env_file path_to_hubs_csv"
    echo "" 
    echo "Example: $0 ./../.env ./brave_hubs.csv.example"
    echo ""
    echo "The hubs CSV file"
    echo "MUST have the header 'system_id, system_name, heartbeat_alert_recipients'"
    echo "MUST use Unix line endings (LF)"
    echo ""
    cd $original_dir
    exit 1
else
    while IFS="=" read -r name value; do
        if [[ "$name" == "PG_USER" ]]; then
            PG_USER="$value"
        elif [[ "$name" == "PG_PASSWORD" ]]; then
            PG_PASSWORD="$value"
        elif [[ "$name" == "PG_HOST" ]]; then
            PG_HOST="$value"
        elif [[ "$name" == "PG_PORT" ]]; then
            PG_PORT="$value"
        fi
    done < $1


    while IFS=",", read -r system_id system_name heartbeat_alert_recipients; do
        if [[ "$system_id" != "system_id" && "$system_id" != "" ]]; then
            echo "Adding Hub"
            echo "  System Id: $system_id"
            echo "  System Name: $system_name"
            echo "  Heartbeat Alert Recipients: $heartbeat_alert_recipients"

            sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -h $PG_HOST -p $PG_PORT -d $PG_USER --set=sslmode=require -c "INSERT INTO hubs (system_id, system_name, heartbeat_alert_recipients) VALUES ('$system_id', '$system_name', $heartbeat_alert_recipients);"
        fi
    done < $2

    cd $original_dir
fi
