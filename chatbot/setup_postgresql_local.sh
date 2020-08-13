sudo -u postgres psql -p $PG_PORT -c "CREATE ROLE $PG_USER PASSWORD '$PG_PASSWORD' LOGIN"
sudo -u postgres createdb -p $PG_PORT -O $PG_USER $PG_USER
sudo -u postgres psql -p $PG_PORT -d $PG_USER -c 'CREATE EXTENSION IF NOT EXISTS "pgcrypto"'

sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -h $PG_HOST -p $PG_PORT -d $PG_USER --set=sslmode=require -f ./db/001-setup.sql
sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -h $PG_HOST -p $PG_PORT -d $PG_USER --set=sslmode=require -f ./db/002-addinstallations.sql -v installationName="'$1'" -v responderPhone="'$2'" -v fallbackPhone="'$3'"
sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -h $PG_HOST -p $PG_PORT -d $PG_USER --set=sslmode=require -f ./db/003-setinstallationconstraints.sql
sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -h $PG_HOST -p $PG_PORT -d $PG_USER --set=sslmode=require -f ./db/004-addalertflag.sql
sudo PGPASSWORD=$PG_PASSWORD psql -U $PG_USER -h $PG_HOST -p $PG_PORT -d $PG_USER --set=sslmode=require -f ./db/005-addincidentcategories.sql