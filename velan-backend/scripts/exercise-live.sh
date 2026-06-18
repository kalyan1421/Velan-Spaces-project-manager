#!/usr/bin/env bash
# Boots the backend against the live Supabase project and exercises every role
# flow + RBAC rule, asserting expected HTTP statuses. Requires a seeded demo
# cast (scripts/seed.ts + scripts/seed-demo.ts) and a populated .env.
set -uo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a
BASE="http://localhost:${PORT:-3000}/api/v1"
PW="ChangeMe123!"
SFX=$RANDOM   # unique project codes so the script is re-runnable

node dist/main.js > /tmp/velan_exercise.log 2>&1 &
APP=$!
trap 'kill $APP 2>/dev/null' EXIT
for i in $(seq 1 40); do curl -sf "$BASE/health" >/dev/null 2>&1 && break; sleep 0.5; done

PASS=0; FAIL=0
expect() { if [ "$2" = "$3" ]; then echo "  ✓ $1 ($3)"; PASS=$((PASS+1)); else echo "  ✗ $1 (expected $2, got $3)"; FAIL=$((FAIL+1)); fi; }
login() { curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$1\",\"password\":\"$PW\"}" | python3 -c "import sys,json;print(json.load(sys.stdin).get('accessToken',''))"; }
status() { local m=$1 p=$2 t=$3 b=${4:-}; if [ -n "$b" ]; then curl -s -o /dev/null -w '%{http_code}' -X "$m" "$BASE$p" -H "Authorization: Bearer $t" -H 'Content-Type: application/json' -d "$b"; else curl -s -o /dev/null -w '%{http_code}' -X "$m" "$BASE$p" -H "Authorization: Bearer $t"; fi; }
body()   { local m=$1 p=$2 t=$3 b=${4:-}; if [ -n "$b" ]; then curl -s -X "$m" "$BASE$p" -H "Authorization: Bearer $t" -H 'Content-Type: application/json' -d "$b"; else curl -s -X "$m" "$BASE$p" -H "Authorization: Bearer $t"; fi; }

echo "== Logins =="
HEAD=$(login head@velanspaces.com); MGR=$(login manager@velanspaces.com)
WRK=$(login worker@velanspaces.com); CLI=$(login client@velanspaces.com)
for v in HEAD:$HEAD MGR:$MGR WRK:$WRK CLI:$CLI; do
  n=${v%%:*}; t=${v#*:}; [ -n "$t" ] && echo "  ✓ $n token" && PASS=$((PASS+1)) || { echo "  ✗ $n login"; FAIL=$((FAIL+1)); }
done

PID=$(body GET /projects "$HEAD" | python3 -c "import sys,json;d=json.load(sys.stdin);print(next(p['id'] for p in d if p['project_code']=='VS-DEMO-001'))")
echo "  demo project id: $PID"

echo "== head =="
expect "head lists projects"            200 "$(status GET /projects "$HEAD")"
# NOTE: build JSON in vars first — nesting \" inside "$(...)" mangles the body.
BODY_P2="{\"projectCode\":\"VS-T2-$SFX\",\"projectName\":\"Second Project\"}"
BODY_P3="{\"projectCode\":\"VS-T3-$SFX\",\"projectName\":\"Third\"}"
P2=$(body POST /projects "$HEAD" "$BODY_P2" | python3 -c "import sys,json;print(json.load(sys.stdin).get('id',''))")
expect "head created a project"         201 "$(status POST /projects "$HEAD" "$BODY_P3")"
expect "head lists staff"               200 "$(status GET /staff "$HEAD")"

echo "== manager (budget access) =="
expect "manager reads demo project"     200 "$(status GET /projects/$PID "$MGR")"
S0=$(body GET /projects/$PID/budget/summary "$MGR" | python3 -c "import sys,json;print(json.load(sys.stdin).get('current_spend') or 0)")
expect "manager adds debit 1000"        201 "$(status POST /projects/$PID/budget/transactions "$MGR" '{"type":"debit","amount":1000,"description":"materials"}')"
expect "manager adds debit 500"         201 "$(status POST /projects/$PID/budget/transactions "$MGR" '{"type":"debit","amount":500}')"
expect "manager adds credit 200"        201 "$(status POST /projects/$PID/budget/transactions "$MGR" '{"type":"credit","amount":200}')"
S1=$(body GET /projects/$PID/budget/summary "$MGR" | python3 -c "import sys,json;print(json.load(sys.stdin).get('current_spend') or 0)")
DELTA=$(python3 -c "print(int(round(float('$S1')-float('$S0'))))")
expect "spend delta = 1300 (debit-credit)" 1300 "$DELTA"
expect "manager creates room"           201 "$(status POST /projects/$PID/rooms "$MGR" '{"name":"Living Room"}')"

echo "== worker =="
expect "worker reads demo project"      200 "$(status GET /projects/$PID "$WRK")"
expect "worker BLOCKED from budget"     403 "$(status GET /projects/$PID/budget/transactions "$WRK")"
expect "worker BLOCKED from staff"      403 "$(status GET /staff "$WRK")"
expect "worker posts internal update"   201 "$(status POST /projects/$PID/updates "$WRK" '{"content":"poured foundation","isClientViewable":false,"mediaUrls":["update-images/a.jpg"]}')"
expect "worker posts client update"     201 "$(status POST /projects/$PID/updates "$WRK" '{"content":"tiles done","isClientViewable":true}')"
expect "worker BLOCKED from 2nd project" 403 "$(status GET /projects/$P2 "$WRK")"

echo "== client =="
expect "client reads demo project"      200 "$(status GET /projects/$PID "$CLI")"
expect "client BLOCKED from budget"     403 "$(status GET /projects/$PID/budget/transactions "$CLI")"
expect "client BLOCKED from staff"      403 "$(status GET /staff "$CLI")"
CVIS=$(body GET /projects/$PID/updates "$CLI" | python3 -c "import sys,json;d=json.load(sys.stdin);print(all(u['is_client_viewable'] for u in d), len(d))")
echo "  client updates (all client-viewable?, count): $CVIS"
expect "client files complaint"         201 "$(status POST /projects/$PID/complaints "$CLI" '{"title":"AC not working"}')"

echo "== notifications (complaint fan-out) =="
sleep 1
HN=$(body GET /notifications "$HEAD" | python3 -c "import sys,json;d=json.load(sys.stdin);print(sum(1 for n in d if n.get('type')=='complaint'))")
echo "  head complaint notifications: $HN"; [ "${HN:-0}" -ge 1 ] && { echo "  ✓ head notified of complaint"; PASS=$((PASS+1)); } || { echo "  ✗ head not notified"; FAIL=$((FAIL+1)); }

echo "== unauth =="
expect "no token -> 401"                401 "$(status GET /projects "")"

echo ""
echo "RESULT: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
