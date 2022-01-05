DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 19;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- Rename table to better match the combined schema
        ALTER TABLE installations
        RENAME TO clients;

        -- Rename columns to better match the combined schema
        ALTER TABLE clients
        RENAME COLUMN name TO display_name;

        ALTER TABLE clients
        RENAME COLUMN fall_back_phone_numbers TO fallback_phone_numbers;

        ALTER TABLE hubs
        RENAME COLUMN installation_id TO client_id;

        ALTER TABLE notifications
        RENAME COLUMN installation_id TO client_id;

        ALTER TABLE buttons
        RENAME COLUMN installation_id TO client_id;

        ALTER TABLE sessions
        RENAME COLUMN installation_id TO client_id;

        -- Add "not null" constraints to better match the combined schema
        ALTER TABLE clients
        ALTER COLUMN created_at
        SET NOT NULL;

        ALTER TABLE clients
        ALTER COLUMN is_active
        SET NOT NULL;

        -- Change default to better match the combined schema
        ALTER TABLE clients
        ALTER COLUMN is_active
        SET DEFAULT false;

        -- Add missing updated_at column
        ALTER TABLE clients
        ADD COLUMN updated_at timestamptz NOT NULL DEFAULT NOW();

        -- Add a trigger to update the locations.updated_at column
        CREATE OR REPLACE FUNCTION trigger_set_timestamp()
        RETURNS TRIGGER AS $t$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $t$ LANGUAGE plpgsql;

        CREATE TRIGGER set_clients_timestamp
        BEFORE UPDATE ON clients
        FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;
