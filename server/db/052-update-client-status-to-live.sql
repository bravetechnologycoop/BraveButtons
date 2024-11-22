DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 52;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN

        -- Create trigger to set the status to live if it is currently shipped and has a vital
        CREATE OR REPLACE FUNCTION client_status_live_trigger_fn()
        RETURNS TRIGGER LANGUAGE PLPGSQL AS $t$
        BEGIN
            -- Check if client is 'SHIPPED'
            IF EXISTS (
                SELECT 1
                FROM clients_extension
                WHERE client_id = NEW.client_id AND status = 'SHIPPED'
            ) THEN
                -- Check if there is a heartbeat
                IF EXISTS (
                    SELECT 1
                    FROM buttons_vitals bv
                    JOIN devices d ON bv.device_id = d.device_id
                    WHERE d.client_id = NEW.client_id
                ) THEN
                    -- Update status in clients_extension
                    UPDATE clients_extension
                    SET status = 'LIVE'
                    WHERE client_id = NEW.client_id;

                    -- Update the alerts and vitals in clients
                    UPDATE clients
                    SET is_sending_alerts = TRUE,
                        is_sending_vitals = TRUE
                    WHERE client_id = NEW.client_id;
                END IF;
            END IF;

            RETURN NEW;
        END;
        $t$;

        -- Insert the trigger
        CREATE TRIGGER client_status_live_trigger
        AFTER INSERT
        ON buttons_vitals
        FOR EACH ROW
        EXECUTE FUNCTION client_status_live_trigger_fn();

        -- Enable the trigger
        ALTER TABLE buttons_vitals ENABLE TRIGGER client_status_live_trigger;

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;