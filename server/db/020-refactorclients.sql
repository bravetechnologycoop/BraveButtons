DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 20;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- Add missing columns to better match the combined schema
        ALTER TABLE clients
        ADD COLUMN reminder_timeout INTEGER NOT NULL DEFAULT 120;

        ALTER TABLE clients
        ADD COLUMN fallback_timeout INTEGER NOT NULL DEFAULT 240;

        ALTER TABLE clients
        ADD COLUMN heartbeat_phone_numbers TEXT[] NOT NULL DEFAULT '{}';

        ALTER TABLE clients
        ALTER COLUMN fallback_phone_numbers
        SET DEFAULT '{}';

        -- Set everyone to have the Canadian "from" Twilio number
        ALTER TABLE clients
        ADD COLUMN from_phone_number TEXT;

        UPDATE clients
        SET from_phone_number='+16042626918';

        ALTER TABLE clients
        ALTER COLUMN from_phone_number
        SET NOT NULL;

        -- Copy heartbeat_phone_numbers from hubs and remove column from hubs.
        -- Assumes that all the hubs from the same client will have the same value for heartbeat_alert_recipients
        UPDATE clients
        SET heartbeat_phone_numbers = COALESCE((
            SELECT heartbeat_alert_recipients
            FROM hubs
            WHERE clients.id = hubs.client_id
            LIMIT 1
        ), '{}');

        ALTER TABLE hubs
        DROP COLUMN heartbeat_alert_recipients;

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;
