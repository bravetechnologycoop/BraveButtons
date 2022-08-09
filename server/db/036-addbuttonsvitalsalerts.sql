DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 36;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- ADD SCRIPT HERE
        -- Add column to track if a Button is active
        ALTER TABLE buttons
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT 't';

        -- Add column to track if and when a low battery message has been sent for a particular Button
        ALTER TABLE buttons
        ADD COLUMN IF NOT EXISTS sent_low_battery_alert_at timestamptz;

        -- Add column to track if and when a heartbeat message has been sent for a particular Button
        ALTER TABLE buttons
        ADD COLUMN IF NOT EXISTS sent_vitals_alert_at timestamptz;

        -- Start with all the Buttons as inactive so that I can slowly activate just the ones that I want to once it's in prod
        UPDATE buttons
        SET is_active='f';

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;
