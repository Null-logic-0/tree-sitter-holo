# tree-sitter-holo

[Tree-sitter](https://tree-sitter.github.io/) grammar for **HOLO**, the template
language of the [Hologram](https://hologram.page/) Elixir framework
(`~HOLO` sigils and `.holo` files).

Used by the [zed-hologram](https://github.com/Null-logic-0/zed-hologram) Zed extension.

## Known deviations from Hologram

Verified against `Hologram.Template.Parser.parse_markup/1` (Hologram 0.11.1).

- **Raw block bodies are opaque.** Hologram still parses HTML tags inside
  `{%raw}...{/raw}` while suppressing expressions. This grammar treats the whole
  body as literal text. Braces stay literal either way, which is what raw blocks
  are for, so the visible difference is that tags inside a raw block are not
  highlighted.
- **`#{...}` in text splits into two nodes.** Hologram reports one expression
  covering the leading `#`; here the `#` is text and `{...}` is the expression.
  The highlighted range is effectively the same.

## Development

```sh
tree-sitter generate   # grammar.js -> src/parser.c
tree-sitter test       # runs test/corpus/*.txt
tree-sitter parse file.holo
```

`src/` is generated but committed: editors compile `src/parser.c` directly from this repository.
