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
    // ---------------------------------------------------------------
    // Document structure
    // ---------------------------------------------------------------
    document: $ => repeat($._node),

    _node: $ => choice(
      $.doctype,
      $.comment,
      $.element,
      $.void_element,
      $.expression,
      $.escape_sequence,
      $.text,
    ),

    doctype: $ => seq(
      /<![Dd][Oo][Cc][Tt][Yy][Pp][Ee]/,
      /[^>]+/,
      ">",
    ),

    // <!-- ... --> Hologram still evaluates {expressions} inside comments,
    // so comments are a sequence of chunks, not one opaque token.
    comment: $ => seq(
      "<!--",
      repeat(choice($.expression, $.escape_sequence, $.comment_text)),
      "-->",
    ),

    // Either a run of "safe" characters or a single dash. A single dash can
    // never swallow "-->" because the lexer prefers the longer literal.
    comment_text: $ => token(choice(/[^-{\\]+/, /-/)),

    // ---------------------------------------------------------------
    // Elements
    // ---------------------------------------------------------------
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

    // ---------------------------------------------------------------
    // Attributes
    // ---------------------------------------------------------------
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

    // ---------------------------------------------------------------
    // Expressions: { elixir code }
    // ---------------------------------------------------------------
    // The Elixir code is not parsed here; Zed injects the real Elixir grammar
    // into expression_value. This grammar only has to find the matching "}",
    // which means tracking nested braces and braces inside Elixir strings.
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

    // ---------------------------------------------------------------
    // Text
    // ---------------------------------------------------------------
    // \{  \}  \#  \$  \"  \'  \`  \\   (Hologram.Template.Tokenizer)
    escape_sequence: $ => token(/\\[{}#$"'`\\]/),

    // A run of text trimmed of surrounding whitespace, or a lone backslash
    // that is not part of an escape. Text may contain ">" and "}" (Hologram
    // treats a stray "}" as literal) but never "<" or "{".
    text: $ => token(choice(
      /[^<{\\\s]([^<{\\]*[^<{\\\s])?/,
      /\\/,
    )),
  },
});
