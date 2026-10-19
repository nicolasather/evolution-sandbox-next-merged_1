"""Tiny drawing kit for the EXP28 plates (100x100 frame, stroke-only, data-z depth layers).

Every function returns a string; `layer(z, *parts)` wraps parts in <g data-z="z">.  Nothing here draws a fixed
shape: objects are composed per item in the batch files.  Numbers are rounded to 1 decimal.
"""
from __future__ import annotations

import math


def f(v: float) -> str:
    s = f"{v:.1f}"
    return s[:-2] if s.endswith(".0") else s


def _st(w=None, o=None, extra: str = "") -> str:
    out = ""
    if w is not None:
        out += f' stroke-width="{f(w)}"'
    if o is not None:
        out += f' opacity="{o if isinstance(o, str) else (("%.2f" % o).lstrip("0") if o < 1 else "1")}"'
    return out + extra


def line(x1, y1, x2, y2, w=None, o=None):
    return f'<line x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}"{_st(w, o)}/>'


def circle(cx, cy, r, w=None, o=None, fill=False):
    return f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}"{_st(w, o, " fill=\"currentColor\"" if fill else "")}/>'


def ellipse(cx, cy, rx, ry, w=None, o=None):
    return f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx)}" ry="{f(ry)}"{_st(w, o)}/>'


def rect(x, y, w_, h, w=None, o=None):
    return f'<rect x="{f(x)}" y="{f(y)}" width="{f(w_)}" height="{f(h)}"{_st(w, o)}/>'


def path(d, w=None, o=None):
    return f'<path d="{d}"{_st(w, o)}/>'


def poly(pts, w=None, o=None, closed=False):
    tag = "polygon" if closed else "polyline"
    return f'<{tag} points="{" ".join(f(a) + " " + f(b) for a, b in pts)}"{_st(w, o)}/>'


def layer(z: int, *parts) -> str:
    return f'<g data-z="{z}">' + "".join(p for p in parts if p) + "</g>"


def pol(cx, cy, r, deg):
    a = math.radians(deg)
    return cx + r * math.cos(a), cy + r * math.sin(a)


def radial(cx, cy, r0, r1, deg, w=None, o=None):
    x0, y0 = pol(cx, cy, r0, deg)
    x1, y1 = pol(cx, cy, r1, deg)
    return line(x0, y0, x1, y1, w, o)


def ticks(cx, cy, r0, r1, a0, a1, n, w=None, o=None):
    """n+1 radial ticks from angle a0 to a1 (degrees)."""
    return "".join(radial(cx, cy, r0, r1, a0 + (a1 - a0) * i / n, w, o) for i in range(n + 1))


def arc(cx, cy, r, a0, a1, w=None, o=None):
    x0, y0 = pol(cx, cy, r, a0)
    x1, y1 = pol(cx, cy, r, a1)
    large = 1 if abs(a1 - a0) > 180 else 0
    sweep = 1 if a1 > a0 else 0
    return path(f"M{f(x0)} {f(y0)} A{f(r)} {f(r)} 0 {large} {sweep} {f(x1)} {f(y1)}", w, o)


def gear(cx, cy, r_in, r_out, teeth, w=None, o=None, phase=0.0):
    """Toothed wheel outline as one polygon (trapezoid teeth)."""
    pts = []
    step = 360.0 / teeth
    for i in range(teeth):
        a = phase + i * step
        pts += [pol(cx, cy, r_in, a), pol(cx, cy, r_out, a + step * 0.18), pol(cx, cy, r_out, a + step * 0.5),
                pol(cx, cy, r_in, a + step * 0.68)]
    return poly(pts, w, o, closed=True)


def spokes(cx, cy, r0, r1, n, phase=0.0, w=None, o=None):
    return "".join(radial(cx, cy, r0, r1, phase + 360.0 * i / n, w, o) for i in range(n))
