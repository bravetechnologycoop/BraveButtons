DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 28;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- ADD SCRIPT HERE

        -- Disable the trigger so that `updated_at` will stay the same
        ALTER TABLE sessions
        DISABLE TRIGGER set_sessions_timestamp;

        -- Keep track of which responder phone is responding to each session
        ALTER TABLE sessions
        ADD COLUMN IF NOT EXISTS responded_by_phone_number TEXT;

        -- Start by assuming that every session was responded to by the client's current responder_phone_number
        UPDATE sessions
        SET responded_by_phone_number = c.responder_phone_number
        FROM sessions AS s
        LEFT JOIN BUTTONS AS B on s.button_id = b.button_id
        LEFT JOIN clients AS c on b.client_id = c.id
        WHERE sessions.id = s.id;

        -- Then clear the `responded_by_phone_number` field for all sessions that haven't been responded to or are only used by OneSignal
        UPDATE sessions
        SET responded_by_phone_number = NULL
        WHERE chatbot_state IN ('STARTED', 'WAITING_FOR_REPLY', 'RESPONDING');

        -- Re-enable the trigger so `updated_at` is updated once
        ALTER TABLE sessions
        ENABLE TRIGGER set_sessions_timestamp;

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;
