DROP FUNCTION IF EXISTS addInstallations(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION addInstallations(_installationName TEXT, _responderPhone TEXT, _fallbackPhone TEXT)
RETURNS void AS $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 2;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        CREATE TABLE installations (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            name text NOT NULL,
            responder_phone_number text NOT NULL,
            fall_back_phone_number text NOT NULL,
            created_at timestamptz DEFAULT NOW()
        );

        ALTER TABLE sessions ADD COLUMN installation_id uuid REFERENCES installations (id);
        ALTER TABLE registry ADD COLUMN installation_id uuid REFERENCES installations (id);

        -- turn off the 'updated at' trigger so that the schema-related updates to existing data don't overwrite the more interesting updated_at values
        ALTER TABLE sessions DISABLE TRIGGER set_sessions_timestamp;
        ALTER TABLE registry DISABLE TRIGGER set_registry_timestamp;

        -- update the existing data to the new schema
        INSERT INTO installations VALUES (DEFAULT, _installationName, _responderPhone, _fallbackPhone);
        UPDATE sessions SET installation_id = (SELECT id FROM installations LIMIT 1);
        UPDATE registry SET installation_id = (SELECT id FROM installations LIMIT 1);

        -- turn the triggers back on
        ALTER TABLE sessions ENABLE TRIGGER set_sessions_timestamp;
        ALTER TABLE registry ENABLE TRIGGER set_registry_timestamp;

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$ language plpgsql;

SELECT addInstallations(:installationName, :responderPhone, :fallbackPhone);

DROP FUNCTION addInstallations(TEXT, TEXT, TEXT);
