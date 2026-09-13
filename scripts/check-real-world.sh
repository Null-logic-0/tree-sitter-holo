#!/usr/bin/env bash
# Parse every template in the Hologram repository itself.
#
# The corpus tests check cases we thought of. This checks the ones we did not:
# it pulls every .holo file and every ~HOLO sigil body out of Hologram's own
# source and test fixtures and parses them all. It is how the "{%raw} inside
# <style>" bug was found, which the corpus had no case for.
#
# Usage: ./scripts/check-real-world.sh [path-to-hologram-checkout]
set -euo pipefail
WORK="${TMPDIR:-/tmp}/holo-real-world"
SRC="${1:-}"
if [ -z "$SRC" ]; then
  SRC="$WORK/hologram"
  [ -d "$SRC" ] || git clone -q --depth 1 https://github.com/bartblast/hologram.git "$SRC"
fi
OUT="$WORK/templates"
rm -rf "$OUT"; mkdir -p "$OUT"

python3 - "$SRC" "$OUT" <<'PY'
import re, sys, pathlib
src, out = sys.argv[1], pathlib.Path(sys.argv[2])
n = 0
for p in pathlib.Path(src).rglob("*.holo"):
    if "/deps/" in str(p) or "/_build/" in str(p): continue
    (out / str(p.relative_to(src)).replace("/", "__")).write_text(p.read_text(errors="replace")); n += 1
pat = re.compile(r'~HOLO"""\n(.*?)\n\s*"""', re.S)
s = 0
for ext in ("*.ex", "*.exs"):
    for p in pathlib.Path(src).rglob(ext):
        if "/deps/" in str(p) or "/_build/" in str(p): continue
        try: text = p.read_text(errors="replace")
        except Exception: continue
        for i, m in enumerate(pat.finditer(text)):
            lines = m.group(1).split("\n")
            ind = [len(l) - len(l.lstrip()) for l in lines if l.strip()]
            cut = min(ind) if ind else 0
            body = "\n".join(l[cut:] if len(l) >= cut else l for l in lines)
            rel = str(p.relative_to(src)).replace("/", "__").rsplit(".", 1)[0]
            (out / f"sigil__{rel}__{i}.holo").write_text(body + "\n"); s += 1
print(f"  collected {n} .holo files and {s} ~HOLO sigil bodies")
PY

fail=0; total=0
for f in "$OUT"/*.holo; do
  total=$((total + 1))
  if tree-sitter parse "$f" 2>/dev/null | grep -q "ERROR\|MISSING"; then
    fail=$((fail + 1)); echo "  ERROR    ${f##*/}"
  fi
done
echo "  parsed $((total - fail))/$total cleanly"
[ "$fail" -eq 0 ] || exit 1
