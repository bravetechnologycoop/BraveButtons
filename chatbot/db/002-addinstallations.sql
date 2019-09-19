DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 2;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        CREATE TABLE installations (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            name text NOT NULL,
            responder_phone_number text NOT NULL,
            fall_back_phone_number text NOT NULL,
            created_at timestamptz DEFAULT NOW()
        );

        ALTER TABLE sessions ADD COLUMN installation_id uuid REFERENCES installations (id);
        ALTER TABLE registry ADD COLUMN installation_id uuid REFERENCES installations (id);

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;
