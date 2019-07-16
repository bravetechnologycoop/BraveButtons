    sudo -u postgres psql -c "CREATE ROLE $PG_USER PASSWORD '$PG_PASSWORD' LOGIN"
    sudo -u postgres createdb -O $PG_USER $PG_USER
    sudo -u postgres psql -d $PG_USER -c 'CREATE EXTENSION IF NOT EXISTS "pgcrypto"'

    sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -d $PG_USER -f ./db/001-setup.sql
    sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -d $PG_USER -f ./db/002-addinstallations.sql

    echo "an installation record will now be created and linked with all existing records in the sessions and registry tables."
    echo "please ensure that no records already exist in the installations table, or use Ctrl-C to exit this script."
    echo "please enter a name for the installation:"
    read installationName
    echo "please enter the responder phone number:"
    read responderPhone
    echo "please enter the fallback phone number:"
    read fallbackPhone

    sudo PGPASSWORD=$PGPASSWORD psql -U $PG_USER -d $PG_USER -c "INSERT INTO installations VALUES (DEFAULT, '$installationName', '$responderPhone', '$fallbackPhone')"
    sudo PGPASSWORD=$PGPASSWORD psql -U $PG_USER -d $PG_USER -c "UPDATE sessions SET installation_id = (SELECT id FROM installations LIMIT 1)"
    sudo PGPASSWORD=$PGPASSWORD psql -U $PG_USER -d $PG_USER -c "UPDATE registry SET installation_id = (SELECT id FROM installations LIMIT 1)"

    sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -d $PG_USER -f ./db/003-setinstallationconstraints.sql
   
