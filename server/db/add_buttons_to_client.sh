#!/bin/bash

set -e
original_dir=$(pwd)
cd $(dirname "$0")

if [[ $EUID > 0 ]]; then
    echo "This script needs sudo privileges to run correctly."
    cd $original_dir
    exit 1
elif [[ ! -n "$3" ]]; then
    echo ""
    echo "Usage: $0 path_to_.env_file existing_client_name path_to_buttons_csv"
    echo "" 
    echo "Example: $0 ./../.env ExistingClient ./add_buttons.csv.example"
    echo ""
    echo "The buttons CSV file"
    echo "MUST have the header 'unit,phone_number,button_serial_number'"
    echo "MUST use Unix line endings (LF), or else the phone numbers will have '\r' at the end"
    echo "MUST end with a newline, or else the last button will be silently ignored"
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

    client_id=$(sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -h $PG_HOST -p $PG_PORT -d $PG_USER --set=sslmode=require -qtAX -c "SELECT id FROM clients WHERE display_name = '$2';")

    if [[ -z "$client_id" ]]; then
        echo "couldn't find a client with the given client name $2"
        exit 1
    fi

    while IFS=",", read -r unit phone_number button_serial_number; do
        if [[ "$phone_number" != "phone_number" && "$phone_number" != "" ]]; then
            echo "Adding button"
            echo "  Display Name: $unit"
            echo "  Phone Number: $phone_number"
            echo "  Serial Number: $button_serial_number"
            echo "  Locationid: $locationid"

        sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -h $PG_HOST -p $PG_PORT -d $PG_USER --set=sslmode=require -c "INSERT INTO devices (serial_number, display_name, phone_number, client_id, locationid, is_displayed, is_sending_alerts, is_sending_vitals, device_type) VALUES (LOWER('$button_serial_number'), '$unit', '$phone_number', '$client_id', '$locationid', 't', 'f', 'f', 'DEVICE_BUTTON');"
        fi
    done < $3

    cd $original_dir
fi
