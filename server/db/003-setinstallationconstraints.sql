DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 3;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        ALTER TABLE sessions ALTER COLUMN installation_id SET NOT NULL;
        ALTER TABLE registry ALTER COLUMN installation_id SET NOT NULL;

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;

    EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION USING HINT = 'Make sure you have added an installation and updated registry and sessions'; 
END $migration$;
