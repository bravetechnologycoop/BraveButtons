DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 44;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN

        -- Disable the create_buttons_vitals_trigger trigger
        ALTER TABLE buttons_vitals DISABLE TRIGGER create_buttons_vitals_trigger;

        -- Re-create trigger with new columns
        CREATE OR REPLACE FUNCTION create_buttons_vitals_trigger_fn()
        RETURNS TRIGGER LANGUAGE PLPGSQL AS $t$
        BEGIN
            INSERT INTO buttons_vitals_cache (id, device_id, battery_level, created_at, rssi, snr) 
            VALUES (NEW.id, NEW.device_id, NEW.battery_level, NEW.created_at, NEW.rssi, NEW.snr)
            ON CONFLICT (device_id)
            DO UPDATE SET
                id = NEW.id,
                battery_level = NEW.battery_level,
                created_at = NEW.created_at,
                rssi = NEW.rssi,
                snr = NEW.snr;
            RETURN NEW;
        END;
	    $t$;

        -- Replace the old trigger with the new one
        CREATE OR REPLACE TRIGGER create_buttons_vitals_trigger
        BEFORE INSERT OR UPDATE ON buttons_vitals
        FOR EACH ROW EXECUTE PROCEDURE create_buttons_vitals_trigger_fn();

        -- Re-enable the create_buttons_vitals_trigger trigger
        ALTER TABLE buttons_vitals ENABLE TRIGGER create_buttons_vitals_trigger;

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;