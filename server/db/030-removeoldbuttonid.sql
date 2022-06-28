DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 30;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- ADD SCRIPT HERE
        -- Disable the triggers so that `updated_at` will stay the same
        ALTER TABLE buttons
        DISABLE TRIGGER set_registry_timestamp;

        ALTER TABLE sessions
        DISABLE TRIGGER set_sessions_timestamp;

        -- For all buttons that don't have a button_serial_number, set it to the button_id value
        UPDATE buttons
        SET button_serial_number = button_id
        WHERE button_serial_number IS NULL;

        -- Change the values in sessions.button_id to be the buttons.id instead of buttons.button_id
        UPDATE sessions
        SET button_id = b.id
        FROM sessions AS s
        LEFT JOIN buttons b on s.button_id = b.button_id
        WHERE sessions.id = s.id;

        ALTER TABLE sessions
        ALTER COLUMN button_id TYPE uuid USING button_id::uuid;

        -- Add foreign key reference from sessions.button_id to buttons_id
        ALTER TABLE sessions
        ADD CONSTRAINT sessions_button_id_fkey FOREIGN KEY (button_id) REFERENCES buttons (id);

        -- Remove the now-unnecessary buttons.button_id column
        ALTER TABLE buttons
        DROP COLUMN IF EXISTS button_id;

        -- button_serial_number should always have a value
        ALTER TABLE buttons
        ALTER COLUMN button_serial_number
        SET NOT NULL;

        -- Re-enable the trigger so `updated_at` is updated once again
        ALTER TABLE buttons
        ENABLE TRIGGER set_registry_timestamp;

        ALTER TABLE sessions
        ENABLE TRIGGER set_sessions_timestamp;

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;
