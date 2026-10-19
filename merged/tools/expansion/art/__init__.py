"""exp26 expansion artwork package: one hand-composed drawing per catalogue item name."""
from __future__ import annotations

import importlib
import pkgutil

from .core import Art
from .registry import REGISTRY, TOPIC_OF


def load_all() -> None:
    for m in sorted(pkgutil.iter_modules(__path__)):  # type: ignore[name-defined]
        if m.name.startswith("t") and m.name[1:3].isdigit():
            importlib.import_module(f"{__name__}.{m.name}")


def draw(name: str) -> Art:
    return REGISTRY[name]()


__all__ = ["Art", "REGISTRY", "TOPIC_OF", "load_all", "draw"]
