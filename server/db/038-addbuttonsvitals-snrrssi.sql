DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 38;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- ADD SCRIPT HERE
        -- Don't update the buttons_vitals_cache
        DROP TRIGGER IF EXISTS create_buttons_vitals_trigger ON buttons_vitals;

        -- Add column for Button's SNR
        ALTER TABLE buttons_vitals
        ADD COLUMN IF NOT EXISTS snr DECIMAL;

        -- Add column for Button's RSSI
        ALTER TABLE buttons_vitals
        ADD COLUMN IF NOT EXISTS rssi INT;

        -- Add column for Button Vitals Cache's SNR
        ALTER TABLE buttons_vitals_cache
        ADD COLUMN IF NOT EXISTS snr DECIMAL;

        -- Add column for Button Vitals Cache's RSSI
        ALTER TABLE buttons_vitals_cache
        ADD COLUMN IF NOT EXISTS rssi INT;

        -- Re-activate trigger with new columns
        CREATE OR REPLACE FUNCTION create_buttons_vitals_trigger_fn()
        RETURNS TRIGGER LANGUAGE PLPGSQL AS $t$
        BEGIN
            INSERT INTO buttons_vitals_cache (id, button_id, battery_level, created_at, rssi, snr) 
            VALUES (NEW.id, NEW.button_id, NEW.battery_level, NEW.created_at, NEW.rssi, NEW.snr)
            ON CONFLICT (button_id)
            DO UPDATE SET
                id = NEW.id,
                battery_level = NEW.battery_level,
                created_at = NEW.created_at,
                rssi = NEW.rssi,
                snr = NEW.snr;
            RETURN NEW;
        END;
        $t$;

        CREATE TRIGGER create_buttons_vitals_trigger
        BEFORE INSERT OR UPDATE ON buttons_vitals
        FOR EACH ROW EXECUTE PROCEDURE create_buttons_vitals_trigger_fn();


        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;
