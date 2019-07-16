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

    # turn off the 'updated at' trigger so that the schema-related updates to existing data don't overwrite the more interesting updated_at values
    sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -d $PG_USER -c "ALTER TABLE sessions DISABLE TRIGGER set_sessions_timestamp"
    sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -d $PG_USER -c "ALTER TABLE registry DISABLE TRIGGER set_registry_timestamp"

    # update the existing data to the new schema
    sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -d $PG_USER -c "INSERT INTO installations VALUES (DEFAULT, '$installationName', '$responderPhone', '$fallbackPhone')"
    sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -d $PG_USER -c "UPDATE sessions SET installation_id = (SELECT id FROM installations LIMIT 1)"
    sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -d $PG_USER -c "UPDATE registry SET installation_id = (SELECT id FROM installations LIMIT 1)"

    # turn the triggers back on
    sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -d $PG_USER -c "ALTER TABLE sessions ENABLE TRIGGER set_sessions_timestamp"
    sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -d $PG_USER -c "ALTER TABLE registry ENABLE TRIGGER set_registry_timestamp"

    sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -d $PG_USER -f ./db/003-setinstallationconstraints.sql
   
