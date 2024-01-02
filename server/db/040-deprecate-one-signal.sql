DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 40;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- Remove columns alert_api_key and responder_push_id from clients
        ALTER TABLE clients DROP COLUMN alert_api_key;
        ALTER TABLE clients DROP COLUMN responder_push_id;

	-- Where responder_phone_numbers is NULL, set it to an empty array
	UPDATE clients
	SET responder_phone_numbers = '{}'
	WHERE responder_phone_numbers IS NULL;

	-- Update responder_phone_numbers to not allow NULL values
	ALTER TABLE clients 
        ALTER COLUMN responder_phone_numbers SET NOT NULL;

	-- Update responder_phone_numbers to have a default empty array value
	ALTER TABLE clients
	ALTER COLUMN responder_phone_numbers SET DEFAULT '{}';

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;
