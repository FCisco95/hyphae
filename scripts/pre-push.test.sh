#!/bin/sh
# Tests .githooks/pre-push: which pushes run the gate. A stub pnpm records its calls, so the real
# gate never runs. Run from anywhere: sh scripts/pre-push.test.sh
set -eu

hook=$(cd "$(dirname "$0")/.." && pwd)/.githooks/pre-push
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
zero=0000000000000000000000000000000000000000

mkdir "$work/bin"
printf '#!/bin/sh\necho "$@" >> "%s/gate.log"\n' "$work" > "$work/bin/pnpm"
chmod +x "$work/bin/pnpm"

git init -q "$work/repo"
cd "$work/repo"
git config user.email t@example.com
git config user.name t
mkdir src
echo a > src/a.js
git add .
git commit -q -m code
sha=$(git rev-parse HEAD)

failures=0
# check <name> <expected: gate|skip> <stdin lines>
check() {
  name=$1
  expected=$2
  rm -f "$work/gate.log"
  printf '%s' "$3" | PATH="$work/bin:$PATH" sh "$hook" > /dev/null 2>&1
  if [ -f "$work/gate.log" ]; then got=gate; else got=skip; fi
  if [ "$got" = "$expected" ]; then
    echo "ok   $name"
  else
    echo "FAIL $name: expected $expected, got $got"
    failures=$((failures + 1))
  fi
}

ms="refs/ms/a $sha refs/ms/a $zero"
main="refs/heads/main $sha refs/heads/main $zero"

check "refs/ms only skips the gate" skip "$ms
"
check "two refs/ms refs skip the gate" skip "$ms
refs/ms/b $sha refs/ms/b $zero
"
check "refs/ms and refs/heads/main run the gate" gate "$ms
$main
"
check "refs/heads/main only runs the gate" gate "$main
"
check "no ref at all runs the gate" gate ""

[ "$failures" -eq 0 ]
