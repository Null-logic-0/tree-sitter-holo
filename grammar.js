/**
 * @file HOLO template grammar for tree-sitter (Hologram framework)
 * @author Luka Tchelidze
 * @license GPL-3.0-or-later
 *
 * Copyright (C) 2026 Luka Tchelidze
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

// From Hologram.Template.Helpers.void_element?/1
const VOID_ELEMENTS = [
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
  "meta", "param", "source", "track", "wbr",
  "slot", "window", "document",
];

module.exports = grammar({
  name: "holo",

  // Skipped between tokens, not inside them, so text keeps its inner spaces.
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

    // Hologram evaluates expressions inside comments, so this is chunks
    // rather than one opaque token.
    comment: $ => seq(
      "<!--",
      repeat(choice($.expression, $.escape_sequence, $.comment_text)),
      "-->",
    ),

    // A lone dash can never swallow "-->": the lexer prefers the longer match.
    comment_text: $ => token(choice(/[^-{\\]+/, /-/)),

    // Elements
    element: $ => choice(
      seq($.start_tag, repeat($._node), $.end_tag),
      $.self_closing_tag,
    ),

    // Never have children or an end tag.
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

    // <div>, <my-widget>, <svg:path>
    tag_name: $ => /[a-z][a-zA-Z0-9_\-.:]*/,

    // <Badge>, <MyApp.Components.Card>
    component_name: $ => /[A-Z][a-zA-Z0-9_]*(\.[A-Z][a-zA-Z0-9_]*)*/,

    // <{@heading_tag}> ... </{@heading_tag}>
    dynamic_tag_name: $ => $.expression,

    // Control-flow blocks. Token spellings match Hologram.Template.Tokenizer:
    // "{%if" and "{%for" are open-ended, the rest are complete tokens.
    if_block: $ => seq(
      $.if_open,
      repeat($._node),
      optional($.else_branch),
      $.if_close,
    ),

    // Its own node so indents.scm has something to attach a range to.
    else_branch: $ => seq($.else_directive, repeat($._node)),

    if_open: $ => seq("{%if", optional($.expression_value), "}"),
    else_directive: _ => "{%else}",
    if_close: _ => "{/if}",

    for_block: $ => seq($.for_open, repeat($._node), $.for_close),
    for_open: $ => seq("{%for", optional($.expression_value), "}"),
    for_close: _ => "{/for}",

    // Hologram stops evaluating expressions in here, so the body is opaque.
    raw_block: $ => seq($.raw_open, repeat($.raw_text), $.raw_close),
    raw_open: _ => "{%raw}",
    raw_close: _ => "{/raw}",

    // Non-braces, or a single brace. "{/raw}" is longer so it always wins.
    raw_text: _ => token(prec(-1, choice(/[^{]+/, /\{/))),

    // <script> and <style>
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

    // Blocks still work in here, and wrapping CSS or JS in {%raw} is the
    // usual way to stop braces being read as expressions. Bodies stay
    // script text; aliased to the normal node names so queries are unaffected.
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

    // Stops at "<" so the end tag wins and at "{" so expressions are seen.
    // "${" is one token: Hologram leaves it literal, so JS template
    // literals survive.
    embedded_text: _ => token(prec(-1, choice(/[^<{$]+/, /</, /\$\{/, /\$/))),

    // Attributes
    _attribute_like: $ => choice($.attribute, $.event_attribute, $.spread),

    // class="x"   count={@n}   disabled
    attribute: $ => seq(
      $.attribute_name,
      optional(seq("=", $._attribute_value)),
    ),

    // $click="increment"   $change.debounce(300)={...}
    event_attribute: $ => seq(
      $.event_name,
      optional(seq("=", $._attribute_value)),
    ),

    // ...{@props}
    spread: $ => seq("...", $.expression),

    // Anything but whitespace and Hologram's symbol characters. Cannot start
    // with "." so it never competes with "...".
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

    // Expressions. The Elixir is not parsed here, only balanced: the editor
    // injects the real Elixir grammar into expression_value.
    expression: $ => seq("{", optional($.expression_value), "}"),

    expression_value: $ => repeat1($._expression_chunk),

    // Tracks nested braces and braces inside Elixir strings so the matching
    // "}" is found.
    _expression_chunk: $ => choice(
      /[^{}"']+/,
      $._elixir_string,
      $._elixir_charlist,
      seq("{", repeat($._expression_chunk), "}"),
    ),

    // "text #{interpolation} more", with \" escapes
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

    // \{  \}  \#  \$  \"  \'  \`  \\
    escape_sequence: $ => token(/\\[{}#$"'`\\]/),

    // Trimmed of surrounding whitespace. May contain ">" and "}" because
    // Hologram treats a stray "}" as literal, but never "<" or "{".
    text: $ => token(choice(
      /[^<{\\\s]([^<{\\]*[^<{\\\s])?/,
      /\\/,
    )),
  },
});
