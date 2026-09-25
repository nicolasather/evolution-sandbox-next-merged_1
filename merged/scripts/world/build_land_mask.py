#!/usr/bin/env python3
"""Step 2 of 2 — turn land polygons into the globe's land texture.

    python3 scripts/world/build_land_mask.py /tmp/land.geojson public/world/land-sdf.png

The output is an equirectangular greyscale PNG (4096 x 2048, north at the top, longitude -180 at the
left) holding a SIGNED DISTANCE to the coastline rather than a plain mask:

    128  = exactly on the coast
    > 128 = inland, up to 255 at RANGE_DEG or more inland
    < 128 = at sea, down to 0 at RANGE_DEG or more offshore

A distance field stays sharp at any zoom (the shader thresholds it), and gives the globe its soft
continental shelf and coastal glow for free. Source data: Natural Earth 1:50m land (public domain).
Requires numpy, scipy and Pillow.
"""
import json, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import distance_transform_edt

W, H = 4096, 2048
SS = 2                      # the polygons are drawn and measured at twice this size, then sampled down,
                            # so the distance is accurate to half a texel and the coast has no stair-steps
RANGE_DEG = 6.0             # distance (degrees) the 0..255 ramp covers on each side of the coast


def px(lon, lat, w, h):
    return ((lon + 180.0) / 360.0 * w, (90.0 - lat) / 180.0 * h)


def unwrap(ring):
    """Make a ring's longitudes continuous, so a shape that crosses the antimeridian is not drawn as a band across the whole map."""
    out, prev = [], None
    for lon, lat in ring:
        if prev is not None:
            while lon - prev > 180: lon -= 360
            while lon - prev < -180: lon += 360
        out.append((lon, lat)); prev = lon
    # a ring that encircles a pole ends 360 degrees from where it began: close it over the pole
    if abs(out[-1][0] - out[0][0]) > 180:
        pole = 90.0 if sum(p[1] for p in out) / len(out) > 0 else -90.0
        out += [(out[-1][0], pole), (out[0][0], pole)]
    return out


def draw_polygon(draw, rings, w, h):
    # the exterior ring is land, every following ring is a hole; draw shifted copies so a shape
    # that crosses the antimeridian appears on both edges of the map
    for i, ring in enumerate(rings):
        ring = unwrap(ring)
        for shift in (-360.0, 0.0, 360.0):
            pts = [px(lon + shift, lat, w, h) for lon, lat in ring]
            draw.polygon(pts, fill=255 if i == 0 else 0)


def main(src, dst):
    gj = json.load(open(src, encoding="utf-8"))
    geoms = []
    for f in gj["features"] if gj["type"] == "FeatureCollection" else [gj]:
        g = f.get("geometry", f)
        geoms.append(g)
    w, h = W * SS, H * SS
    img = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(img)
    for g in geoms:
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        for rings in polys:
            draw_polygon(d, rings, w, h)
    land_ss = np.asarray(img, dtype=np.uint8) >= 128

    # distances in supersampled pixels, on both sides of the coast, then to a signed ramp
    inside = distance_transform_edt(land_ss)
    outside = distance_transform_edt(~land_ss)
    signed = np.where(land_ss, inside - 0.5, -(outside - 0.5))       # supersampled pixels, + inland
    signed = signed[SS // 2::SS, SS // 2::SS]                        # sample down to the texture's size
    land = land_ss[SS // 2::SS, SS // 2::SS]
    deg_per_px = 360.0 / (W * SS)
    v = 0.5 + np.clip(signed * deg_per_px / (2.0 * RANGE_DEG), -0.5, 0.5)
    out = Image.fromarray(np.round(v * 255).astype(np.uint8), mode="L")
    out.save(dst, optimize=True)
    print("wrote", dst, out.size, "land share %.1f%%" % (100 * land.mean()))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
