DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 33;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- ADD SCRIPT HERE
        -- Create a new gateways_vitals_cache table with the same columns as gateways_vitals plus an updated_at column
        CREATE TABLE IF NOT EXISTS gateways_vitals_cache (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            gateway_id uuid REFERENCES gateways (id) UNIQUE NOT NULL,
            last_seen_at timestamptz NOT NULL,
            created_at timestamptz NOT NULL DEFAULT NOW(),
            updated_at timestamptz NOT NULL DEFAULT NOW()
        );

        -- Add the foreign key index onto new gateways_vitals_cache table
        CREATE INDEX IF NOT EXISTS gateways_vitals_cache_gateway_id_idx ON gateways_vitals_cache (gateway_id);

        -- Add a trigger to update the sensors_vitals_cache.updated_at column
        CREATE OR REPLACE FUNCTION trigger_set_timestamp()
        RETURNS TRIGGER AS $t$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $t$ LANGUAGE plpgsql;

        CREATE TRIGGER set_gateways_vitals_cache_timestamp
        BEFORE UPDATE ON gateways_vitals_cache
        FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

        -- Insert the most recent vitals for each button into the new gateways_vitals_cache table
        INSERT INTO gateways_vitals_cache
        SELECT a.*
        FROM (
            SELECT DISTINCT ON (g.id) gv.*
            FROM gateways_vitals AS gv
            LEFT JOIN gateways AS g ON g.id = gv.gateway_id
            ORDER BY g.id, gv.created_at DESC
        ) AS a;

        -- Add trigger to insert or update gateways_vitals_cache every time a new row is added to gateways_vitals
        CREATE OR REPLACE FUNCTION create_gateways_vitals_trigger_fn()
        RETURNS TRIGGER LANGUAGE PLPGSQL AS $t$
        BEGIN
            INSERT INTO gateways_vitals_cache (id, gateway_id, last_seen_at, created_at) 
            VALUES (NEW.id, NEW.gateway_id, NEW.last_seen_at, NEW.created_at)
            ON CONFLICT (gateway_id)
            DO UPDATE SET
                id = NEW.id,
                last_seen_at = NEW.last_seen_at,
                created_at = NEW.created_at;
            RETURN NEW;
        END;
        $t$;

        CREATE TRIGGER create_gateways_vitals_trigger
        BEFORE INSERT OR UPDATE ON gateways_vitals
        FOR EACH ROW EXECUTE PROCEDURE create_gateways_vitals_trigger_fn();

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;
