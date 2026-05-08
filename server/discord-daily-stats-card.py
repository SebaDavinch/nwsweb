import json
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont


CARD_WIDTH = 1280
CARD_HEIGHT = 720
ACCENT_RED = (227, 30, 36, 255)
ACCENT_GOLD = (245, 158, 11, 255)
PANEL_DARK = (9, 12, 18, 220)
TEXT_PRIMARY = (248, 250, 252, 255)
TEXT_MUTED = (203, 213, 225, 255)
TEXT_SOFT = (148, 163, 184, 255)


def load_payload(payload_text):
    try:
        return json.loads(payload_text)
    except Exception:
        return {}


def load_font(size, bold=False):
    candidates = []
    if os.name == "nt":
        candidates.extend(
            [
                "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
                "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
            ]
        )
    else:
        candidates.extend(
            [
                "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
                if bold
                else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf"
                if bold
                else "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
            ]
        )

    for candidate in candidates:
        if os.path.exists(candidate):
            try:
                return ImageFont.truetype(candidate, size=size)
            except Exception:
                pass

    return ImageFont.load_default()


def create_gradient_background():
    image = Image.new("RGBA", (CARD_WIDTH, CARD_HEIGHT), (8, 10, 15, 255))
    pixels = image.load()
    for y in range(CARD_HEIGHT):
        ratio = y / max(1, CARD_HEIGHT - 1)
        red = int(8 + 24 * ratio)
        green = int(10 + 20 * ratio)
        blue = int(16 + 54 * ratio)
        for x in range(CARD_WIDTH):
            pixels[x, y] = (red, green, blue, 255)
    return image


def cover_image(image, width, height):
    src_w, src_h = image.size
    scale = max(width / max(1, src_w), height / max(1, src_h))
    resized = image.resize(
        (max(1, int(src_w * scale)), max(1, int(src_h * scale))),
        Image.Resampling.LANCZOS,
    )
    left = max(0, (resized.width - width) // 2)
    top = max(0, (resized.height - height) // 2)
    return resized.crop((left, top, left + width, top + height))


def load_background(path):
    if path and os.path.exists(path):
        try:
            image = Image.open(path).convert("RGBA")
            return cover_image(image, CARD_WIDTH, CARD_HEIGHT)
        except Exception:
            pass
    return create_gradient_background()


def load_logo(path):
    if path and os.path.exists(path):
        try:
            return Image.open(path).convert("RGBA")
        except Exception:
            return None
    return None


def draw_metric_card(draw, rect, label, value, label_font, value_font):
    left, top, right, bottom = rect
    draw.rounded_rectangle(
        rect,
        radius=28,
        fill=(255, 255, 255, 14),
        outline=(255, 255, 255, 24),
        width=1,
    )
    draw.text((left + 26, top + 24), str(label or "-"), font=label_font, fill=TEXT_SOFT)
    value_text = str(value or "0")
    value_box = draw.textbbox((0, 0), value_text, font=value_font)
    value_height = value_box[3] - value_box[1]
    draw.text(
        (left + 26, top + max(58, ((bottom - top) - value_height) // 2)),
        value_text,
        font=value_font,
        fill=TEXT_PRIMARY,
    )


def main():
    if len(sys.argv) < 3:
        raise SystemExit("Usage: discord-daily-stats-card.py <output_path> <payload_json>")

    output_path = sys.argv[1]
    payload = load_payload(sys.argv[2])
    metrics = payload.get("metrics") if isinstance(payload.get("metrics"), list) else []

    base = load_background(payload.get("backgroundPath"))
    base = base.filter(ImageFilter.GaussianBlur(radius=1.2))

    overlay = Image.new("RGBA", (CARD_WIDTH, CARD_HEIGHT), (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    overlay_draw.rectangle((0, 0, CARD_WIDTH, CARD_HEIGHT), fill=(6, 8, 12, 124))
    overlay_draw.ellipse((-140, -180, 520, 460), fill=(227, 30, 36, 70))
    overlay_draw.ellipse((780, 260, 1420, 940), fill=(245, 158, 11, 50))
    overlay_draw.rounded_rectangle((52, 46, CARD_WIDTH - 52, CARD_HEIGHT - 46), radius=42, fill=PANEL_DARK)
    overlay_draw.rounded_rectangle((52, 46, CARD_WIDTH - 52, 84), radius=20, fill=ACCENT_RED)
    overlay_draw.rounded_rectangle((82, 118, CARD_WIDTH - 82, 236), radius=30, fill=(255, 255, 255, 10), outline=(255, 255, 255, 20), width=1)

    card = Image.alpha_composite(base, overlay)
    draw = ImageDraw.Draw(card)

    title_font = load_font(48, bold=True)
    subtitle_font = load_font(24, bold=False)
    eyebrow_font = load_font(18, bold=True)
    metric_label_font = load_font(20, bold=False)
    metric_value_font = load_font(42, bold=True)
    footer_font = load_font(18, bold=False)

    draw.text((102, 132), "NORDWIND VIRTUAL", font=eyebrow_font, fill=ACCENT_GOLD)
    draw.text((102, 160), str(payload.get("title") or "Daily Summary"), font=title_font, fill=TEXT_PRIMARY)
    draw.text((102, 214), str(payload.get("subtitle") or "Operational totals"), font=subtitle_font, fill=TEXT_MUTED)

    logo = load_logo(payload.get("logoPath"))
    if logo is not None:
        logo.thumbnail((320, 116), Image.Resampling.LANCZOS)
        card.alpha_composite(logo, (CARD_WIDTH - logo.width - 104, 134))

    grid_left = 86
    grid_top = 278
    grid_right = CARD_WIDTH - 86
    grid_bottom = CARD_HEIGHT - 148
    column_gap = 24
    row_gap = 24
    card_width = int((grid_right - grid_left - (column_gap * 2)) / 3)
    card_height = int((grid_bottom - grid_top - row_gap) / 2)

    for index in range(6):
        metric = metrics[index] if index < len(metrics) and isinstance(metrics[index], dict) else {}
        column = index % 3
        row = index // 3
        left = grid_left + column * (card_width + column_gap)
        top = grid_top + row * (card_height + row_gap)
        draw_metric_card(
            draw,
            (left, top, left + card_width, top + card_height),
            metric.get("label") or "Metric",
            metric.get("value") or "0",
            metric_label_font,
            metric_value_font,
        )

    footer_y = CARD_HEIGHT - 108
    draw.text((92, footer_y), f"Generated: {str(payload.get('generatedAt') or 'Unknown')}", font=footer_font, fill=TEXT_MUTED)
    draw.text((92, footer_y + 30), f"Window: {str(payload.get('windowLabel') or 'Unknown')}", font=footer_font, fill=TEXT_SOFT)
    draw.text((CARD_WIDTH - 292, footer_y + 30), "Nordwind Virtual Group", font=footer_font, fill=TEXT_SOFT)

    card.save(output_path, format="PNG")


if __name__ == "__main__":
    main()