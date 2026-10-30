"""Draws the Shifokor top icons: a white eight-point star (two squares) with a red cross in the middle,
on cobalt blue. Run from the repository root: python3 tools/make_icons.py"""
import math
import os
from PIL import Image, ImageDraw

BLUE = (26, 90, 156, 255)      # #1a5a9c
WHITE = (255, 255, 255, 255)
RED = (214, 40, 40, 255)       # #d62828
SS = 4                         # supersampling for smooth edges


def mark(d, cx, cy, s):
    """Star + cross centred at (cx, cy); s = width of the star's squares."""
    w = s * 0.08                                    # star line width
    h = s / 2
    sq = [(-h, -h), (h, -h), (h, h), (-h, h)]
    for ang in (0, 45):
        a = math.radians(ang)
        pts = [(cx + x * math.cos(a) - y * math.sin(a), cy + x * math.sin(a) + y * math.cos(a)) for x, y in sq]
        d.line(pts + pts[:2], fill=WHITE, width=round(w), joint="curve")   # repeat the start so corners close cleanly
        for x, y in pts:                                                  # round outer corners
            r = w / 2
            d.ellipse([x - r, y - r, x + r, y + r], fill=WHITE)
    arm, th, edge = s * 0.52, s * 0.135, s * 0.035  # cross length, thickness, white edge
    for size, col in ((edge, WHITE), (0, RED)):
        L, T = arm / 2 + size, th / 2 + size
        rr = th * 0.12 + size
        d.rounded_rectangle([cx - L, cy - T, cx + L, cy + T], radius=rr, fill=col)
        d.rounded_rectangle([cx - T, cy - L, cx + T, cy + L], radius=rr, fill=col)


def icon(px, rounded=True, scale=0.5, background=True):
    n = px * SS
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if background:
        if rounded:
            d.rounded_rectangle([0, 0, n - 1, n - 1], radius=n * 0.2, fill=BLUE)
        else:
            d.rectangle([0, 0, n, n], fill=BLUE)
    mark(d, n / 2, n / 2, n * scale)
    return img.resize((px, px), Image.LANCZOS)


def save(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, optimize=True)


# site and installable web app
save(icon(512), "icons/icon-512.png")
save(icon(192), "icons/icon-192.png")
save(icon(64, scale=0.56), "icons/favicon-64.png")
save(icon(512, rounded=False, scale=0.38), "icons/maskable-512.png")     # content inside the 80% safe zone
save(icon(180, rounded=False, scale=0.46), "icons/apple-touch-icon.png")

# Android app: legacy launcher icons and adaptive icon foreground (108dp canvas, 66dp safe zone)
for dens, k in {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}.items():
    save(icon(round(48 * k)), f"android/res/mipmap-{dens}/ic_launcher.png")
    save(icon(round(108 * k), background=False, scale=0.36), f"android/res/mipmap-{dens}/ic_launcher_foreground.png")
print("icons ok")
