"""Topic 40 - software and interfaces (25)."""
from __future__ import annotations

import math

from .core import Art, arrow, n
from .kit import sparkle
from .registry import item, topic

topic("software and interfaces")


def screen(a, x=14, y=16, w=72, h=52, z=0, bar=True):
    a.rect(x, y, w, h, z, 2.6, None, 3)
    a.rect(x + 4, y + 4, w - 8, h - 8, 3, 1.0, 0.55)
    a.line(x + w / 2 - 12, y + h + 8, x + w / 2 + 12, y + h + 8, z, 2.4)
    a.line(x + w / 2, y + h, x + w / 2, y + h + 8, z, 2.2)


def prompt(a, x, y, s=1.0, z=6):
    a.path(f"M{x} {y} L{x + 6 * s} {y + 4 * s} L{x} {y + 8 * s}", z, 1.8)
    a.line(x + 9 * s, y + 8 * s, x + 18 * s, y + 8 * s, z, 1.8)


def text_lines(a, x, y, widths, step=7, z=6, w=1.6, o=None):
    for i, ww in enumerate(widths):
        a.line(x, y + i * step, x + ww, y + i * step, z, w, o)


def window(a, x, y, w, h, z=0, title=True):
    a.rect(x, y, w, h, z, 2.2)
    if title:
        a.line(x, y + 6, x + w, y + 6, z, 1.6)
        a.circle(x + 4, y + 3, 1, 6, 1.0)


def grid_px(a, x, y, cols, rows, s=5, z=3, fill=((1, 1),)):
    for r in range(rows):
        for c in range(cols):
            if (c + r) % 2 == 0:
                a.rect(x + c * s, y + r * s, s, s, z, 1.0, 0.7)


def table(a, x, y, w, h, cols=3, rows=4, z=0):
    a.rect(x, y, w, h, z, 2.4)
    for i in range(1, cols):
        a.line(x + w * i / cols, y, x + w * i / cols, y + h, 3, 1.2, 0.7)
    for j in range(1, rows):
        a.line(x, y + h * j / rows, x + w, y + h * j / rows, 3, 1.2, 0.7)
    a.line(x, y + h / rows, x + w, y + h / rows, z, 2.0)


def agent_head(a, cx, cy, r=10, z=0):
    a.rect(cx - r, cy - r, 2 * r, 2 * r, z, 2.4, None, 3)
    a.circle(cx - r * 0.4, cy - r * 0.1, 1.8, 6, 1.4)
    a.circle(cx + r * 0.4, cy - r * 0.1, 1.8, 6, 1.4)
    a.line(cx - r * 0.4, cy + r * 0.45, cx + r * 0.4, cy + r * 0.45, 6, 1.4)
    a.line(cx, cy - r, cx, cy - r - 6, z, 1.8)
    a.circle(cx, cy - r - 7, 1.6, z, 1.4)


@item("Software Development Toolkit")
def _():
    a = Art()
    window(a, 12, 18, 44, 34, 0)
    text_lines(a, 18, 32, (24, 16, 28), 6, 6, 1.4)
    a.path("M64 24 L88 24 L88 40 L64 40 Z", 0, 2.2)
    a.path("M70 32 L82 32", 3, 1.0, 0.6)
    a.circle(30, 72, 8, 0, 2.2)
    a.path("M26 72 L34 72 M30 68 L30 76", 6, 1.4)
    a.rect(50, 60, 38, 18, 0, 2.2)
    a.path("M54 70 L84 70", 3, 1.0, 0.5)
    a.ground(90)
    return a


@item("Command Interpreter")
def _():
    a = Art()
    window(a, 14, 20, 72, 52, 0)
    prompt(a, 22, 34, 1.0)
    prompt(a, 22, 50, 1.0)
    a.rect(44, 52, 4, 8, 6, 1.4)
    a.path("M22 66 L50 66", 3, 1.0, 0.5)
    a.ground(86)
    return a


@item("Command Line Shell")
def _():
    a = Art()
    screen(a, 14, 16, 72, 52, 0)
    prompt(a, 22, 28, 1.0)
    text_lines(a, 40, 30, (30, 20), 8, 6, 1.4, 0.8)
    prompt(a, 22, 50, 1.0)
    a.rect(44, 50, 4, 8, 6, 1.4)
    a.ground(92)
    return a


@item("Scriptable Command Shell")
def _():
    a = Art()
    window(a, 12, 18, 76, 54, 0)
    prompt(a, 18, 28, 0.9)
    a.path("M40 30 L60 30", 6, 1.6)
    a.path("M20 42 L24 42 L24 52 L20 52 M44 42 L40 42 L40 52 L44 52", 6, 1.6)
    text_lines(a, 28, 44, (8, 4, 8), 4, 3, 1.2, 0.7)
    arrow(a, 52, 48, 78, 48, 3, 1.3, 0.8)
    a.path("M20 64 L80 64", 3, 1.0, 0.5)
    a.ground(86)
    return a


@item("Integrated Developer Terminal")
def _():
    a = Art()
    window(a, 10, 14, 80, 62, 0)
    a.line(32, 20, 32, 76, 3, 1.2, 0.7)
    text_lines(a, 36, 28, (40, 28, 36), 6, 6, 1.4)
    a.rect(14, 26, 14, 4, 3, 1.2, 0.7)
    a.rect(14, 36, 14, 4, 3, 1.2, 0.7)
    a.line(32, 56, 90, 56, 0, 2.0)
    prompt(a, 38, 62, 0.8)
    a.ground(86)
    return a


@item("Bitmap Drawing Routine")
def _():
    a = Art()
    grid_px(a, 24, 24, 10, 10, 5, 3)
    a.rect(24, 24, 50, 50, 0, 2.6)
    a.path("M30 62 L40 40 L50 56 L60 34 L70 52", 6, 2.0)
    a.ground(86)
    return a


@item("Raster Graphics Editor")
def _():
    a = Art()
    window(a, 12, 18, 76, 56, 0)
    a.rect(16, 28, 10, 40, 3, 1.4, 0.8)
    for i in range(4):
        a.circle(21, 34 + i * 9, 2, 3, 1.1, 0.8)
    a.rect(32, 28, 50, 40, 0, 2.0)
    a.path("M38 60 L50 42 L60 54 L66 46 L76 60", 6, 1.8)
    a.circle(70, 36, 3.4, 6, 1.4)
    a.ground(86)
    return a


@item("Layered Image Editor")
def _():
    a = Art()
    window(a, 10, 18, 56, 52, 0)
    a.rect(16, 30, 44, 34, 3, 1.4, 0.8)
    a.path("M22 56 L34 40 L44 52 L54 38", 6, 1.8)
    for i in range(3):
        a.rect(70, 24 + i * 16, 20, 12, 0 if i == 0 else 3, 2.0 if i == 0 else 1.4, None if i == 0 else 0.85)
        a.circle(74, 30 + i * 16, 1.4, 6, 1.1)
    a.ground(86)
    return a


@item("Non Destructive Graphics Editor")
def _():
    a = Art()
    window(a, 10, 18, 56, 52, 0)
    a.rect(16, 30, 44, 34, 3, 1.4, 0.8)
    a.path("M22 56 L34 40 L44 52 L54 38", 6, 1.8)
    a.rect(70, 24, 20, 12, 0, 2.0)
    a.path("M72 40 L88 40 L88 52 L72 52 Z", 3, 1.4, 0.8)
    a.path("M74 46 L84 46", 3, 1.0, 0.5)
    a.path("M74 62 Q80 54 86 62", 6, 1.6)
    a.path("M70 66 L90 66 L90 72", 3, 1.0, 0.5)
    arrow(a, 80, 74, 70, 74, 3, 1.2, 0.8)
    return a


@item("Simple Data File")
def _():
    a = Art()
    a.path("M26 14 L60 14 L74 28 L74 86 L26 86 Z", 0, 2.6)
    a.path("M60 14 L60 28 L74 28", 3, 1.6, 0.8)
    text_lines(a, 34, 40, (32, 24, 32, 18), 9, 6, 1.6)
    a.ground(94)
    return a


@item("Indexed Data File")
def _():
    a = Art()
    a.path("M30 14 L60 14 L72 26 L72 86 L30 86 Z", 0, 2.6)
    a.rect(12, 26, 14, 50, 0, 2.2)
    for i in range(5):
        a.line(14, 32 + i * 9, 24, 32 + i * 9, 3, 1.2, 0.8)
    text_lines(a, 38, 38, (28, 22, 28, 20), 9, 6, 1.6)
    arrow(a, 26, 41, 36, 41, 3, 1.2, 0.8)
    return a


@item("Relational Data Table")
def _():
    a = Art()
    table(a, 10, 26, 40, 40, 2, 4, 0)
    table(a, 56, 40, 34, 34, 2, 3, 0)
    a.path("M50 36 L56 48", 6, 1.6)
    a.circle(50, 36, 2, 6, 1.4)
    a.circle(56, 48, 2, 6, 1.4)
    a.ground(86)
    return a


@item("Transactional Data Store")
def _():
    a = Art()
    a.path("M26 28 A24 8 0 0 1 74 28 L74 70 A24 8 0 0 1 26 70 Z", 0, 2.6)
    a.path("M26 28 A24 8 0 0 0 74 28", 3, 1.4, 0.8)
    a.path("M26 48 A24 8 0 0 0 74 48", 3, 1.4, 0.8)
    arrow(a, 12, 40, 24, 40, 6, 1.6)
    arrow(a, 88, 58, 76, 58, 6, 1.6)
    a.path("M40 18 L46 14 L52 18", 3, 1.2, 0.7)
    return a


@item("Character Display Routine")
def _():
    a = Art()
    a.rect(14, 24, 72, 48, 0, 2.6)
    for r in range(3):
        for c in range(7):
            a.rect(20 + c * 9, 30 + r * 12, 6, 8, 3, 1.2, 0.8)
    a.rect(20, 66, 6, 3, 6, 1.6)
    a.ground(88)
    return a


@item("Text User Interface")
def _():
    a = Art()
    a.rect(12, 16, 76, 60, 0, 2.6)
    a.rect(18, 22, 64, 8, 6, 1.6)
    a.path("M22 26 L40 26", 3, 1.2, 0.8)
    a.rect(18, 36, 28, 32, 0, 1.8)
    text_lines(a, 22, 44, (18, 14, 18), 8, 3, 1.4, 0.8)
    a.rect(52, 36, 30, 20, 6, 1.8)
    a.rect(56, 62, 14, 6, 6, 1.6)
    a.ground(86)
    return a


@item("Windowed User Interface")
def _():
    a = Art()
    window(a, 10, 18, 54, 42, 0)
    window(a, 36, 38, 54, 42, 6)
    a.path("M16 32 L40 32 M16 40 L34 40", 3, 1.2, 0.7)
    a.path("M42 56 L84 56 M42 64 L70 64", 3, 1.2, 0.7)
    a.ground(90)
    return a


@item("Accessible Graphical Interface")
def _():
    a = Art()
    window(a, 10, 16, 80, 58, 0)
    a.circle(50, 38, 4, 6, 1.6)
    a.path("M36 48 L50 46 L64 48 M50 46 L50 58 M50 58 L42 68 M50 58 L58 68", 6, 1.8)
    a.rect(16, 24, 16, 8, 3, 1.4, 0.8)
    a.rect(68, 24, 16, 8, 3, 1.4, 0.8)
    a.path("M16 68 L34 68 M66 68 L84 68", 3, 1.4, 0.7)
    return a


@item("Rule Based Agent")
def _():
    a = Art()
    agent_head(a, 28, 50, 12, 0)
    a.rect(52, 22, 34, 14, 0, 2.0)
    a.rect(52, 42, 34, 14, 0, 2.0)
    a.rect(52, 62, 34, 14, 0, 2.0)
    a.path("M40 48 L52 29 M40 52 L52 49 M40 56 L52 69", 3, 1.2, 0.8)
    a.path("M56 29 L72 29 M56 49 L70 49 M56 69 L74 69", 3, 1.2, 0.6)
    return a


@item("Finite State Game Agent")
def _():
    a = Art()
    a.circle(22, 30, 10, 0, 2.4)
    a.circle(76, 30, 10, 0, 2.4)
    a.circle(50, 72, 10, 0, 2.4)
    arrow(a, 32, 30, 66, 30, 3, 1.5)
    arrow(a, 72, 40, 58, 64, 3, 1.5)
    arrow(a, 42, 66, 26, 40, 3, 1.5)
    a.path("M10 26 Q4 24 6 36 Q8 40 14 38", 3, 1.2, 0.8)
    a.circle(22, 30, 3, 6, 1.4)
    return a


@item("Behavior Tree Game Agent")
def _():
    a = Art()
    a.rect(40, 12, 20, 12, 0, 2.2)
    for x in (22, 50, 78):
        a.rect(x - 9, 40, 18, 12, 0, 2.0)
        a.path(f"M50 24 L50 32 L{x} 32 L{x} 40", 3, 1.4, 0.8)
    for x in (14, 30, 50, 70, 86):
        a.circle(x, 74, 5, 6, 1.6)
    a.path("M22 52 L22 62 L14 62 L14 69 M22 62 L30 62 L30 69 M50 52 L50 69 M78 52 L78 62 L70 62 L70 69 M78 62 L86 62 L86 69", 3, 1.2, 0.8)
    return a


@item("Utility Driven Game Agent")
def _():
    a = Art()
    agent_head(a, 24, 52, 11, 0)
    for i, h in enumerate((18, 34, 24)):
        a.rect(48 + i * 14, 76 - h, 10, h, 0, 2.2)
    a.line(44, 76, 92, 76, 0, 2.0)
    a.path("M52 28 L90 28", 3, 1.0, 0.5)
    a.path("M54 28 L54 34 M68 28 L68 34 M82 28 L82 34", 3, 1.2, 0.7)
    a.circle(68, 50, 3, 6, 1.6)
    return a


@item("Frame Animation Loop")
def _():
    a = Art()
    for i in range(3):
        a.rect(12 + i * 26, 38, 22, 24, 0, 2.2)
        a.circle(23 + i * 26, 50 - 4 + i * 4, 4, 6, 1.6)
    a.path("M20 26 Q50 8 80 26", 3, 1.6, 0.8)
    a.path("M76 20 L80 26 L72 26", 3, 1.6, 0.8)
    a.ground(76)
    return a


@item("Sprite Animation System")
def _():
    a = Art()
    a.rect(14, 24, 72, 26, 0, 2.4)
    for i in range(4):
        if i < 3:
            a.line(14 + (i + 1) * 18, 24, 14 + (i + 1) * 18, 50, 3, 1.2, 0.7)
        a.circle(23 + i * 18, 37, 4, 6, 1.4)
    a.rect(34, 58, 32, 22, 0, 2.4)
    a.circle(50, 69, 5, 6, 1.6)
    arrow(a, 50, 52, 50, 58, 3, 1.3, 0.8)
    return a


@item("Skeleton Animation System")
def _():
    a = Art()
    a.circle(50, 20, 7, 0, 2.4)
    a.path("M50 27 L50 54 M50 34 L32 46 L26 64 M50 34 L68 46 L74 64 M50 54 L38 72 L34 88 M50 54 L62 72 L66 88", 0, 2.4)
    for p in ((50, 34), (32, 46), (68, 46), (50, 54), (38, 72), (62, 72)):
        a.circle(p[0], p[1], 2.4, 6, 1.6)
    a.path("M84 36 Q92 50 84 64", 3, 1.2, 0.7)
    return a


@item("Real Time Scene Animation")
def _():
    a = Art()
    a.path("M12 70 L50 44 L88 70 L50 90 Z", 0, 2.4)
    a.path("M30 62 L30 38 L44 32 L44 56 Z", 0, 2.2)
    a.circle(68, 44, 8, 0, 2.2)
    a.path("M12 24 L40 24 M56 22 L88 22", 3, 1.2, 0.6)
    arrow(a, 52, 60, 76, 64, 6, 1.4)
    a.circle(76, 64, 2, 6, 1.4)
    return a
