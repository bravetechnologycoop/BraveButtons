sudo -u postgres psql -p $PG_PORT -c "CREATE ROLE $PG_USER PASSWORD '$PG_PASSWORD' LOGIN"
sudo -u postgres createdb -p $PG_PORT -O $PG_USER $PG_USER
sudo -u postgres psql -p $PG_PORT -d $PG_USER -c 'CREATE EXTENSION IF NOT EXISTS "pgcrypto"'
./setup_postgresql.sh 'MyInstallation' '+12223334444' '+19998887777'