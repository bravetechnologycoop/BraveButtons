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
    echo "Usage: $0 path_to_.env_file new_installation_name path_to_registry_csv"
    echo "" 
    echo "Example: $0 ./../.env ExistingInstallation ./add_buttons.csv.example"
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
        fi
    done < $1

    installation_id=$(sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -d $PG_USER -qtAX -c "SELECT id FROM installations WHERE name = '$2';")

    if [[ -z "$installation_id" ]]; then
        echo "couldn't find an installation with the given installation name $2"
        exit 1
    fi

    while IFS=",", read -r button_id unit phone_number; do
        if [[ "$phone_number" != "phone_number" && "$phone_number" != "" ]]; then
            echo "Adding button"
            echo "  Button ID: $button_id"
            echo "  Unit: $unit"
            echo "  Phone Number: $phone_number"

            sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -d $PG_USER -c "INSERT INTO registry (button_id, unit, phone_number, installation_id) VALUES ('$button_id', '$unit', '$phone_number', '$installation_id');"
        fi
    done < $3

    cd $original_dir
fi
