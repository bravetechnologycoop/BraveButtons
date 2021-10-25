DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 17;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        ALTER TABLE hubs ADD COLUMN installation_id uuid REFERENCES installations (id);
        ALTER TABLE hubs ADD COLUMN sent_internal_flic_alert boolean DEFAULT false;
        ALTER TABLE hubs ADD COLUMN sent_internal_ping_alert boolean DEFAULT false;
        ALTER TABLE hubs ADD COLUMN sent_internal_pi_alert boolean DEFAULT false;
        ALTER TABLE hubs ADD column sent_vitals_alert_at timestamptz DEFAULT NULL;
        ALTER TABLE hubs ADD column location_description text;
        UPDATE hubs SET sent_vitals_alert_at = now() WHERE sent_alerts IS true;
        ALTER TABLE hubs DROP column sent_alerts;

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;
