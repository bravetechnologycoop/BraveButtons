DO $$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := ADD MIGRATION ID HERE;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(last_migration_id) INTO lastSuccessfulMigrationId
    FROM last_migration;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- ADD SCRIPT HERE

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO last_migration (last_migration_id)
        VALUES (migrationId);
    END IF;
END $$;
