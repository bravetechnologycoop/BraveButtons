#!/bin/bash
# setup_reporting_db.sh
#
# Sets up the reporting database given a source and destination database.

# read arguments into variables
src_user=$1
src_host=$2
src_port=$3
src_db=$4
dst_user=$5
dst_host=$6
dst_port=$7
dst_db=$8

printf "\n----\n\n"

printf "Source database:\tpostgresql://%s@%s:%s/%s\n\n" $src_user $src_host $src_port $src_db

printf "Destination database:\tpostgresql://%s@%s:%s/%s\n\n" $dst_user $dst_host $dst_port $dst_db

printf "This script is unsafe - it does the following:\n"
printf "1.\tIt will download data from and slow the source database to a halt.\n"
printf "2.\tIt will drop all necessary data and schemas from the destination database.\n"
printf "3.\tIt will upload the downloaded data to the destination database.\n\n"

printf "Please look over the connection strings for the source and destination databases.\n"
printf "Are you sure you want to proceed? (Y/n) "
read answer
if [ $answer != "Y" ]; then
	printf "OK - Won't do anything then.\n"
	exit
fi

# dump all tables except button_vitals and gateway_vitals (too large) into /tmp/button_reporting_db.sql
# NOTE: the --clean option prepends the insert queries with drop queries to "clean" the necessary tables from the reporting db
pg_dump $src_db -U $src_user -h $src_host -p $src_port -f /tmp/button_reporting_db.sql --clean --if-exists -T button_vitals -T gateway_vitals

# upload the dumped data to the destination database
psql -U $dst_user -h $dst_host -p $dst_port -d $dst_db -v ON_ERROR_STOP=1 -f /tmp/button_reporting_db.sql
psql_return_val=$?

# this file isn't needed anymore, so delete it
rm /tmp/button_reporting_db.sql

printf "\n----\n\n"
if [ $psql_return_val != 0 ]; then
	printf "Looks like something broke - you may need to do some investigating.\n"
else
	printf "The destination database has been populated - check for yourself!\n"
fi
