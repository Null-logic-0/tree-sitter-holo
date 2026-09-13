# tree-sitter-holo

[Tree-sitter](https://tree-sitter.github.io/) grammar for **HOLO**, the template
language of the [Hologram](https://hologram.page/) Elixir framework, covering both
`~HOLO` sigils and standalone `.holo` files.

Used by the [zed-hologram](https://github.com/Null-logic-0/zed-hologram) Zed extension.
The queries live there, not here, so this repository stays editor-neutral.

## Development

```sh
tree-sitter generate                      # grammar.js -> src/parser.c
tree-sitter test                          # run test/corpus/*.txt
tree-sitter parse path/to/file.holo       # inspect a tree
./scripts/check-generated.sh              # fail if src/ is stale
./scripts/check-queries.sh <dir> [sample] # fail if a .scm no longer matches
```

`src/` is generated but committed on purpose: editors compile `src/parser.c`
directly from this repository, so a stale `src/` ships a stale parser.

## Deliberate deviations from Hologram

The grammar mirrors `Hologram.Template.Tokenizer` and `Hologram.Template.Parser`,
verified by running them. Two places differ on purpose:

- **Raw block bodies are opaque.** Hologram still parses markup inside
  `{%raw}`; we emit a single run of `raw_text`. Expressions are literal either
  way, which is what `{%raw}` exists for, and treating the body as one span
  keeps the grammar small.
- **Errors are tolerated.** Hologram raises on a bare `<` in text and on a
  dynamic tag inside a raw block. A grammar cannot raise, so those produce an
  `ERROR` node and parsing continues, which is what an editor needs.
