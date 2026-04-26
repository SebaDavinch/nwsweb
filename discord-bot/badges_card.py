import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


WIDTH = 1600
HEIGHT = 900
BG = (14, 18, 28)
PANEL = (24, 31, 46)
TEXT = (245, 247, 250)
MUTED = (159, 173, 192)


def load_font(size: int, bold: bool = False):
    candidates = [
        "arialbd.ttf" if bold else "arial.ttf",
        "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


def wrap_text(draw, text, font, max_width):
    words = str(text or "").split()
    lines = []
    current = ""
    for word in words:
        test = word if not current else f"{current} {word}"
        if draw.textlength(test, font=font) <= max_width:
            current = test
        else:
            if current:
              lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines[:3]


def parse_hex_color(value: str):
    raw = str(value or "#E31E24").strip().lstrip("#")
    if len(raw) != 6:
        raw = "E31E24"
    try:
        return tuple(int(raw[i:i + 2], 16) for i in (0, 2, 4))
    except ValueError:
        return (227, 30, 36)


def main():
    if len(sys.argv) < 3:
        raise SystemExit("Usage: badges_card.py <output> <payload_json>")

    output = Path(sys.argv[1])
    payload = json.loads(sys.argv[2])
    badges = list(payload.get("badges") or [])[:6]

    image = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(image)

    title_font = load_font(54, bold=True)
    subtitle_font = load_font(24)
    badge_title_font = load_font(26, bold=True)
    badge_desc_font = load_font(18)
    badge_meta_font = load_font(18)
    icon_font = load_font(34, bold=True)

    draw.text((80, 70), str(payload.get("title") or "Pilot Badges"), font=title_font, fill=TEXT)
    draw.text((80, 138), str(payload.get("subtitle") or "Nordwind achievement board"), font=subtitle_font, fill=MUTED)

    if not badges:
        draw.rounded_rectangle((80, 230, WIDTH - 80, 430), radius=28, fill=PANEL)
        draw.text((120, 305), "No badges earned yet", font=title_font, fill=TEXT)
        draw.text((120, 370), "Complete flights and stay active to unlock your first badge.", font=subtitle_font, fill=MUTED)
    else:
        card_width = 450
        card_height = 230
        gap_x = 40
        gap_y = 34
        start_x = 80
        start_y = 220

        for index, badge in enumerate(badges):
            col = index % 3
            row = index // 3
            x = start_x + col * (card_width + gap_x)
            y = start_y + row * (card_height + gap_y)
            color = parse_hex_color(badge.get("color"))

            draw.rounded_rectangle((x, y, x + card_width, y + card_height), radius=28, fill=PANEL)
            draw.ellipse((x + 26, y + 26, x + 118, y + 118), fill=color)
            icon_text = str(badge.get("icon") or badge.get("title") or "BD")[:4].upper()
            bbox = draw.textbbox((0, 0), icon_text, font=icon_font)
            text_w = bbox[2] - bbox[0]
            text_h = bbox[3] - bbox[1]
            draw.text((x + 72 - text_w / 2, y + 72 - text_h / 2), icon_text, font=icon_font, fill=TEXT)

            draw.text((x + 140, y + 34), str(badge.get("title") or "Badge"), font=badge_title_font, fill=TEXT)

            lines = wrap_text(draw, badge.get("description") or "", badge_desc_font, card_width - 170)
            text_y = y + 76
            for line in lines:
                draw.text((x + 140, text_y), line, font=badge_desc_font, fill=MUTED)
                text_y += 26

            awarded = str(badge.get("awardedAt") or "").replace("T", " ")[:16] or "Unknown date"
            draw.text((x + 140, y + card_height - 44), f"Awarded: {awarded}", font=badge_meta_font, fill=MUTED)

    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output, format="PNG")


if __name__ == "__main__":
    main()