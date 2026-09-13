#!/usr/bin/env bash
# src/parser.c is generated but committed, because editors compile it straight
# from this repo. Fail if it no longer matches grammar.js.
set -euo pipefail
tree-sitter generate
if ! git diff --quiet -- src/; then
  echo "src/ is out of date with grammar.js. Run 'tree-sitter generate' and commit the result."
  git diff --stat -- src/
  exit 1
fi
echo "  ok       src/ matches grammar.js"
