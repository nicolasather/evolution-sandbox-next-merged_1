"""Order-independent multiset recipe keys (2-5 slots, repeats preserved).

`recipe_key` is the V3 key ("recipe-v2:...") shared byte-for-byte with
lib/content/recipeKey.ts (golden fixture: tools/tests/fixtures/recipe_key_golden.json).

`legacy_key` is the key the running game already persists in saves and hint
state (`lib/processing/overlay.ts multiKey`: sorted ids joined by one space).
It is NOT replaced; `legacy_key` only mirrors it so Python tooling can compare
against the engine without touching saved data.
"""
from __future__ import annotations

import re
from typing import Iterable, Sequence

ITEM_ID_RE = re.compile(r"^[a-z][a-z0-9_]{1,63}$")
MIN_SLOTS = 2
MAX_SLOTS = 5


class RecipeKeyError(ValueError):
    """Raised with a stable machine reason code as the message."""


def _checked(ids: Sequence[str]) -> list[str]:
    if not isinstance(ids, (list, tuple)):
        raise RecipeKeyError("invalid_multiset")
    if not MIN_SLOTS <= len(ids) <= MAX_SLOTS:
        raise RecipeKeyError("recipe_arity_2_to_5")
    for x in ids:
        if not isinstance(x, str) or not ITEM_ID_RE.fullmatch(x):
            raise RecipeKeyError("invalid_item_id")
    return sorted(ids)


def recipe_key(ids: Sequence[str]) -> str:
    ordered = _checked(ids)
    return f"recipe-v2:{len(ordered)}:" + "".join(f"{len(x)}:{x}" for x in ordered)


def legacy_key(ids: Iterable[str]) -> str:
    """Same string as the engine's multiKey(ids). Sort + single-space join."""
    return " ".join(sorted(ids))


def same_recipe(a: Sequence[str], b: Sequence[str]) -> bool:
    return recipe_key(a) == recipe_key(b)
