"""Shared object builders: vessels, blobs, handles, lids, bricks, planks ... used by many topic modules.

Every builder draws INTO an Art and returns the interesting measurements so callers can add details.
"""
from __future__ import annotations

import math
from typing import Sequence

from .core import (Art, Pt, arc_back, arc_front, iso_box, n, poly_d, smooth_d, zigzag)

RY = 0.27  # apparent ellipse flatness of a horizontal circle seen from slightly above


def r_at(prof: Sequence[Pt], y: float) -> float:
    """Radius of a (y, r) profile at height y (linear)."""
    p = list(prof)
    if y <= p[0][0]:
        return p[0][1]
    for (y0, r0), (y1, r1) in zip(p, p[1:]):
        if y0 <= y <= y1:
            t = 0 if y1 == y0 else (y - y0) / (y1 - y0)
            return r0 + (r1 - r0) * t
    return p[-1][1]


def vessel(a: Art, prof: Sequence[Pt], cx: float = 50, z: int = 0, w: float | None = None, ry: float = RY,
           rim: bool = True, base: bool = True, rim_w: float | None = None, open_top: bool = True) -> dict:
    """Revolved silhouette from a top-to-bottom (y, r) profile."""
    right = [(cx + r, y) for y, r in prof]
    left = [(cx - r, y) for y, r in prof]
    a.path(smooth_d(right), z, w)
    a.path(smooth_d(left), z, w)
    ty, tr = prof[0]
    by, br = prof[-1]
    if rim:
        a.ellipse(cx, ty, tr, tr * ry, z, rim_w if rim_w is not None else w)
    if base:
        a.path(arc_front(cx, by, br, br * ry), z, w)
    return {"top": ty, "bottom": by, "tr": tr, "br": br, "cx": cx}


def band(a: Art, prof: Sequence[Pt], y: float, cx: float = 50, z: int = 3, w: float = 1.2, o: float = 0.5,
         ry: float = RY, inset: float = 0.0) -> None:
    r = r_at(prof, y) - inset
    a.path(arc_front(cx, y, r, r * ry), z, w, o)


def zig_band(a: Art, prof: Sequence[Pt], y: float, cx: float = 50, z: int = 3, w: float = 1.3, o: float | None = None,
             amp: float = 2.2, step: float = 4.4, inset: float = 2.0) -> None:
    r = r_at(prof, y) - inset
    a.poly(zigzag(cx - r, cx + r, y, amp, step), z, w, o)


def loop_handle(a: Art, side: int, cx: float, y0: float, y1: float, prof: Sequence[Pt], out: float = 9, z: int = 0,
                w: float | None = None, thick: float = 2.6) -> None:
    """D-shaped handle on the left (-1) or right (+1) of a vessel, from y0 to y1."""
    r0, r1 = r_at(prof, y0), r_at(prof, y1)
    x0, x1 = cx + side * r0, cx + side * r1
    xo = max(x0, x1) + out * side if side > 0 else min(x0, x1) + out * side
    ym = (y0 + y1) / 2
    a.path(f"M{n(x0)} {n(y0)} C{n(xo)} {n(y0 - 1)} {n(xo)} {n(y1 + 1)} {n(x1)} {n(y1)}", z, w)
    # inner edge for thickness
    xi = xo - side * thick
    a.path(f"M{n(x0 + side * 0.2)} {n(y0 + thick * 0.8)} C{n(xi)} {n(y0 + 1)} {n(xi)} {n(y1 - 1)} {n(x1 + side * 0.2)} {n(y1 - thick * 0.8)}",
           z, 1.2, 0.55)
    _ = ym


def lug(a: Art, side: int, cx: float, y: float, prof: Sequence[Pt], size: float = 4, z: int = 0, w: float | None = None) -> None:
    r = r_at(prof, y)
    x = cx + side * r
    a.path(f"M{n(x)} {n(y - size * 0.6)} Q{n(x + side * size)} {n(y - size * 0.6)} {n(x + side * size)} {n(y)} "
           f"Q{n(x + side * size)} {n(y + size * 0.6)} {n(x)} {n(y + size * 0.6)}", z, w)


def foot_ring(a: Art, cx: float, y: float, rx: float, h: float, z: int = 0, w: float | None = None) -> None:
    a.line(cx - rx, y, cx - rx - 1.5, y + h, z, w)
    a.line(cx + rx, y, cx + rx + 1.5, y + h, z, w)
    a.path(arc_front(cx, y + h, rx + 1.5, (rx + 1.5) * RY), z, w)


def blob_pts(cx: float, cy: float, rx: float, ry: float, k: int = 9, seed: int = 1, wob: float = 0.12) -> list[Pt]:
    """Deterministic lumpy closed outline (clay, dough, stone, bread...)."""
    pts: list[Pt] = []
    for i in range(k):
        t = 2 * math.pi * i / k
        j = 1 + wob * math.sin(seed * 1.7 + i * 2.3) * math.cos(seed * 0.9 + i * 1.1)
        pts.append((cx + rx * j * math.cos(t), cy + ry * j * math.sin(t)))
    return pts


def blob(a: Art, cx: float, cy: float, rx: float, ry: float, k: int = 9, seed: int = 1, wob: float = 0.12, z: int = 0,
         w: float | None = None, o: float | None = None) -> list[Pt]:
    pts = blob_pts(cx, cy, rx, ry, k, seed, wob)
    a.path(smooth_d(pts, close=True), z, w, o)
    return pts


def flame(a: Art, x: float, y: float, h: float = 9, z: int = 3, w: float = 1.4) -> None:
    """Small teardrop flame with an inner lick, base at (x,y)."""
    a.path(f"M{n(x)} {n(y)} C{n(x - h * 0.45)} {n(y - h * 0.25)} {n(x - h * 0.25)} {n(y - h * 0.7)} {n(x)} {n(y - h)} "
           f"C{n(x + h * 0.25)} {n(y - h * 0.7)} {n(x + h * 0.45)} {n(y - h * 0.25)} {n(x)} {n(y)}Z", z, w)
    a.path(f"M{n(x)} {n(y - 1)} C{n(x - h * 0.15)} {n(y - h * 0.3)} {n(x)} {n(y - h * 0.45)} {n(x)} {n(y - h * 0.6)}", z, 1.0, 0.55)


def knob(a: Art, cx: float, y: float, r: float = 2.4, z: int = 0, w: float | None = None) -> None:
    a.ellipse(cx, y, r, r * 0.8, z, w)


def disc(a: Art, cx: float, cy: float, rx: float, thick: float, z: int = 0, w: float | None = None, ry: float | None = None) -> None:
    """Thick flat disc (lid, coin, plate) seen from slightly above."""
    ry = ry if ry is not None else rx * RY
    a.ellipse(cx, cy, rx, ry, z, w)
    a.line(cx - rx, cy, cx - rx, cy + thick, z, w)
    a.line(cx + rx, cy, cx + rx, cy + thick, z, w)
    a.path(arc_front(cx, cy + thick, rx, ry), z, w)


def sparkle(a: Art, x: float, y: float, s: float = 2.6, z: int = 3, o: float = 0.7) -> None:
    a.line(x - s, y, x + s, y, z, 1.0, o)
    a.line(x, y - s, x, y + s, z, 1.0, o)


def droplet(a: Art, x: float, y: float, s: float = 3.0, z: int = 3, w: float = 1.1, o: float | None = None) -> None:
    a.path(f"M{n(x)} {n(y - s)} C{n(x + s * 0.3)} {n(y - s * 0.4)} {n(x + s * 0.8)} {n(y)} {n(x)} {n(y + s * 0.8)} "
           f"C{n(x - s * 0.8)} {n(y)} {n(x - s * 0.3)} {n(y - s * 0.4)} {n(x)} {n(y - s)}Z", z, w, o)


def bowl_prof(rim_r: float, top: float, depth: float, belly: float = 0.5, base_r: float | None = None) -> list[Pt]:
    base_r = base_r if base_r is not None else rim_r * 0.42
    return [(top, rim_r), (top + depth * 0.35, rim_r * (0.9 + 0.1 * belly)), (top + depth * 0.75, rim_r * 0.62 + base_r * 0.2),
            (top + depth, base_r)]


def plank(a: Art, x: float, y: float, w: float, h: float, d: float = 6, z: int = 0, sw: float | None = None,
          grain: int = 2) -> None:
    iso_box(a, x, y, w, h, d, z, sw)
    for k in range(grain):
        yy = y + h * (k + 1) / (grain + 1)
        a.line(x + 2, yy, x + w - 2, yy, 3, 0.9, 0.4)
