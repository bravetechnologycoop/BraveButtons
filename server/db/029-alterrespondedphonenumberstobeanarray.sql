DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 29;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- ADD SCRIPT HERE
        -- Disable the trigger so that `updated_at` will stay the same
        ALTER TABLE clients
        DISABLE TRIGGER set_clients_timestamp;

        ALTER TABLE clients 
        ALTER responder_phone_number TYPE text[] USING array[responder_phone_number];
        
        ALTER TABLE clients
        RENAME COLUMN responder_phone_number TO responder_phone_numbers;

        -- Re-enable the trigger so `updated_at` is updated once again
        ALTER TABLE clients
        ENABLE TRIGGER set_clients_timestamp;

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;
