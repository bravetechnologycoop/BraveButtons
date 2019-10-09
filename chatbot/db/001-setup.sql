DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 1;

    -- Table to store the current migration state of the DB
    CREATE TABLE IF NOT EXISTS migrations (
        id INT PRIMARY KEY,
        created_at timestamptz NOT NULL DEFAULT NOW()
    );

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF lastSuccessfulMigrationId IS NULL THEN
        CREATE TABLE IF NOT EXISTS sessions (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            button_id text NOT NULL,
            unit text NOT NULL,
            phone_number text NOT NULL,
            state text NOT NULL,
            num_presses int NOT NULL,
            created_at timestamptz NOT NULL DEFAULT NOW(),
            updated_at timestamptz NOT NULL DEFAULT NOW(), 
            incident_type text,
            notes text
        );

        CREATE TABLE IF NOT EXISTS registry (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            button_id text UNIQUE NOT NULL,
            unit text NOT NULL,
            phone_number text NOT NULL,
            created_at timestamptz NOT NULL DEFAULT NOW(),
            updated_at timestamptz NOT NULL DEFAULT NOW()
        );

        CREATE OR REPLACE FUNCTION trigger_set_timestamp()
        RETURNS TRIGGER AS $t$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $t$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS set_sessions_timestamp ON sessions;

        CREATE TRIGGER set_sessions_timestamp
        BEFORE UPDATE ON sessions
        FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

        DROP TRIGGER IF EXISTS set_registry_timestamp ON registry;

        CREATE TRIGGER set_registry_timestamp
        BEFORE UPDATE ON registry
        FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;
