"""Name -> drawing registry. Topic modules register one builder per catalogue item name."""
from __future__ import annotations

from typing import Callable

from .core import Art

REGISTRY: dict[str, Callable[[], Art]] = {}
TOPIC_OF: dict[str, str] = {}
_current_topic = ["?"]


def topic(name: str) -> None:
    _current_topic[0] = name


def item(name: str):
    def deco(fn: Callable[[], Art]):
        if name in REGISTRY:
            raise ValueError(f"duplicate drawing for {name!r}")
        REGISTRY[name] = fn
        TOPIC_OF[name] = _current_topic[0]
        return fn
    return deco
