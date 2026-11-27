#!/bin/bash
# Concurrent insert of one draw. The first stored variant and five ids stay put.
set -euo pipefail
if ! sudo -u postgres psql -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname = 'drawtest'" | grep -q 1; then
  sudo -u postgres psql -d postgres -c "CREATE DATABASE drawtest" >/dev/null
fi
sudo -u postgres psql -v ON_ERROR_STOP=1 -d drawtest <<'SQL'
DROP TABLE IF EXISTS assignment_draws;
CREATE TABLE assignment_draws (
  assignment_id uuid NOT NULL,
  student text NOT NULL,
  variant_id uuid NOT NULL,
  question_ids uuid[] NOT NULL,
  owner_id uuid NOT NULL,
  UNIQUE (assignment_id, student, owner_id)
);
SQL

ASSIGN='11111111-1111-1111-1111-111111111111'
OWNER='22222222-2222-2222-2222-222222222222'
VA='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
VB='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
ids() { python3 - <<'PY'
import uuid
print("{" + ",".join(str(uuid.uuid4()) for _ in range(5)) + "}")
PY
}

insert_one() {
  local student="$1" variant="$2" qids="$3"
  sudo -u postgres psql -d drawtest -v ON_ERROR_STOP=1 -c \
    "INSERT INTO assignment_draws (assignment_id, student, variant_id, question_ids, owner_id)
     VALUES ('$ASSIGN', '$student', '$variant', '$qids'::uuid[], '$OWNER')
     ON CONFLICT (assignment_id, student, owner_id) DO NOTHING;" >/dev/null
}

A1=$(ids); A2=$(ids)
pids=()
for n in $(seq 1 20); do
  if (( n % 2 )); then insert_one student1 "$VA" "$A1" & else insert_one student1 "$VB" "$A2" & fi
  pids+=($!)
done
for p in "${pids[@]}"; do wait "$p"; done

rows=$(sudo -u postgres psql -d drawtest -Atc "SELECT count(*) FROM assignment_draws WHERE student='student1'")
stored=$(sudo -u postgres psql -d drawtest -Atc "SELECT variant_id || '|' || array_length(question_ids,1) FROM assignment_draws WHERE student='student1'")
before=$(sudo -u postgres psql -d drawtest -Atc "SELECT variant_id || '|' || question_ids::text FROM assignment_draws WHERE student='student1'")
insert_one student1 "$VB" "$A2"
after=$(sudo -u postgres psql -d drawtest -Atc "SELECT variant_id || '|' || question_ids::text FROM assignment_draws WHERE student='student1'")
if [ "$rows" != 1 ]; then echo "expected one draw, got $rows"; exit 1; fi
case "$stored" in
  "$VA|5"|"$VB|5") ;;
  *) echo "unexpected stored draw $stored"; exit 1 ;;
esac
if [ "$before" != "$after" ]; then
  echo "draw changed after the second request"; exit 1
fi

B1=$(ids)
insert_one student2 "$VA" "$B1"
overlap=$(sudo -u postgres psql -d drawtest -Atc "SELECT count(*) FROM assignment_draws d1 JOIN assignment_draws d2 ON d1.student <> d2.student AND d1.question_ids && d2.question_ids")
echo "draw persistence passed (one stable row, 5 ids, second student stored; overlap count $overlap)"
