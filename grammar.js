/**
 * @file HOLO template grammar for tree-sitter (Hologram framework)
 * @author Luka Tchelidze
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

// HTML void elements plus Hologram's own tags that never take children.
// Source: Hologram.Template.Helpers.void_element?/1
const VOID_ELEMENTS = [
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
  "meta", "param", "source", "track", "wbr",
  "slot", "window", "document",
];

module.exports = grammar({
  name: "holo",

  // Whitespace between nodes is skipped automatically. It is NOT skipped
  // inside a token, so text and expression chunks keep their inner spaces.
  extras: $ => [/\s+/],

  rules: {
    // Document structure
    document: $ => repeat($._node),

    _node: $ => choice(
      $.doctype,
      $.comment,
      $.script_element,
      $.style_element,
      $.element,
      $.void_element,
      $.if_block,
      $.for_block,
      $.raw_block,
      $.expression,
      $.escape_sequence,
      $.text,
    ),

    doctype: $ => seq(
      /<![Dd][Oo][Cc][Tt][Yy][Pp][Ee]/,
      /[^>]+/,
      ">",
    ),

    // comments are a sequence of chunks, not one opaque token.
    comment: $ => seq(
      "<!--",
      repeat(choice($.expression, $.escape_sequence, $.comment_text)),
      "-->",
    ),

    // Either a run of "safe" characters or a single dash. A single dash can
    // never swallow "-->" because the lexer prefers the longer literal.
    comment_text: $ => token(choice(/[^-{\\]+/, /-/)),

    // Elements
    element: $ => choice(
      seq($.start_tag, repeat($._node), $.end_tag),
      $.self_closing_tag,
    ),

    // <br>, <input ...>, <slot /> ... : never have children or an end tag.
    void_element: $ => seq(
      "<",
      alias(choice(...VOID_ELEMENTS), $.tag_name),
      repeat($._attribute_like),
      choice(">", "/>"),
    ),

    start_tag: $ => seq("<", $._tag_name, repeat($._attribute_like), ">"),
    self_closing_tag: $ => seq("<", $._tag_name, repeat($._attribute_like), "/>"),
    end_tag: $ => seq("</", $._tag_name, ">"),

    _tag_name: $ => choice($.tag_name, $.component_name, $.dynamic_tag_name),

    // <div>, <my-widget>, <svg:path>, <linearGradient>
    tag_name: $ => /[a-z][a-zA-Z0-9_\-.:]*/,

    // <Badge>, <MyApp.Components.Card>
    component_name: $ => /[A-Z][a-zA-Z0-9_]*(\.[A-Z][a-zA-Z0-9_]*)*/,

    // <{@heading_tag}> ... </{@heading_tag}>
    dynamic_tag_name: $ => $.expression,

    // Control-flow blocks
    // Token spellings come straight from Hologram.Template.Tokenizer:
    // "{%if" and "{%for" are open-ended, the rest are complete tokens.
    // {%if @a > 1} ... {%else} ... {/if}
    if_block: $ => seq(
      $.if_open,
      repeat($._node),
      optional($.else_branch),
      $.if_close,
    ),
    // The else half is its own node so indentation can treat it as a block
    // of its own. Without it there is nothing for a query to hang an indent
    // range on, and {%else} cannot be pulled back to the block's own level.
    else_branch: $ => seq($.else_directive, repeat($._node)),
    if_open: $ => seq("{%if", optional($.expression_value), "}"),
    else_directive: _ => "{%else}",
    if_close: _ => "{/if}",

    // {%for item <- @items} ... {/for}
    for_block: $ => seq($.for_open, repeat($._node), $.for_close),
    for_open: $ => seq("{%for", optional($.expression_value), "}"),
    for_close: _ => "{/for}",

    // {%raw} ... {/raw}: Hologram stops evaluating expressions here, so the
    // body is deliberately opaque. Markup inside is not broken into nodes.
    raw_block: $ => seq($.raw_open, repeat($.raw_text), $.raw_close),
    raw_open: _ => "{%raw}",
    raw_close: _ => "{/raw}",
    // A run of non-brace characters, or a single brace. "{/raw}" is six
    // characters, so the longest-match rule always prefers it over "{".
    raw_text: _ => token(prec(-1, choice(/[^{]+/, /\{/))),

    // ---------------------------------------------------------------
    // <script> and <style>
    // ---------------------------------------------------------------
    // Their bodies are raw text to the HTML parser, but Hologram still
    // evaluates {expressions} inside them, so the body is a mix of both.
    script_element: $ => seq(
      alias($._script_start_tag, $.start_tag),
      repeat($._embedded_node),
      alias($._script_end_tag, $.end_tag),
    ),
    style_element: $ => seq(
      alias($._style_start_tag, $.start_tag),
      repeat($._embedded_node),
      alias($._style_end_tag, $.end_tag),
    ),

    // Hologram keeps evaluating blocks inside <script> and <style>. Wrapping
    // CSS or JS in {%raw} is in fact the idiomatic way to stop braces being
    // read as expressions. These mirror the ordinary blocks but their bodies
    // stay script/style text instead of becoming markup, so they are aliased
    // back to the same node names and queries do not have to know.
    _embedded_node: $ => choice(
      alias($._embedded_if_block, $.if_block),
      alias($._embedded_for_block, $.for_block),
      $.raw_block,
      $.expression,
      $.embedded_text,
    ),

    _embedded_if_block: $ => seq(
      $.if_open,
      repeat($._embedded_node),
      optional(alias($._embedded_else_branch, $.else_branch)),
      $.if_close,
    ),
    _embedded_else_branch: $ => seq($.else_directive, repeat($._embedded_node)),
    _embedded_for_block: $ => seq($.for_open, repeat($._embedded_node), $.for_close),

    _script_start_tag: $ => seq("<", alias("script", $.tag_name), repeat($._attribute_like), ">"),
    _script_end_tag: $ => seq("</", alias("script", $.tag_name), ">"),
    _style_start_tag: $ => seq("<", alias("style", $.tag_name), repeat($._attribute_like), ">"),
    _style_end_tag: $ => seq("</", alias("style", $.tag_name), ">"),

    // Stops at "<" so the end tag wins, and at "{" so expressions are seen.
    // "${" is consumed as one two-character token: Hologram deliberately does
    // NOT treat it as an expression here, so JS template literals survive.
    embedded_text: _ => token(prec(-1, choice(/[^<{$]+/, /</, /\$\{/, /\$/))),

    // Attributes
    _attribute_like: $ => choice($.attribute, $.event_attribute, $.spread),

    // class="x"   count={@n}   disabled
    attribute: $ => seq(
      $.attribute_name,
      optional(seq("=", $._attribute_value)),
    ),

    // $click="increment"   $click.stop_propagation="x"   $change.debounce(300)={...}
    event_attribute: $ => seq(
      $.event_name,
      optional(seq("=", $._attribute_value)),
    ),

    // ...{@props}
    spread: $ => seq("...", $.expression),

    // Mirrors Hologram's tokenizer: anything except whitespace and its symbol
    // characters. May not start with "." so it never competes with "...".
    attribute_name: $ => /[^\s#$%="'`{}<>\/\\.][^\s#$%="'`{}<>\/\\]*/,
    event_name: $ => /\$[^\s#$%="'`{}<>\/\\]+/,

    _attribute_value: $ => choice($.expression, $.quoted_attribute_value),

    // "base-class {@dynamic} more"
    quoted_attribute_value: $ => seq(
      '"',
      repeat(choice($.expression, $.escape_sequence, $.attribute_text)),
      '"',
    ),
    attribute_text: $ => /[^"{\\]+/,

    // Expressions: { elixir code }
    expression: $ => seq("{", optional($.expression_value), "}"),

    expression_value: $ => repeat1($._expression_chunk),

    _expression_chunk: $ => choice(
      /[^{}"']+/,
      $._elixir_string,
      $._elixir_charlist,
      seq("{", repeat($._expression_chunk), "}"),
    ),

    // "text #{interpolation} more"  with \" escapes
    _elixir_string: $ => seq(
      '"',
      repeat(choice(
        /[^"\\#]+/,
        /\\[\s\S]/,
        "#",
        seq("#{", repeat($._expression_chunk), "}"),
      )),
      '"',
    ),

    _elixir_charlist: $ => seq(
      "'",
      repeat(choice(/[^'\\]+/, /\\[\s\S]/)),
      "'",
    ),

    // Text
    // \{  \}  \#  \$  \"  \'  \`  \\   (Hologram.Template.Tokenizer)
    escape_sequence: $ => token(/\\[{}#$"'`\\]/),

    
    text: $ => token(choice(
      /[^<{\\\s]([^<{\\]*[^<{\\\s])?/,
      /\\/,
    )),
  },
});
