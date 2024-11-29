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
                FROM clients
                WHERE client_id = NEW.client_id AND status = 'SHIPPED'
            ) AND EXISTS ( -- Check if there is a Heartbeat
                    SELECT 1
                    FROM gateways_vitals gv
                    JOIN gateways g ON gv.gateway_id = g.gateway_id
                    WHERE g.client_id = NEW.client_id
                ) THEN
                    -- Update status, alerts and vitals in clients
                    UPDATE clients
                    SET status = 'LIVE',
                        is_sending_alerts = TRUE,
                        is_sending_vitals = TRUE,
                        operational_at = NOW(),
                    WHERE client_id = NEW.client_id;
                END IF;
            END IF;

            RETURN NEW;
        END;
        $t$;

        -- Insert the trigger
        CREATE TRIGGER client_status_live_trigger
        AFTER INSERT
        ON gateways_vitals
        FOR EACH ROW
        EXECUTE FUNCTION client_status_live_trigger_fn();

        -- Enable the trigger
        ALTER TABLE gateways_vitals ENABLE TRIGGER client_status_live_trigger;

        -- Update the migration ID of the last file to be successfully run to the migration ID of this file
        INSERT INTO migrations (id)
        VALUES (migrationId);
    END IF;
END $migration$;