DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 31;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- ADD SCRIPT HERE
        -- Disable the triggers so that `updated_at` will stay the same
        ALTER TABLE clients
        DISABLE TRIGGER set_clients_timestamp;

        -- Add language code for each client
        ALTER TABLE clients
        ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en' NOT NULL;

        -- Re-enable the trigger so `updated_at` is updated once again
        ALTER TABLE clients
        ENABLE TRIGGER set_clients_timestamp;

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;
