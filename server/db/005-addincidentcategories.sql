DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 5;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        ALTER TABLE installations ADD COLUMN incident_categories text[] NOT NULL DEFAULT '{}';
        
        -- Set all existing installations to the incident categories which were previously hardcoded in the state machine code
        UPDATE installations SET incident_categories = '{Accidental, Safer Use, Unsafe Guest, Overdose, Other}';
        
        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;
