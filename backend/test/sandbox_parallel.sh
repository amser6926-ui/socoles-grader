#!/bin/bash
# Privilege test for one-shot grader roles. Local cluster only.
set -euo pipefail
PROV="${GRADER_RUNNER_USER:-socoles_grader_runner}"
PASS="${GRADER_RUNNER_PASSWORD:-sandbox-test-pass}"
export PGPASSWORD="$PASS"

sudo -u postgres psql -v ON_ERROR_STOP=1 -d postgres <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$PROV') THEN
    CREATE ROLE $PROV LOGIN NOSUPERUSER NOCREATEDB CREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '$PASS';
  ELSE
    ALTER ROLE $PROV WITH NOSUPERUSER NOCREATEDB CREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '$PASS';
  END IF;
END \$\$;
SELECT 'CREATE DATABASE grader OWNER postgres' WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'grader')\gexec
SELECT 'CREATE DATABASE manageclass OWNER postgres' WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'manageclass')\gexec
REVOKE CONNECT ON DATABASE manageclass FROM PUBLIC;
REVOKE CONNECT ON DATABASE manageclass FROM $PROV;
GRANT CONNECT ON DATABASE grader TO $PROV;
SQL

sudo -u postgres psql -v ON_ERROR_STOP=1 -d grader <<SQL
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM $PROV;
REVOKE CONNECT ON DATABASE grader FROM PUBLIC;
GRANT CONNECT ON DATABASE grader TO $PROV WITH GRANT OPTION;
GRANT CREATE ON DATABASE grader TO $PROV;
ALTER ROLE $PROV SET search_path = '';
CREATE TABLE IF NOT EXISTS public.victim (id int);
SQL

SUPER=$(sudo -u postgres psql -d grader -Atc "SELECT rolsuper::text || ',' || has_schema_privilege(current_user, 'public', 'CREATE')::text FROM pg_roles WHERE rolname = current_user;")
case "$SUPER" in
  t,*|true,*|*,t|*,true) echo "superuser fail-closed predicate would refuse: $SUPER" ;;
  *) echo "expected the admin connection to be refused, got $SUPER"; exit 1 ;;
esac

PROV_OK=$(PGHOST=127.0.0.1 psql -U "$PROV" -d grader -Atc "SELECT rolsuper::text || ',' || has_schema_privilege(current_user, 'public', 'CREATE')::text || ',' || rolcreaterole::text || ',' || current_database() FROM pg_roles WHERE rolname = current_user;")
if [ "$PROV_OK" != "f,f,t,grader" ] && [ "$PROV_OK" != "false,false,true,grader" ]; then
  echo "provisioner is not confined: $PROV_OK"
  exit 1
fi
if PGHOST=127.0.0.1 psql -U "$PROV" -d manageclass -c 'SELECT 1' >/dev/null 2>&1; then
  echo "provisioner can reach manageclass"
  exit 1
fi

psql_prov() { PGHOST=127.0.0.1 psql -U "$PROV" -d grader -v ON_ERROR_STOP=1 "$@"; }
psql_job() {
  local user="$1"
  shift
  PGHOST=127.0.0.1 PGPASSWORD="jobpass" psql -U "$user" -d grader "$@"
}

for i in $(seq 0 29); do
  ident=$(printf 's%04djob' "$i")
  psql_prov -c "DROP SCHEMA IF EXISTS \"$ident\" CASCADE" >/dev/null || true
  psql_prov -c "DROP ROLE IF EXISTS \"$ident\"" >/dev/null || true
  psql_prov -c "CREATE ROLE \"$ident\" LOGIN PASSWORD 'jobpass' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS"
  psql_prov -c "GRANT \"$ident\" TO CURRENT_USER"
  psql_prov -c "GRANT CONNECT ON DATABASE grader TO \"$ident\""
  psql_prov -c "CREATE SCHEMA \"$ident\" AUTHORIZATION \"$ident\""
  psql_job "$ident" -v ON_ERROR_STOP=1 -c "REVOKE ALL ON SCHEMA \"$ident\" FROM PUBLIC; SET search_path TO \"$ident\"; CREATE TABLE keep (id int); INSERT INTO keep VALUES ($i);" >/dev/null
done

one() {
  local i="$1"
  local ident other
  ident=$(printf 's%04djob' "$i")
  other=$(printf 's%04djob' $(( (i + 1) % 30 )))
  psql_job "$ident" -v ON_ERROR_STOP=1 -c "SET search_path TO \"$ident\"; CREATE TABLE mine (id int); INSERT INTO mine VALUES ($i);" >/dev/null
  local sql
  for sql in \
    "DROP TABLE public.victim" \
    "CREATE TABLE public.evil (id int)" \
    "DROP TABLE \"$other\".keep" \
    "DROP SCHEMA \"$other\" CASCADE" \
    "CREATE SCHEMA sneaky$i" \
    "CREATE EXTENSION IF NOT EXISTS dblink"
  do
    if psql_job "$ident" -c "$sql" >/dev/null 2>&1; then
      echo "worker $i was allowed: $sql" >&2
      return 1
    fi
  done
}

pids=()
for i in $(seq 0 29); do
  one "$i" &
  pids+=($!)
done
fail=0
for p in "${pids[@]}"; do
  wait "$p" || fail=1
done

keep=$(sudo -u postgres psql -d grader -Atc "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname LIKE 's%job' AND c.relname='keep'")
mine=$(sudo -u postgres psql -d grader -Atc "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname LIKE 's%job' AND c.relname='mine'")
victim=$(sudo -u postgres psql -d grader -Atc "SELECT count(*) FROM public.victim")
evil=$(sudo -u postgres psql -d grader -Atc "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='evil'")
sneaky=$(sudo -u postgres psql -d grader -Atc "SELECT count(*) FROM pg_namespace WHERE nspname LIKE 'sneaky%'")
if [ "$fail" != 0 ] || [ "$keep" != 30 ] || [ "$mine" != 30 ] || [ "$victim" != 0 ] || [ "$evil" != 0 ] || [ "$sneaky" != 0 ]; then
  echo "isolation failed fail=$fail keep=$keep mine=$mine victim_rows=$victim evil=$evil sneaky=$sneaky"
  exit 1
fi

for i in $(seq 0 29); do
  ident=$(printf 's%04djob' "$i")
  psql_prov -c "SET ROLE \"$ident\"; DROP SCHEMA IF EXISTS \"$ident\" CASCADE; RESET ROLE; DROP OWNED BY \"$ident\"; DROP ROLE IF EXISTS \"$ident\";" >/dev/null
done
echo "30 parallel one-shot roles passed; sibling schemas and public.victim stayed intact"
