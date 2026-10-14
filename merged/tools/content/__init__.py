"""Verified-content pipeline (Logic-First V3, Phase 1).

Editors supply real item names + sourced facts. Claude Code derives ONE primary
recipe per publishable item at build time; this package validates, freezes and
publishes it. Nothing here calls a network service.
"""

COMPILER_VERSION = "anchor-compiler-1"
RULES_VERSION = "craft-rules-1"
