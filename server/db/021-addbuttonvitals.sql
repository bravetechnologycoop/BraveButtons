DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 21;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- Create new buttons_vitals table to track RAK heartbeats and battery levels
        CREATE TABLE IF NOT EXISTS buttons_vitals (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            button_id uuid REFERENCES buttons (id) NOT NULL,
            battery_level int,
            created_at timestamptz NOT NULL DEFAULT NOW()
        );

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;
