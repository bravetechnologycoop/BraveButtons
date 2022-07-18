DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 34;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- ADD SCRIPT HERE
        -- Add new client extension table
        CREATE TABLE IF NOT EXISTS clients_extension (
            client_id uuid PRIMARY KEY REFERENCES clients (id),
            country text,
            country_subdivision text,
            building_type text,
            created_at timestamptz NOT NULL default now(),
            updated_at timestamptz NOT NULL default now()
        );

        -- Add a trigger to update the clients_extension.updated_at column
        CREATE OR REPLACE FUNCTION trigger_set_timestamp()
        RETURNS TRIGGER AS $t$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $t$ LANGUAGE plpgsql;

        CREATE TRIGGER set_clients_extension_timestamp
        BEFORE UPDATE ON clients_extension
        FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

        -- Add a trigger to add a row to clients_exension whenever a new row is added to clients
        CREATE OR REPLACE FUNCTION insert_clients_extension_trigger_fn()
        RETURNS TRIGGER LANGUAGE PLPGSQL AS $t$
        BEGIN
            INSERT INTO clients_extension (client_id) 
            VALUES (NEW.id)
            ON CONFLICT (client_id)
            DO NOTHING;
            RETURN NEW;
        END;
        $t$;

        CREATE TRIGGER add_clients_extension_trigger
        AFTER INSERT ON clients
        FOR EACH ROW EXECUTE PROCEDURE insert_clients_extension_trigger_fn();

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;
