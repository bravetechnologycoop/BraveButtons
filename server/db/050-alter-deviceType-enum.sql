DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 50;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN
        -- create a new enum type
        -- note: SENSOR_SINGLESTALL and SENSOR_MULTISTALL are not being used in buttons db as database merge was retracted 
        CREATE TYPE device_type_enum_new AS ENUM ('BUTTON', 'SENSOR_SINGLESTALL', 'SENSOR_MULTISTALL');

        -- add a temporary column with the new enum type
        ALTER TABLE devices ADD COLUMN device_type_new device_type_enum_new;

        -- migrate data to the new column, set existing buttons to 'BUTTON' type
        UPDATE devices
        SET device_type_new = 
            CASE 
                WHEN device_type = 'DEVICE_SENSOR' THEN 'SENSOR_SINGLESTALL'
                WHEN device_type = 'DEVICE_BUTTON' THEN 'BUTTON'
                ELSE device_type::text::device_type_enum_new
            END;

        -- drop the old column and rename the new column
        ALTER TABLE devices DROP COLUMN device_type;
        ALTER TABLE devices RENAME COLUMN device_type_new TO device_type;

        -- drop the old enum type and rename the new enum type to the original name 
        DROP TYPE device_type_enum;
        ALTER TYPE device_type_enum_new RENAME TO device_type_enum;

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;