#!/usr/bin/env bash
# Every Zed query must still match the grammar. Renaming or removing a node
# in grammar.js silently breaks a query, and Zed only reports it at runtime,
# so this check belongs in CI next to the corpus tests.
set -uo pipefail
QUERY_DIR="${1:?usage: check-queries.sh <dir-with-scm-files> [sample.holo]}"
SAMPLE="${2:-test/samples/kitchen-sink.holo}"
status=0
for q in "$QUERY_DIR"/*.scm; do
  [ -e "$q" ] || continue
  if err=$(tree-sitter query "$q" "$SAMPLE" 2>&1 >/dev/null); then
    echo "  ok       $(basename "$q")"
  else
    echo "  FAILED   $(basename "$q")"
    echo "$err" | sed 's/^/           /' | head -5
    status=1
  fi
done
exit $status
