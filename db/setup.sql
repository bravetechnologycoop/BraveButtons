CREATE TABLE IF NOT EXISTS sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    button_id text NOT NULL,
    unit text NOT NULL,
    phone_number text NOT NULL,
    state text NOT NULL,
    num_presses int NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(), 
    incident_type text,
    notes text
);

CREATE TABLE IF NOT EXISTS registry (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    button_id text UNIQUE NOT NULL,
    unit text NOT NULL,
    phone_number text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_sessions_timestamp
BEFORE UPDATE ON sessions
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_registry_timestamp
BEFORE UPDATE ON registry
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

