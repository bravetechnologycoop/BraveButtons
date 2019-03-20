CREATE TABLE installations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL,
 responder_phone_number text NOT NULL,
 fall_back_phone_number text NOT NULL,
 created_at timestamptz DEFAULT NOW()
);

INSERT INTO installations (id, name, responder_phone_number, fall_back_phone_number) VALUES ('c50591de-2b5e-4169-aa1a-9b39f245db6c', 'unspecified raincity SRO', '123', '234');

ALTER TABLE sessions ADD COLUMN installation_id uuid REFERENCES installations (id);
ALTER TABLE registry ADD COLUMN installation_id uuid REFERENCES installations (id);

UPDATE sessions SET installation_id='c50591de-2b5e-4169-aa1a-9b39f245db6c';
UPDATE registry SET installation_id='c50591de-2b5e-4169-aa1a-9b39f245db6c';

ALTER TABLE sessions ALTER COLUMN installation_id SET NOT NULL;
ALTER TABLE registry ALTER COLUMN installation_id SET NOT NULL;
