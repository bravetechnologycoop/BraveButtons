# Common parameters
PG_DATABASE="$PG_USER"
COMMON_PARAMS="-U $PG_USER -h $PG_HOST -p $PG_PORT -d $PG_DATABASE -v ON_ERROR_STOP=1 --set=sslmode=require"

# Create PostgreSQL extension
sudo PGPASSWORD="$PG_PASSWORD" psql $COMMON_PARAMS -c 'CREATE EXTENSION IF NOT EXISTS "pgcrypto"'

# Run SQL setup scripts
for file in $(ls -v db/*.sql); do
  echo "Running script $file"
  sudo PGPASSWORD="$PG_PASSWORD" psql $COMMON_PARAMS -f "./$file"
done
