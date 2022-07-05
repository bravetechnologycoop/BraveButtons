DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 32;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- ADD SCRIPT HERE
        -- Create a new buttons_vitals_cache table with the same columns as buttons_vitals plus an updated_at column
        CREATE TABLE IF NOT EXISTS buttons_vitals_cache (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            button_id uuid REFERENCES buttons (id) UNIQUE NOT NULL,
            battery_level int,
            created_at timestamptz NOT NULL DEFAULT NOW(),
            updated_at timestamptz NOT NULL DEFAULT NOW()
        );

        -- Add the foreign key index onto new buttons_vitals_cache table
        CREATE INDEX IF NOT EXISTS buttons_vitals_cache_button_id_idx ON buttons_vitals_cache (button_id);

        -- Add a trigger to update the sensors_vitals_cache.updated_at column
        CREATE OR REPLACE FUNCTION trigger_set_timestamp()
        RETURNS TRIGGER AS $t$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $t$ LANGUAGE plpgsql;

        CREATE TRIGGER set_buttons_vitals_cache_timestamp
        BEFORE UPDATE ON buttons_vitals_cache
        FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

        -- Insert the most recent vitals for each button into the new buttons_vitals_cache table
        INSERT INTO buttons_vitals_cache
        SELECT a.*
        FROM (
            SELECT DISTINCT ON (b.phone_number) bv.*
            FROM buttons_vitals AS bv
            LEFT JOIN buttons AS b ON b.id = bv.button_id
            ORDER BY b.phone_number, bv.created_at DESC
        ) AS a;

        -- Add trigger to insert or update buttons_vitals_cache every time a new row is added to buttons_vitals
        CREATE OR REPLACE FUNCTION create_buttons_vitals_trigger_fn()
        RETURNS TRIGGER LANGUAGE PLPGSQL AS $t$
        BEGIN
            INSERT INTO buttons_vitals_cache (id, button_id, battery_level, created_at) 
            VALUES (NEW.id, NEW.button_id, NEW.battery_level, NEW.created_at)
            ON CONFLICT (button_id)
            DO UPDATE SET
                id = NEW.id,
                battery_level = NEW.battery_level,
                created_at = NEW.created_at;
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
