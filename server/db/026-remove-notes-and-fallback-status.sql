DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 26;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- ADD SCRIPT HERE

        -- Remove the notes/details column because we don't want the PII
        ALTER TABLE sessions
        DROP COLUMN IF EXISTS notes;

        -- Remove the fallback Twilio status column because we don't use it
        ALTER TABLE sessions
        DROP COLUMN IF EXISTS fallback_alert_twilio_status;

        -- Update all sessions that were waiting for notes/details to now be Completed, but disable the trigger so updated_at stays the same
        ALTER TABLE sessions
        DISABLE TRIGGER set_sessions_timestamp;

        UPDATE sessions
        SET state = 'Completed'
        WHERE state = 'Waiting for incident details';

        ALTER TABLE sessions
        ENABLE TRIGGER set_sessions_timestamp;

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;
