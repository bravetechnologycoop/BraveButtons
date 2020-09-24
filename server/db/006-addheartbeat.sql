DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 6;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        CREATE TABLE IF NOT EXISTS heartbeat (
            system_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            flic_last_seen_time timestamptz not null DEFAULT NOW(),
            flic_last_ping_time timestamptz not null DEFAULT NOW(),
            heartbeat_last_seen_time timestamptz not null DEFAULT NOW(),
            system_name text,
            hidden boolean default no,
            sent_alerts boolean default no,
            muted boolean default no,
            twilio_alert_number text,
            heartbeat_alert_recipients text[] default '{}'
        );

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;
