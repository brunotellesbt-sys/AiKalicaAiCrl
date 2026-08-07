#!/usr/bin/env python3
"""Make locally hosted badge PNGs transparent (and web-sized).

Some badge PNGs from Bulbagarden include a solid white background.
This script removes ONLY the white background connected to the image edges
(flood fill), preserving internal white highlights.

The originals also vary wildly in resolution (44px up to ~760px, several of them
over half a megabyte each). Badges render inside a small 4-column grid, so we cap
the longest side at MAX_SIDE px — that keeps them sharp while shrinking the
deployed payload by roughly 10x.

It runs after scripts/download-badges.mjs, writing results in-place.
"""

from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

THRESH = 250  # near-white threshold
MAX_SIDE = 256  # badges never render larger than this


def is_bg(px):
    r, g, b, a = px
    return a > 0 and r >= THRESH and g >= THRESH and b >= THRESH


def downscale(im: Image.Image) -> tuple[Image.Image, bool]:
    """Cap the longest side at MAX_SIDE, preserving aspect ratio."""
    w, h = im.size
    longest = max(w, h)
    if longest <= MAX_SIDE:
        return im, False

    scale = MAX_SIDE / longest
    size = (max(1, round(w * scale)), max(1, round(h * scale)))
    return im.resize(size, Image.LANCZOS), True


def make_transparent(p: Path) -> bool:
    im, resized = downscale(Image.open(p).convert("RGBA"))
    w, h = im.size
    pix = im.load()

    visited = bytearray(w * h)
    q = deque()

    def push(x: int, y: int):
        idx = y * w + x
        if visited[idx]:
            return
        if is_bg(pix[x, y]):
            q.append((x, y))

    # seed with edge pixels that look like background
    for x in range(w):
        push(x, 0)
        push(x, h - 1)
    for y in range(h):
        push(0, y)
        push(w - 1, y)

    changed = False

    while q:
        x, y = q.popleft()
        idx = y * w + x
        if visited[idx]:
            continue
        visited[idx] = 1

        if not is_bg(pix[x, y]):
            continue

        r, g, b, a = pix[x, y]
        if a != 0:
            pix[x, y] = (r, g, b, 0)
            changed = True

        # 4-neighborhood
        if x > 0:
            push(x - 1, y)
        if x + 1 < w:
            push(x + 1, y)
        if y > 0:
            push(x, y - 1)
        if y + 1 < h:
            push(x, y + 1)

    if changed or resized:
        im.save(p, optimize=True)
    return changed or resized


def main() -> int:
    root = Path("src/assets/badges")
    if not root.exists():
        print("Badge folder not found (did you run download-badges.mjs?)")
        return 1

    pngs = sorted(root.rglob("*.png"))
    if not pngs:
        print("No badge PNGs found.")
        return 1

    changed = 0
    for p in pngs:
        try:
            if make_transparent(p):
                changed += 1
        except Exception as e:
            print(f"FAILED processing {p}: {e}")
            return 1

    print(f"Processed {len(pngs)} badge files. Rewrote {changed} (transparency and/or downscale).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
