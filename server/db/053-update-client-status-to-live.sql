DO $migration$
    DECLARE migrationId INT;
    DECLARE lastSuccessfulMigrationId INT;
BEGIN
    -- The migration ID of this file
    migrationId := 53;

    -- Get the migration ID of the last file to be successfully run
    SELECT MAX(id) INTO lastSuccessfulMigrationId
    FROM migrations;

    -- Only execute this script if its migration ID is next after the last successful migration ID
    IF migrationId - lastSuccessfulMigrationId = 1 THEN

        -- Delete the create_buttons_vitals_trigger trigger
        DROP TRIGGER IF EXISTS client_status_live_trigger ON gateways_vitals;

        -- Create trigger to set the status to live if it is currently shipped and has a vital
        CREATE OR REPLACE FUNCTION client_status_live_trigger_fn()
        RETURNS TRIGGER LANGUAGE PLPGSQL AS $t$
        BEGIN
            -- Fetch the client_id from the gateways table
            IF EXISTS (
                SELECT 1
                FROM clients c
                JOIN gateways g ON c.id = g.client_id
                WHERE g.id = NEW.gateway_id AND c.status = 'SHIPPED'
            )
            THEN
                -- Check if there is a Heartbeat
                IF EXISTS (
                    SELECT 1
                    FROM gateways_vitals gv
                    JOIN gateways g ON gv.gateway_id = g.id
                    WHERE g.client_id = (
                        SELECT client_id
                        FROM gateways
                        WHERE id = NEW.gateway_id
                    )
                )
                THEN
                    -- Update status, alerts, and vitals in clients
                    UPDATE clients
                    SET status = 'LIVE',
                        is_sending_alerts = TRUE,
                        is_sending_vitals = TRUE,
                        commissioned_at = NOW()
                    WHERE id = (
                        SELECT client_id
                        FROM gateways
                        WHERE id = NEW.gateway_id
                    );
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