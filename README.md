# tree-sitter-holo

[Tree-sitter](https://tree-sitter.github.io/) grammar for **HOLO**, the template
language of the [Hologram](https://hologram.page/) Elixir framework
(`~HOLO` sigils and `.holo` files).

Used by the [zed-hologram](https://github.com/Null-logic-0/zed-hologram) Zed extension.

## Development

```sh
tree-sitter generate   # grammar.js -> src/parser.c
tree-sitter test       # runs test/corpus/*.txt
tree-sitter parse file.holo
```

`src/` is generated but committed: editors compile `src/parser.c` directly from this repository.
