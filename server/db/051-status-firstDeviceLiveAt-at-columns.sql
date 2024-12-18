DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 51;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- Create ENUM for the new status column
        CREATE TYPE status_enum AS ENUM ('TESTING', 'SHIPPED', 'LIVE');

        -- Add status column to clients table
        -- Default value is set to LIVE, so current client devices are live 
        ALTER TABLE clients ADD COLUMN status status_enum NOT NULL DEFAULT 'LIVE';

        -- Add first_device_live_at column to clients table
        -- Default value is null
        ALTER TABLE clients ADD COLUMN first_device_live_at DATE;

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;