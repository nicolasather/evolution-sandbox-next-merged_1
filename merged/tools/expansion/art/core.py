"""Tiny drawing kit that emits plate-art markup in the exact grammar of data/art.json.

Output = SVG *inner* markup for a 100x100 box: `<g data-z="N">` depth layers, `currentColor`
strokes inherited from the wrapper, hairline detail at reduced opacity, `fill="currentColor"`
accent dots only. lib/plate3d.ts samples every shape, so geometry must stay in the whitelisted
element set (path, line, circle, ellipse, rect, polyline, polygon, g).

Depth convention taken from the 918 hand-drawn plates (measured): z 0 body, 3 / 6 detail,
-4 ground + shadow, 8..10 secondary object.
"""
from __future__ import annotations

import math
from typing import Iterable, Sequence

Pt = tuple[float, float]


def n(v: float) -> str:
    """Compact number: 1 decimal, no trailing zeros."""
    s = f"{v:.1f}"
    if s.endswith(".0"):
        s = s[:-2]
    if s == "-0":
        s = "0"
    return s


def _attrs(w: float | None, o: float | None, extra: str = "") -> str:
    a = ""
    if w is not None:
        a += f' stroke-width="{n(w) if w != int(w) else int(w)}"'
    if o is not None:
        a += f' opacity="{o:g}"'
    if extra:
        a += " " + extra
    return a


class Art:
    """A drawing = {z: [element, ...]}. Emission sorts layers by z so output is deterministic."""

    def __init__(self) -> None:
        self.layers: dict[int, list[str]] = {}

    # ---------------------------------------------------------------- basic shapes
    def add(self, z: int, el: str) -> "Art":
        self.layers.setdefault(z, []).append(el)
        return self

    def path(self, d: str, z: int = 0, w: float | None = None, o: float | None = None, extra: str = "") -> "Art":
        return self.add(z, f'<path d="{d}"{_attrs(w, o, extra)}/>')

    def line(self, x1: float, y1: float, x2: float, y2: float, z: int = 0, w: float | None = None, o: float | None = None) -> "Art":
        return self.add(z, f'<line x1="{n(x1)}" y1="{n(y1)}" x2="{n(x2)}" y2="{n(y2)}"{_attrs(w, o)}/>')

    def poly(self, pts: Sequence[Pt], z: int = 0, w: float | None = None, o: float | None = None, close: bool = False) -> "Art":
        tag = "polygon" if close else "polyline"
        s = " ".join(f"{n(x)} {n(y)}" for x, y in pts)
        return self.add(z, f'<{tag} points="{s}"{_attrs(w, o)}/>')

    def circle(self, cx: float, cy: float, r: float, z: int = 0, w: float | None = None, o: float | None = None) -> "Art":
        return self.add(z, f'<circle cx="{n(cx)}" cy="{n(cy)}" r="{n(r)}"{_attrs(w, o)}/>')

    def ellipse(self, cx: float, cy: float, rx: float, ry: float, z: int = 0, w: float | None = None, o: float | None = None, rot: float = 0) -> "Art":
        tr = f'transform="rotate({n(rot)} {n(cx)} {n(cy)})"' if rot else ""
        return self.add(z, f'<ellipse cx="{n(cx)}" cy="{n(cy)}" rx="{n(rx)}" ry="{n(ry)}"{_attrs(w, o, tr)}/>')

    def rect(self, x: float, y: float, w_: float, h: float, z: int = 0, w: float | None = None, o: float | None = None, rx: float = 0) -> "Art":
        r = f' rx="{n(rx)}"' if rx else ""
        return self.add(z, f'<rect x="{n(x)}" y="{n(y)}" width="{n(w_)}" height="{n(h)}"{r}{_attrs(w, o)}/>')

    def dot(self, cx: float, cy: float, r: float = 1.2, z: int = 3, o: float | None = None) -> "Art":
        op = f' opacity="{o:g}"' if o is not None else ""
        return self.add(z, f'<circle cx="{n(cx)}" cy="{n(cy)}" r="{n(r)}" fill="currentColor" stroke="none"{op}/>')

    def dots(self, pts: Iterable[Pt], r: float = 1.0, z: int = 3, o: float | None = None) -> "Art":
        for x, y in pts:
            self.dot(x, y, r, z, o)
        return self

    # ---------------------------------------------------------------- composite helpers
    def ground(self, y: float = 86, x0: float = 10, x1: float = 90, z: int = -4, o: float = 0.4) -> "Art":
        """The thin ground line + tiny tick every plate carries."""
        self.line(x0, y, x1, y, z, 1.2, o)
        mx = (x0 + x1) / 2
        self.line(mx - 4, y + 5, mx + 4, y + 5, z, 0.9, o * 0.7)
        return self

    def shadow(self, cx: float, y: float, rx: float, ry: float = 3, z: int = -4, o: float = 0.35) -> "Art":
        return self.ellipse(cx, y, rx, ry, z, 1.1, o)

    def hatch(self, x0: float, y0: float, x1: float, y1: float, step: float = 3.5, slope: float = 1.0,
              z: int = 3, w: float = 0.9, o: float = 0.4) -> "Art":
        """Diagonal hatching clipped to a rectangle by construction (lines are trimmed analytically)."""
        w_, h_ = x1 - x0, y1 - y0
        k = -h_ * slope
        t = k
        while t < w_:
            xa, ya = x0 + t, y1
            xb, yb = x0 + t + h_ * slope, y0
            # clip to rect
            pts = clip_seg(xa, ya, xb, yb, x0, y0, x1, y1)
            if pts:
                self.line(*pts, z=z, w=w, o=o)
            t += step
        return self

    # ---------------------------------------------------------------- emit
    def markup(self) -> str:
        out = []
        for z in sorted(self.layers, key=lambda k: (k != 0, k)):  # body layer first, then ascending
            out.append(f'<g data-z="{z}">' + "".join(self.layers[z]) + "</g>")
        return "".join(out)


# -------------------------------------------------------------------------- geometry helpers
def clip_seg(x1: float, y1: float, x2: float, y2: float, xmin: float, ymin: float, xmax: float, ymax: float):
    """Liang–Barsky clip of a segment to a rectangle."""
    dx, dy = x2 - x1, y2 - y1
    p = [-dx, dx, -dy, dy]
    q = [x1 - xmin, xmax - x1, y1 - ymin, ymax - y1]
    u1, u2 = 0.0, 1.0
    for pi, qi in zip(p, q):
        if pi == 0:
            if qi < 0:
                return None
        else:
            t = qi / pi
            if pi < 0:
                u1 = max(u1, t)
            else:
                u2 = min(u2, t)
    if u1 > u2:
        return None
    return (x1 + u1 * dx, y1 + u1 * dy, x1 + u2 * dx, y1 + u2 * dy)


def poly_d(pts: Sequence[Pt], close: bool = False) -> str:
    d = "M" + " L".join(f"{n(x)} {n(y)}" for x, y in pts)
    return d + ("Z" if close else "")


def smooth_d(pts: Sequence[Pt], close: bool = False, tension: float = 0.5) -> str:
    """Catmull-Rom -> cubic Bezier through every point (organic silhouettes)."""
    p = list(pts)
    if len(p) < 3:
        return poly_d(p, close)
    d = f"M{n(p[0][0])} {n(p[0][1])}"
    m = len(p)
    rng = range(m) if close else range(m - 1)
    for i in rng:
        p0 = p[(i - 1) % m] if (close or i > 0) else p[i]
        p1 = p[i]
        p2 = p[(i + 1) % m]
        p3 = p[(i + 2) % m] if (close or i + 2 < m) else p2
        c1 = (p1[0] + (p2[0] - p0[0]) * tension / 3 * 2 / 2 * 1.0, p1[1] + (p2[1] - p0[1]) * tension / 3 * 2 / 2 * 1.0)
        c2 = (p2[0] - (p3[0] - p1[0]) * tension / 3 * 2 / 2 * 1.0, p2[1] - (p3[1] - p1[1]) * tension / 3 * 2 / 2 * 1.0)
        d += f" C{n(c1[0])} {n(c1[1])} {n(c2[0])} {n(c2[1])} {n(p2[0])} {n(p2[1])}"
    return d + ("Z" if close else "")


def arc_front(cx: float, y: float, rx: float, ry: float) -> str:
    """Lower (front) half of a horizontal ellipse: a band seen from slightly above."""
    return f"M{n(cx - rx)} {n(y)} A{n(rx)} {n(ry)} 0 0 0 {n(cx + rx)} {n(y)}"


def arc_back(cx: float, y: float, rx: float, ry: float) -> str:
    return f"M{n(cx - rx)} {n(y)} A{n(rx)} {n(ry)} 0 0 1 {n(cx + rx)} {n(y)}"


def rot(p: Pt, a_deg: float, c: Pt = (50, 50)) -> Pt:
    a = math.radians(a_deg)
    dx, dy = p[0] - c[0], p[1] - c[1]
    return (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))


def lerp(a: Pt, b: Pt, t: float) -> Pt:
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def zigzag(x0: float, x1: float, y: float, amp: float = 2.4, step: float = 4.4) -> list[Pt]:
    pts, x, up = [], x0, True
    while x <= x1 + 1e-6:
        pts.append((x, y - amp if up else y + amp))
        x += step
        up = not up
    return pts


def wave_d(x0: float, x1: float, y: float, amp: float = 2.0, period: float = 8.0) -> str:
    d = f"M{n(x0)} {n(y)}"
    x = x0
    s = -1
    while x < x1 - 1e-6:
        xe = min(x + period / 2, x1)
        d += f" Q{n((x + xe) / 2)} {n(y + s * amp * 2)} {n(xe)} {n(y)}"
        x = xe
        s = -s
    return d


# ---------------------------------------------------------------------- 3D-ish primitives
def iso_box(a: Art, x: float, y: float, w: float, h: float, d: float, z: int = 0, sw: float | None = None,
            top_o: float | None = None, wl: float | None = None) -> Art:
    """Oblique box: front face (x,y,w,h), depth d going up-right. Draws all visible edges."""
    dx, dy = d * 0.7, -d * 0.45
    # front
    a.rect(x, y, w, h, z, sw)
    # top
    a.poly([(x, y), (x + dx, y + dy), (x + w + dx, y + dy), (x + w, y)], z, sw, close=False)
    # right
    a.poly([(x + w, y), (x + w + dx, y + dy), (x + w + dx, y + h + dy), (x + w, y + h)], z, sw)
    return a


def cylinder(a: Art, cx: float, y_top: float, rx: float, h: float, ry: float | None = None, z: int = 0,
             w: float | None = None, bottom_hidden: bool = True) -> Art:
    ry = ry if ry is not None else rx * 0.28
    a.ellipse(cx, y_top, rx, ry, z, w)
    a.line(cx - rx, y_top, cx - rx, y_top + h, z, w)
    a.line(cx + rx, y_top, cx + rx, y_top + h, z, w)
    a.path(arc_front(cx, y_top + h, rx, ry), z, w)
    return a


def gear_d(cx: float, cy: float, r_out: float, r_in: float, teeth: int, phase: float = 0.0) -> str:
    pts: list[Pt] = []
    for i in range(teeth):
        a0 = phase + i * 2 * math.pi / teeth
        step = 2 * math.pi / teeth
        for frac, r in ((0.0, r_in), (0.2, r_out), (0.5, r_out), (0.7, r_in)):
            a_ = a0 + frac * step
            pts.append((cx + r * math.cos(a_), cy + r * math.sin(a_)))
    return poly_d(pts, True)


def spokes(a: Art, cx: float, cy: float, r_in: float, r_out: float, count: int, z: int = 0, w: float | None = 1.4,
           o: float | None = None, phase: float = 0.0) -> Art:
    for i in range(count):
        t = phase + i * 2 * math.pi / count
        a.line(cx + r_in * math.cos(t), cy + r_in * math.sin(t), cx + r_out * math.cos(t), cy + r_out * math.sin(t), z, w, o)
    return a


def ring_dots(a: Art, cx: float, cy: float, r: float, count: int, rad: float = 1.0, z: int = 3, phase: float = 0.0) -> Art:
    for i in range(count):
        t = phase + i * 2 * math.pi / count
        a.dot(cx + r * math.cos(t), cy + r * math.sin(t), rad, z)
    return a


def arrow(a: Art, x1: float, y1: float, x2: float, y2: float, z: int = 3, w: float = 1.3, o: float | None = None, head: float = 3.2) -> Art:
    a.line(x1, y1, x2, y2, z, w, o)
    ang = math.atan2(y2 - y1, x2 - x1)
    for s in (-1, 1):
        a.line(x2, y2, x2 - head * math.cos(ang + s * 0.5), y2 - head * math.sin(ang + s * 0.5), z, w, o)
    return a


def basket_weave(a: Art, x0: float, y0: float, x1: float, y1: float, step: float = 4.0, z: int = 3, w: float = 0.9,
                 o: float = 0.45) -> Art:
    """Over-under weave texture: alternating short dashes on a grid."""
    r = 0
    y = y0
    while y < y1 - 1e-6:
        x = x0 + (step / 2 if r % 2 else 0)
        while x < x1 - 1e-6:
            xe = min(x + step * 0.8, x1)
            a.line(x, y, xe, y, z, w, o)
            x += step
        y += step * 0.75
        r += 1
    return a
