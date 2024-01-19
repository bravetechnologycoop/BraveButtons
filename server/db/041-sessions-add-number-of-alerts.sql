DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 41;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
    	-- Disable the set_sessions_timestamp trigger so updated_at doesn't change
	ALTER TABLE sessions
	DISABLE TRIGGER set_sessions_timestamp;

        -- Remove columns alert_api_key and responder_push_id from clients
        ALTER TABLE sessions
	RENAME COLUMN num_button_presses TO number_of_alerts;

	-- Update column type from 'numeric' to 'integer'
	ALTER TABLE sessions
	ALTER COLUMN number_of_alerts TYPE INT USING number_of_alerts::INT;

	-- Set column default to 1
	ALTER TABLE sessions
	ALTER COLUMN number_of_alerts SET DEFAULT 1;

    	-- Enable the set_sessions_timestamp trigger now that the above queries have completed
	ALTER TABLE sessions
	ENABLE TRIGGER set_sessions_timestamp;

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;
