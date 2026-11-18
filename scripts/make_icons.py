#!/usr/bin/env python3
"""Draw the app icon (a simple red apple) as PNGs:
apple-touch-icon.png (180x180) and icon-512.png (512x512).
Run by the GitHub Action so no binary files need to be committed by hand.
"""
from PIL import Image, ImageDraw

BG = (255, 248, 240, 255)      # warm off-white
RED = (214, 48, 49, 255)       # apple red
RED_DARK = (178, 34, 34, 255)
GREEN = (76, 175, 80, 255)
BROWN = (121, 85, 72, 255)


def draw_apple(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # rounded-square background
    r = int(size * 0.225)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=BG)
    cx, cy = size / 2, size * 0.58
    w, h = size * 0.60, size * 0.54
    # leaf: green ellipse, rotated, upper right
    leaf = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ld = ImageDraw.Draw(leaf)
    ld.ellipse(
        [cx + w * 0.10, cy - h * 0.62, cx + w * 0.52, cy - h * 0.28],
        fill=GREEN,
    )
    leaf = leaf.rotate(-35, resample=Image.BICUBIC, center=(cx, cy - h * 0.45))
    img.alpha_composite(leaf)
    d = ImageDraw.Draw(img)
    # stem
    d.line(
        [(cx + w * 0.06, cy - h * 0.50), (cx + w * 0.14, cy - h * 0.74)],
        fill=BROWN,
        width=max(4, int(size * 0.035)),
    )
    # apple body: one ellipse
    d.ellipse([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], fill=RED)
    # bottom-right shading
    d.ellipse(
        [cx + w * 0.08, cy - h * 0.08, cx + w * 0.44, cy + h * 0.40],
        fill=RED_DARK,
    )
    # highlight, upper left
    d.ellipse(
        [cx - w * 0.34, cy - h * 0.30, cx - w * 0.10, cy - h * 0.02],
        fill=(255, 255, 255, 90),
    )
    return img


def main():
    for name, size in (("apple-touch-icon.png", 180), ("icon-512.png", 512)):
        draw_apple(size).convert("RGB").save(name, "PNG")
        print(f"Wrote {name} ({size}x{size})")


if __name__ == "__main__":
    main()
