#!/usr/bin/env bash
# src/parser.c is generated from grammar.js but committed, because editors
# compile it straight from this repository. That makes a stale parser.c the
# easiest mistake to make: edit the grammar, forget to regenerate, and the
# tests pass locally against a parser nobody else will get.
set -euo pipefail
tree-sitter generate
if ! git diff --quiet -- src/; then
  echo "src/ is out of date with grammar.js. Run 'tree-sitter generate' and commit the result."
  git diff --stat -- src/
  exit 1
fi
echo "  ok       src/ matches grammar.js"
