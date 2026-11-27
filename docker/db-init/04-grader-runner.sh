#!/bin/bash
# Provisioner for one-shot grader roles. First initialization only.
# Student SQL runs as a role this login creates, not as this login.
# PostgreSQL 14 CREATEROLE can administer other non-superuser roles; keep
# this login off the student connection and do not add other login roles.
set -euo pipefail
RUNNER_USER="${GRADER_RUNNER_USER:-socoles_grader_runner}"
RUNNER_PASSWORD="${GRADER_RUNNER_PASSWORD:-}"
if [ -z "$RUNNER_PASSWORD" ]; then
  echo "grader-runner: password empty; role not created. Grading fails closed until it exists."
  exit 0
fi
if ! [[ "$RUNNER_USER" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
  echo "grader-runner: refusing role name"
  exit 1
fi
SAFE_PASS=${RUNNER_PASSWORD//\'/\'\'}
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${RUNNER_USER}') THEN
    EXECUTE format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB CREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', '${RUNNER_USER}', '${SAFE_PASS}');
  ELSE
    EXECUTE format('ALTER ROLE %I WITH NOSUPERUSER NOCREATEDB CREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', '${RUNNER_USER}', '${SAFE_PASS}');
  END IF;
END
\$\$;
REVOKE CONNECT ON DATABASE manageclass FROM ${RUNNER_USER};
REVOKE CONNECT ON DATABASE keycloak FROM ${RUNNER_USER};
GRANT CONNECT ON DATABASE grader TO ${RUNNER_USER};
SQL
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname grader <<SQL
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM ${RUNNER_USER};
REVOKE CONNECT ON DATABASE grader FROM PUBLIC;
GRANT CONNECT ON DATABASE grader TO ${RUNNER_USER} WITH GRANT OPTION;
GRANT CREATE ON DATABASE grader TO ${RUNNER_USER};
ALTER ROLE ${RUNNER_USER} SET search_path = '';
SQL
echo "grader-runner: ${RUNNER_USER} provisions one-shot roles and is not a superuser."
