DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 27;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- ADD SCRIPT HERE

        -- Disable the trigger so that `updated_at` will stay the same
        ALTER TABLE sessions
        DISABLE TRIGGER set_sessions_timestamp;

        -- Remove columns not in the shared schema because they are in buttons or clients tables
        ALTER TABLE sessions
        DROP COLUMN IF EXISTS unit;

        ALTER TABLE sessions
        DROP COLUMN IF EXISTS phone_number;

        ALTER TABLE sessions
        DROP COLUMN IF EXISTS client_id;

        -- Rename columsn to match shared schema
        ALTER TABLE sessions
        RENAME COLUMN incident_type TO incident_category;

        ALTER TABLE sessions
        RENAME COLUMN num_presses TO num_button_presses;

        -- Use enums for ALERT_TYPE
        -- Note: To view enum types and their values in `psql`, use the command `\dT+`
        CREATE TYPE alert_type_enum AS ENUM ('BUTTONS_NOT_URGENT', 'BUTTONS_URGENT', 'SENSOR_STILLNESS', 'SENSOR_DURATION', 'SENSOR_UNKNOWN');

        ALTER TABLE sessions
        ADD COLUMN IF NOT EXISTS alert_type alert_type_enum;

        UPDATE sessions
        SET alert_type='BUTTONS_URGENT'
        WHERE num_button_presses > 1;

        UPDATE sessions
        SET alert_type='BUTTONS_NOT_URGENT'
        WHERE num_button_presses = 1;

        ALTER TABLE sessions
        ALTER COLUMN alert_type
        SET NOT NULL;

        -- Use enums for CHATBOT_STATE
        CREATE TYPE chatbot_state_enum AS ENUM ('STARTED', 'WAITING_FOR_REPLY', 'RESPONDING', 'WAITING_FOR_CATEGORY', 'COMPLETED');
        
        ALTER TABLE sessions
        ADD COLUMN IF NOT EXISTS chatbot_state chatbot_state_enum;

        UPDATE sessions
        SET chatbot_state = 'STARTED'
        WHERE state = 'Started';

        UPDATE sessions
        SET chatbot_state = 'WAITING_FOR_REPLY'
        WHERE state = 'Waiting for reply';

        UPDATE sessions
        SET chatbot_state = 'RESPONDING'
        WHERE state = 'Responding';

        UPDATE sessions
        SET chatbot_state = 'WAITING_FOR_CATEGORY'
        WHERE state = 'Waiting for incident category';

        UPDATE sessions
        SET chatbot_state = 'COMPLETED'
        WHERE state = 'Completed';

        ALTER TABLE sessions
        DROP COLUMN IF EXISTS state;

        ALTER TABLE sessions
        ALTER COLUMN chatbot_state
        SET NOT NULL;

        -- Re-enable the trigger so `updated_at` is updated once
        ALTER TABLE sessions
        ENABLE TRIGGER set_sessions_timestamp;

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;
