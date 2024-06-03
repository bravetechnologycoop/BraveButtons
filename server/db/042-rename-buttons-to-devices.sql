DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN

    RAISE NOTICE 'STARTING SCRIPT 42';
    -- The migration ID of this file
    migrationId := 42;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN

        RAISE NOTICE 'STARTING SCRIPT 42 AFATER IF';
        -- buttons table changes

        -- Disable the set_registry_timestamp trigger
        ALTER TABLE buttons DISABLE TRIGGER set_registry_timestamp;
        -- Create device_type_enum type
        CREATE TYPE device_type_enum AS ENUM ('DEVICE_BUTTON', 'DEVICE_SENSOR');
        -- Add device_type column to buttons with default value 'DEVICE_BUTTON'
        ALTER TABLE buttons ADD COLUMN device_type device_type_enum NOT NULL DEFAULT 'DEVICE_BUTTON';
        -- Now all buttons have device_type 'DEVICE_BUTTON', so remove default
        ALTER TABLE buttons ALTER COLUMN device_type DROP DEFAULT;
        -- Add locationid column to buttons with default value NULL
        ALTER TABLE buttons ADD COLUMN locationid TEXT;
        -- Rename button_serial_number column to serial_number
        ALTER TABLE buttons RENAME COLUMN button_serial_number TO serial_number;
        -- Rename buttons table to devices
        ALTER TABLE buttons RENAME TO devices;
        -- Enable the set_registry_timestamp trigger
        ALTER TABLE devices ENABLE TRIGGER set_registry_timestamp;

        -- buttons_vitals table changes

        -- Disable the create_buttons_vitals_trigger trigger
        ALTER TABLE buttons_vitals DISABLE TRIGGER create_buttons_vitals_trigger;
        -- Rename button_id column to device_id, while maintaining foreign-key constraint for id column in devices
        ALTER TABLE buttons_vitals RENAME COLUMN button_id TO device_id;
        ALTER TABLE buttons_vitals RENAME CONSTRAINT buttons_vitals_button_id_fkey TO buttons_vitals_device_id_fkey;
        -- Enable the create_buttons_vitals_trigger trigger
        ALTER TABLE buttons_vitals ENABLE TRIGGER create_buttons_vitals_trigger;
        -- Replace the trigger to insert or update buttons_vitals_cache every time a new row is added to buttons_vitals
        CREATE OR REPLACE FUNCTION create_buttons_vitals_trigger_fn()
        RETURNS TRIGGER LANGUAGE PLPGSQL AS $t$
        BEGIN
            INSERT INTO buttons_vitals_cache (id, device_id, battery_level, created_at) 
            VALUES (NEW.id, NEW.device_id, NEW.battery_level, NEW.created_at)
            ON CONFLICT (device_id)
            DO UPDATE SET
                id = NEW.id,
                battery_level = NEW.battery_level,
                created_at = NEW.created_at;
            RETURN NEW;
        END;
	$t$;

        -- buttons_vitals_cache table changes

        -- Disable the set_buttons_vitals_cache_timestamp trigger
        ALTER TABLE buttons_vitals_cache DISABLE TRIGGER set_buttons_vitals_cache_timestamp;
        -- Rename button_id column to device_id, while maintaining foreign-key constraint for id column in devices
        ALTER TABLE buttons_vitals_cache RENAME COLUMN button_id TO device_id;
        ALTER TABLE buttons_vitals_cache RENAME CONSTRAINT buttons_vitals_cache_button_id_fkey to buttons_vitals_cache_device_id_fkey;
        -- Enable the set_buttons_vitals_cache_timestamp trigger
        ALTER TABLE buttons_vitals_cache ENABLE TRIGGER set_buttons_vitals_cache_timestamp;
        
        -- sessions table changes

        -- Disable the set_sessions_timestamp trigger
        ALTER TABLE sessions DISABLE TRIGGER set_sessions_timestamp;
        -- Add column is_resettable to table sessions, not null, defaulting to false
        ALTER TABLE sessions ADD COLUMN is_resettable BOOLEAN NOT NULL DEFAULT 'f';
        -- Rename button_id column to device_id, while maintaining foreign-key constraint for id column in devices
        ALTER TABLE sessions RENAME COLUMN button_id TO device_id;
        ALTER TABLE sessions RENAME CONSTRAINT sessions_button_id_fkey TO sessions_device_id_fkey;
        -- Enable the set_sessions_timestamp trigger
        ALTER TABLE sessions ENABLE TRIGGER set_sessions_timestamp;

        -- notifications table changes

        -- Drop the notifications table if it exists, which is no longer used
        DROP TABLE IF EXISTS notifications;

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;
