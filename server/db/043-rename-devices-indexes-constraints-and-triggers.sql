DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 43;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- rename indexes, constraints, and triggers
        ALTER INDEX registry_button_serial_number_key RENAME TO devices_serial_number_key;
        ALTER INDEX registry_pkey RENAME TO devices_pkey;
        ALTER TABLE devices RENAME CONSTRAINT registry_installation_id_fkey TO devices_client_id_fkey;
        ALTER TRIGGER set_registry_timestamp ON devices RENAME TO set_devices_timestamp;

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;
