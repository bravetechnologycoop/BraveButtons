CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    unit int NOT NULL,
    phone_number text NOT NULL,
    state text NOT NULL,
    num_presses int NOT NULL,
    responded_to boolean NOT NULL DEFAULT FALSE,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL, 
    incident_type text,
    notes text
);

CREATE TABLE IF NOT EXISTS registry (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    button_id text UNIQUE NOT NULL,
    unit text NOT NULL,
    phone_number text NOT NULL
);
