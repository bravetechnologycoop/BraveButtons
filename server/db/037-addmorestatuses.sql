DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 37;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- ADD SCRIPT HERE
        -- Add new state columns
        ALTER TABLE clients
        ADD COLUMN IF NOT EXISTS is_displayed BOOLEAN;

        ALTER TABLE buttons
        ADD COLUMN IF NOT EXISTS is_displayed BOOLEAN;

        ALTER TABLE gateways
        ADD COLUMN IF NOT EXISTS is_displayed BOOLEAN;

        ALTER TABLE clients
        ADD COLUMN IF NOT EXISTS is_sending_alerts BOOLEAN;

        ALTER TABLE buttons
        ADD COLUMN IF NOT EXISTS is_sending_alerts BOOLEAN;

        ALTER TABLE clients
        ADD COLUMN IF NOT EXISTS is_sending_vitals BOOLEAN;

        ALTER TABLE buttons
        ADD COLUMN IF NOT EXISTS is_sending_vitals BOOLEAN;

        ALTER TABLE gateways
        ADD COLUMN IF NOT EXISTS is_sending_vitals BOOLEAN;

        -- Update the column values based on current is_active value
        UPDATE clients
        SET is_displayed = 't', is_sending_alerts = is_active, is_sending_vitals = is_active;

        UPDATE buttons
        SET is_displayed = 't', is_sending_alerts = is_active, is_sending_vitals = is_active;

        UPDATE gateways
        SET is_displayed = 't', is_sending_vitals = is_active;

        -- Don't allow NULLs
        ALTER TABLE clients
        ALTER COLUMN is_displayed
        SET NOT NULL;

        ALTER TABLE clients
        ALTER COLUMN is_sending_alerts
        SET NOT NULL;

        ALTER TABLE clients
        ALTER COLUMN is_sending_vitals
        SET NOT NULL;

        ALTER TABLE buttons
        ALTER COLUMN is_displayed
        SET NOT NULL;

        ALTER TABLE buttons
        ALTER COLUMN is_sending_alerts
        SET NOT NULL;

        ALTER TABLE buttons
        ALTER COLUMN is_sending_vitals
        SET NOT NULL;

        ALTER TABLE gateways
        ALTER COLUMN is_displayed
        SET NOT NULL;

        ALTER TABLE gateways
        ALTER COLUMN is_sending_vitals
        SET NOT NULL;

        -- Delete is_active column
        ALTER TABLE clients
        DROP COLUMN IF EXISTS is_active;

        ALTER TABLE buttons
        DROP COLUMN IF EXISTS is_active;

        ALTER TABLE gateways
        DROP COLUMN IF EXISTS is_active;

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;
