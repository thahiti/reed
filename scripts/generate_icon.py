#!/usr/bin/env python3
"""Generate build/icon.icns from scratch using PIL.

Draws a white rounded-square background (macOS standard ~18% radius)
with a fountain-pen nib centered on top. Outputs all required .iconset
sizes and compiles them into build/icon.icns via `iconutil`.
"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "build"
ICONSET = BUILD / "icon.iconset"

BG = (255, 255, 255, 255)
FG = (34, 34, 34, 255)

# macOS icon standard: ~18% corner radius on a full-bleed square.
CORNER_RATIO = 0.18


def draw_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    radius = int(round(size * CORNER_RATIO))
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=BG)

    # Pen nib, designed in a 1024-unit space then scaled.
    s = size / 1024.0
    cx = 500 * s
    cy = 490 * s
    scale = 1.55 * s

    def pt(x: float, y: float) -> tuple[float, float]:
        return (cx + x * scale, cy + y * scale)

    # Nib body (pentagon outline)
    nib = [pt(-10, -200), pt(80, -200), pt(130, -20), pt(0, 160), pt(-130, -20)]
    draw.line(nib + [nib[0]], fill=FG, width=max(1, int(round(22 * scale))), joint="curve")

    # Cap rectangle (rounded)
    cap_w = int(round(120 * scale))
    cap_h = int(round(110 * scale))
    cap_x = cx + (-30) * scale
    cap_y = cy + (-300) * scale
    draw.rounded_rectangle(
        (cap_x, cap_y, cap_x + cap_w, cap_y + cap_h),
        radius=max(1, int(round(12 * scale))),
        outline=FG,
        width=max(1, int(round(22 * scale))),
    )

    # Vent circle
    vx, vy = pt(35, -20)
    vr = 26 * scale
    draw.ellipse(
        (vx - vr, vy - vr, vx + vr, vy + vr),
        outline=FG,
        width=max(1, int(round(16 * scale))),
    )

    # Slit line from vent down to tip
    draw.line([pt(35, 6), pt(0, 160)], fill=FG, width=max(1, int(round(12 * scale))))

    return img


SIZES = [
    (16, "icon_16x16.png"),
    (32, "icon_16x16@2x.png"),
    (32, "icon_32x32.png"),
    (64, "icon_32x32@2x.png"),
    (128, "icon_128x128.png"),
    (256, "icon_128x128@2x.png"),
    (256, "icon_256x256.png"),
    (512, "icon_256x256@2x.png"),
    (512, "icon_512x512.png"),
    (1024, "icon_512x512@2x.png"),
]


def main() -> None:
    if ICONSET.exists():
        shutil.rmtree(ICONSET)
    ICONSET.mkdir(parents=True)

    for size, name in SIZES:
        draw_icon(size).save(ICONSET / name, "PNG")

    out = BUILD / "icon.icns"
    subprocess.run(
        ["iconutil", "-c", "icns", str(ICONSET), "-o", str(out)],
        check=True,
    )
    shutil.rmtree(ICONSET)
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
