"""Fibre / textile primitives: twisted strands, braids, meshes, weave textures, spindles."""
from __future__ import annotations

import math
from typing import Sequence

from .core import Art, Pt, n, poly_d, smooth_d


def sine_pts(x0: float, x1: float, cy: float, amp: float, period: float, phase: float = 0.0, steps: int = 0) -> list[Pt]:
    steps = steps or max(8, int((x1 - x0) / 2.2))
    return [(x0 + (x1 - x0) * i / steps, cy + amp * math.sin(2 * math.pi * (x0 + (x1 - x0) * i / steps - x0) / period + phase))
            for i in range(steps + 1)]


def sine_path(a: Art, x0: float, x1: float, cy: float, amp: float, period: float, phase: float = 0.0, z: int = 0,
              w: float | None = None, o: float | None = None) -> None:
    a.path(smooth_d(sine_pts(x0, x1, cy, amp, period, phase)), z, w, o)


def strands_h(a: Art, x0: float, x1: float, cy: float, r: float, plies: int, pitch: float = 16, z: int = 0,
              w: float | None = None) -> None:
    """Horizontal twisted rope: `plies` phase-shifted strands crossing each other."""
    for k in range(plies):
        ph = 2 * math.pi * k / plies
        sine_path(a, x0, x1, cy, r, pitch, ph, z, w if k == 0 else (w if w else None), None if k % 2 == 0 else 0.85)


def twist_marks(a: Art, x0: float, x1: float, cy: float, r: float, pitch: float, z: int = 3, w: float = 1.1,
                o: float = 0.55) -> None:
    x = x0
    while x < x1 - pitch * 0.5:
        a.path(f"M{n(x)} {n(cy + r)} Q{n(x + pitch * 0.3)} {n(cy)} {n(x + pitch * 0.6)} {n(cy - r)}", z, w, o)
        x += pitch


def rope_outline(a: Art, x0: float, x1: float, cy: float, r: float, z: int = 0, w: float | None = None,
                 round_end: bool = True) -> None:
    a.line(x0, cy - r, x1, cy - r, z, w)
    a.line(x0, cy + r, x1, cy + r, z, w)
    if round_end:
        a.path(f"M{n(x1)} {n(cy - r)} A{n(r * 0.45)} {n(r)} 0 0 1 {n(x1)} {n(cy + r)}", z, w)
        a.path(f"M{n(x1)} {n(cy - r)} A{n(r * 0.45)} {n(r)} 0 0 0 {n(x1)} {n(cy + r)}", z, w, 0.5)


def chevron_braid(a: Art, x0: float, x1: float, cy: float, r: float, step: float = 6, z: int = 0, w: float | None = 1.5) -> None:
    """Three-strand flat braid drawn as stacked chevrons between two edge lines."""
    a.line(x0, cy - r, x1, cy - r, z, w)
    a.line(x0, cy + r, x1, cy + r, z, w)
    x = x0
    while x < x1 - step:
        a.poly([(x, cy - r), (x + step * 0.5, cy), (x, cy + r)], 3, 1.2, 0.8)
        x += step


def diamond_mesh(a: Art, x0: float, y0: float, x1: float, y1: float, cell: float = 9, z: int = 0, w: float | None = 1.3,
                 o: float | None = None, knots: bool = False) -> None:
    """Diamond-mesh net clipped (by construction) to the rectangle; lines run at +-45 deg."""
    from .core import clip_seg
    k = (y1 - y0) + (x1 - x0)
    t = -(y1 - y0)
    while t < (x1 - x0):
        for sx, sy, ex, ey in ((x0 + t, y0, x0 + t + (y1 - y0), y1), (x0 + t, y1, x0 + t + (y1 - y0), y0)):
            seg = clip_seg(sx, sy, ex, ey, x0, y0, x1, y1)
            if seg:
                a.line(*seg, z=z, w=w, o=o)
        t += cell
    if knots:
        t = 0.0
        rowy = y0
        r_ = 0
        while rowy <= y1:
            xx = x0 + (cell / 2 if r_ % 2 else 0)
            while xx <= x1:
                a.dot(xx, rowy, 0.9, 3)
                xx += cell
            rowy += cell / 2
            r_ += 1


def square_mesh(a: Art, x0: float, y0: float, x1: float, y1: float, cell: float = 8, z: int = 0, w: float | None = 1.2,
                o: float | None = None) -> None:
    x = x0
    while x <= x1 + 1e-6:
        a.line(x, y0, x, y1, z, w, o)
        x += cell
    y = y0
    while y <= y1 + 1e-6:
        a.line(x0, y, x1, y, z, w, o)
        y += cell


def wrap_turns(a: Art, x: float, y0: float, y1: float, r: float, turns: int, z: int = 6, w: float = 1.6, o: float | None = None,
               slant: float = 3) -> None:
    """Cord turns around a vertical pole at x between y0..y1 (slanted bands)."""
    for i in range(turns):
        y = y0 + (y1 - y0) * i / max(1, turns - 1)
        a.line(x - r, y, x + r, y - slant, z, w, o)


def spindle(a: Art, x: float, y: float, length: float = 50, z: int = 0, w: float | None = None, tilt: float = 0.0) -> None:
    """Drop spindle: shaft + whorl disc; drawn vertically with whorl at 1/3 from the bottom."""
    a.line(x, y, x, y + length, z, w)
    a.ellipse(x, y + length * 0.68, 9, 2.6, z, w)
    a.path(f"M{n(x - 9)} {n(y + length * 0.68)} Q{n(x)} {n(y + length * 0.68 + 6)} {n(x + 9)} {n(y + length * 0.68)}", z, w)
    a.line(x, y, x - 2, y - 4, z, w)


def weave_grid(a: Art, x0: float, y0: float, x1: float, y1: float, step: float = 3.4, z: int = 3, w: float = 0.9,
               o: float = 0.5, kind: str = "plain") -> None:
    """Fabric texture as alternating horizontal / vertical dashes, emitted as ONE path per direction
    (keeps the art within the element budget). Step is widened automatically so a plate never exceeds ~130 cells."""
    cols = max(1, int((x1 - x0) / step))
    rows = max(1, int((y1 - y0) / step))
    while cols * rows > 130:
        step *= 1.15
        cols = max(1, int((x1 - x0) / step))
        rows = max(1, int((y1 - y0) / step))
    hd: list[str] = []
    vd: list[str] = []
    for r in range(rows):
        y = y0 + r * step
        for c in range(cols):
            x = x0 + c * step
            if kind == "plain":
                over = (r + c) % 2 == 0
            elif kind == "basket":
                over = (r // 2 + c // 2) % 2 == 0
            else:
                over = (c + r) % 3 != 0
            if over:
                hd.append(f"M{n(x)} {n(y)}h{n(step * 0.8)}")
            else:
                vd.append(f"M{n(x + step * 0.4)} {n(y - step * 0.4)}v{n(step * 0.8)}")
    if hd:
        a.path("".join(hd), z, w, o)
    if vd:
        a.path("".join(vd), z, w, o)


def knot(a: Art, x: float, y: float, r: float = 2.6, z: int = 3, w: float = 1.4) -> None:
    a.circle(x, y, r, z, w)
    a.line(x - r, y - r * 0.2, x + r, y + r * 0.2, z, 1.0, 0.7)
