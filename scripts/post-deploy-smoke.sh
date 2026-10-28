#!/bin/bash
# Black-box smoke against a running Ante Mortem. Usage: ./post-deploy-smoke.sh https://api.antemortem.example
set -u
BASE="${1:-http://localhost:8000}"; fail=0
chk() { local want="$1" path="$2"; got=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$path");
        if [ "$got" = "$want" ]; then echo "✓ $path → $got"; else echo "✗ $path → $got (want $want)"; fail=1; fi; }
chk 200 /api/health/live/
chk 200 /api/health/ready/
chk 200 /cemetery/
chk 401 /api/me
chk 404 /cemetery/definitely-not-a-handle
chk 404 /c/not-a-token
chk 404 /api/c/not-a-token
exit $fail
