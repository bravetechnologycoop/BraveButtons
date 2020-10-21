#!/bin/bash

set -e
original_dir=$(pwd)
cd $(dirname "$0")

if [[ $EUID > 0 ]]; then
    echo "This script needs sudo privileges to run correctly."
    cd $original_dir
    exit 1
elif [[ ! -n "$5" ]]; then
    echo ""
    echo "Usage: $0 path_to_.env_file new_installation_name responder_phone_number fallback_phone_number path_to_registry_csv"
    echo "" 
    echo "Example: $0 ./../.env NewInstallation +16041234567 +17781234567 ./add_buttons.csv.example"
    echo ""
    echo "The registry CSV file"
    echo "MUST have the header 'button_id,unit,phone_number'"
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

    echo "Adding new installation"
    echo "  Name: $2"
    echo "  Responder Phone: $3"
    echo "  Fallback Phone: $4"
    sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -h $PG_HOST -p $PG_PORT -d $PG_USER --set=sslmode=require -c "INSERT INTO installations VALUES (DEFAULT, '$2', '$3', '$4');"

    installation_id=$(sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -h $PG_HOST -p $PG_PORT -d $PG_USER --set=sslmode=require -qtAX -c "SELECT id FROM installations WHERE created_at = (SELECT MAX(created_at) FROM installations);")

    while IFS=",", read -r button_id unit phone_number button_serial_number; do
        if [[ "$phone_number" != "phone_number" && "$phone_number" != "" ]]; then
            echo "Adding button"
            echo "  Button ID: $button_id"
            echo "  Unit: $unit"
            echo "  Phone Number: $phone_number"
            echo "  Serial Number: $button_serial_number"

            sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -h $PG_HOST -p $PG_PORT -d $PG_USER --set=sslmode=require -c "INSERT INTO registry (button_id, button_serial_number, unit, phone_number, installation_id) VALUES ('$button_id', '$button_serial_number', '$unit', '$phone_number', '$installation_id');"
        fi
    done < $5

    cd $original_dir
fi
