"""Ustvari ikone aplikacije (python3 tools/ikone.py). Potrebuje Pillow."""
from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'icons')
FONT = '/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf'
BG = (11, 11, 15)
ARCS = [((48, 209, 88), -90, 70), ((255, 159, 10), 80, 170), ((191, 90, 242), 180, 260)]
TRACK = (38, 38, 46)


def draw(size, scale_content=1.0):
    S = size * 4
    img = Image.new('RGB', (S, S), BG)
    d = ImageDraw.Draw(img)
    c = S / 2
    r = S * 0.33 * scale_content
    w = int(S * 0.085 * scale_content)
    box = [c - r, c - r, c + r, c + r]
    d.arc(box, 0, 360, fill=TRACK, width=w)
    for color, a0, a1 in ARCS:
        d.arc(box, a0, a1, fill=color, width=w)
        # zaobljeni konci
        import math
        for a in (a0, a1):
            rad = math.radians(a)
            x = c + (r - w / 2) * math.cos(rad)
            y = c + (r - w / 2) * math.sin(rad)
            d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=color)
    font = ImageFont.truetype(FONT, int(S * 0.30 * scale_content))
    d.text((c, c), 'T', font=font, fill=(245, 245, 247), anchor='mm')
    return img.resize((size, size), Image.LANCZOS)


os.makedirs(OUT, exist_ok=True)
draw(180).save(os.path.join(OUT, 'apple-touch-icon.png'))
draw(192).save(os.path.join(OUT, 'icon-192.png'))
draw(512).save(os.path.join(OUT, 'icon-512.png'))
draw(512, 0.8).save(os.path.join(OUT, 'icon-maskable-512.png'))
print('ok')
