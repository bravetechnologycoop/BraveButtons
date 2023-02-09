#!/bin/bash

set -e
original_dir=$(pwd)
cd $(dirname "$0")

if [[ $EUID > 0 ]]; then
    echo "This script needs sudo privileges to run correctly."
    cd $original_dir
    exit 1
elif [[ ! -n "$6" ]]; then
    echo ""
    echo "Usage: $0 path_to_.env_file new_client_name responder_phone_numbers fallback_phone_numbers from_phone_number path_to_buttons_csv"
    echo "" 
    echo "Example: $0 ./../.env NewClient '{+16041234567,+16049876541}' '{+17781234567,+17789876543}' +18881112222 ./add_buttons.csv.example"
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

    echo "Adding new client"
    echo "  Name: $2"
    echo "  Responder Phones: $3"
    echo "  Fallback Phones: $4"
    echo "  From Phone: $5"
    sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -h $PG_HOST -p $PG_PORT -d $PG_USER --set=sslmode=require -c "INSERT INTO clients (display_name, responder_phone_numbers, fallback_phone_numbers, from_phone_number, is_active) VALUES ('$2', '$3', '$4', '$5', 't');"

    client_id=$(sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -h $PG_HOST -p $PG_PORT -d $PG_USER --set=sslmode=require -qtAX -c "SELECT id FROM clients WHERE created_at = (SELECT MAX(created_at) FROM clients);")

    while IFS=",", read -r unit phone_number button_serial_number; do
        if [[ "$phone_number" != "phone_number" && "$phone_number" != "" ]]; then
            echo "Adding button"
            echo "  Display Name: $unit"
            echo "  Phone Number: $phone_number"
            echo "  Serial Number: $button_serial_number"

            sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -h $PG_HOST -p $PG_PORT -d $PG_USER --set=sslmode=require -c "INSERT INTO buttons (button_serial_number, display_name, phone_number, client_id) VALUES (LOWER('$button_serial_number'), '$unit', '$phone_number', '$client_id');"
        fi
    done < $6

    cd $original_dir
fi
