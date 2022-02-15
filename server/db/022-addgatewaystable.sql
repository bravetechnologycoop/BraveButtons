DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 022;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- Add table to track the gateways
        CREATE TABLE IF NOT EXISTS gateways (
            id uuid PRIMARY KEY, -- This will be the GUID assigned by AWS
            client_id uuid REFERENCES clients (id) NOT NULL,
            display_name TEXT NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT false,
            created_at timestamptz NOT NULL DEFAULT NOW(),
            updated_at timestamptz NOT NULL DEFAULT NOW()
        );

        -- Add a trigger to update the gateways.updated_at column
        CREATE OR REPLACE FUNCTION trigger_set_timestamp()
        RETURNS TRIGGER AS $t$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $t$ LANGUAGE plpgsql;

        CREATE TRIGGER set_gateways_timestamp
        BEFORE UPDATE ON gateways
        FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

        -- Add table to track the gateway vitals
        CREATE TABLE IF NOT EXISTS gateways_vitals (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            gateway_id uuid REFERENCES gateways (id) NOT NULL,
            last_seen_at timestamptz NOT NULL,
            created_at timestamptz NOT NULL DEFAULT NOW()
        );

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;
