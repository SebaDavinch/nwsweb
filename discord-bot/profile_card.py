import io
import json
import os
import sys
import textwrap
import urllib.request

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


CARD_WIDTH = 1280
CARD_HEIGHT = 720
ACCENT_RED = (227, 30, 36, 255)
PANEL_DARK = (9, 12, 18, 205)
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
                ("C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf"),
                ("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"),
            ]
        )
    else:
        candidates.extend(
            [
                ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
                ("/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf"),
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
        r = int(10 + 22 * ratio)
        g = int(12 + 24 * ratio)
        b = int(18 + 56 * ratio)
        for x in range(CARD_WIDTH):
            pixels[x, y] = (r, g, b, 255)
    return image


def cover_image(image, width, height):
    src_w, src_h = image.size
    scale = max(width / max(1, src_w), height / max(1, src_h))
    resized = image.resize((max(1, int(src_w * scale)), max(1, int(src_h * scale))), Image.Resampling.LANCZOS)
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


def load_avatar(url):
    if not url:
        return None
    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            data = response.read()
        return Image.open(io.BytesIO(data)).convert("RGBA")
    except Exception:
        return None


def circle_avatar(image, size):
    if image is None:
        placeholder = Image.new("RGBA", (size, size), (28, 35, 45, 255))
        draw = ImageDraw.Draw(placeholder)
        draw.ellipse((0, 0, size - 1, size - 1), fill=(34, 41, 52, 255), outline=(255, 255, 255, 25), width=2)
        return placeholder

    avatar = cover_image(image, size, size)
    mask = Image.new("L", (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.ellipse((0, 0, size - 1, size - 1), fill=255)
    result = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    result.paste(avatar, (0, 0), mask)
    return result


def draw_wrapped_text(draw, text, font, fill, box_width, xy, line_gap=8):
    words = str(text or "").split()
    lines = []
    current = []
    for word in words:
        test = " ".join(current + [word])
        if draw.textbbox((0, 0), test, font=font)[2] <= box_width or not current:
            current.append(word)
        else:
            lines.append(" ".join(current))
            current = [word]
    if current:
        lines.append(" ".join(current))

    x, y = xy
    for line in lines:
        draw.text((x, y), line, font=font, fill=fill)
        bbox = draw.textbbox((x, y), line, font=font)
        y += (bbox[3] - bbox[1]) + line_gap
    return y


def main():
    if len(sys.argv) < 3:
        raise SystemExit("Usage: profile_card.py <output_path> <payload_json>")

    output_path = sys.argv[1]
    payload = load_payload(sys.argv[2])

    base = load_background(payload.get("backgroundPath"))
    base = base.filter(ImageFilter.GaussianBlur(radius=1.25))

    overlay = Image.new("RGBA", (CARD_WIDTH, CARD_HEIGHT), (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    overlay_draw.rectangle((0, 0, CARD_WIDTH, CARD_HEIGHT), fill=(6, 8, 12, 118))
    overlay_draw.ellipse((-180, -160, 480, 460), fill=(227, 30, 36, 68))
    overlay_draw.ellipse((760, 320, 1380, 980), fill=(245, 158, 11, 58))
    overlay_draw.rounded_rectangle((58, 54, CARD_WIDTH - 58, CARD_HEIGHT - 54), radius=40, fill=PANEL_DARK)
    overlay_draw.rounded_rectangle((58, 54, CARD_WIDTH - 58, 82), radius=18, fill=ACCENT_RED)
    overlay_draw.rounded_rectangle((86, 118, 438, 610), radius=30, fill=(255, 255, 255, 16), outline=(255, 255, 255, 28), width=1)
    overlay_draw.rounded_rectangle((474, 118, 1194, 610), radius=30, fill=(255, 255, 255, 10), outline=(255, 255, 255, 22), width=1)

    card = Image.alpha_composite(base, overlay)
    draw = ImageDraw.Draw(card)

    logo = load_logo(payload.get("logoPath"))
    if logo is not None:
        logo.thumbnail((340, 140), Image.Resampling.LANCZOS)
        card.alpha_composite(logo, (CARD_WIDTH - logo.width - 96, 104))

    avatar = circle_avatar(load_avatar(payload.get("avatarUrl")), 228)
    avatar_x = 146
    avatar_y = 172
    shadow = Image.new("RGBA", (248, 248), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.ellipse((10, 10, 238, 238), fill=(0, 0, 0, 110))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=14))
    card.alpha_composite(shadow, (avatar_x - 10, avatar_y - 8))
    card.alpha_composite(avatar, (avatar_x, avatar_y))
    draw.ellipse((avatar_x - 4, avatar_y - 4, avatar_x + 232, avatar_y + 232), outline=(255, 255, 255, 50), width=3)

    title_font = load_font(52, bold=True)
    subtitle_font = load_font(26, bold=False)
    label_font = load_font(20, bold=False)
    value_font = load_font(28, bold=True)
    metric_value_font = load_font(38, bold=True)
    metric_label_font = load_font(18, bold=False)
    badge_font = load_font(20, bold=True)

    left_x = 126
    draw.text((left_x, 430), str(payload.get("callsign") or "NWS"), font=title_font, fill=TEXT_PRIMARY)
    draw.text((left_x, 494), "Nordwind Virtual Pilot", font=subtitle_font, fill=TEXT_MUTED)
    draw.text((left_x, 536), str(payload.get("airport") or "-"), font=label_font, fill=TEXT_SOFT)

    content_x = 516
    draw.text((content_x, 158), str(payload.get("name") or "Unknown Pilot"), font=title_font, fill=TEXT_PRIMARY)
    draw.text((content_x, 222), f"Rank: {payload.get('rank') or 'Unknown'}", font=subtitle_font, fill=TEXT_MUTED)

    honorary_rank = str(payload.get("honoraryRank") or "").strip()
    if honorary_rank:
        badge_text = f"Honorary Rank: {honorary_rank}"
        badge_bbox = draw.textbbox((0, 0), badge_text, font=badge_font)
        badge_width = badge_bbox[2] - badge_bbox[0] + 34
        badge_height = badge_bbox[3] - badge_bbox[1] + 18
        badge_x = content_x
        badge_y = 272
        draw.rounded_rectangle(
            (badge_x, badge_y, badge_x + badge_width, badge_y + badge_height),
            radius=18,
            fill=(227, 30, 36, 235),
        )
        draw.text((badge_x + 17, badge_y + 8), badge_text, font=badge_font, fill=TEXT_PRIMARY)

    bio_top = 342 if honorary_rank else 302
    draw.text((content_x, bio_top), "Pilot Summary", font=label_font, fill=TEXT_SOFT)
    draw_wrapped_text(
        draw,
        f"{payload.get('name') or 'Unknown Pilot'} is flying as {payload.get('callsign') or '-'} with Nordwind Virtual Group.",
        subtitle_font,
        TEXT_MUTED,
        600,
        (content_x, bio_top + 30),
        line_gap=6,
    )

    metric_top = 470
    metric_width = 190
    metric_gap = 26
    metrics = [
        ("PIREP", str(int(payload.get("pireps") or 0))),
        ("Hours", f"{float(payload.get('hours') or 0):.1f}"),
        ("Joined", str(payload.get("joinedAt") or "-")),
    ]

    for index, (label, value) in enumerate(metrics):
        card_x = content_x + index * (metric_width + metric_gap)
        card_y = metric_top
        card_w = 190 if index < 2 else 260
        draw.rounded_rectangle(
            (card_x, card_y, card_x + card_w, card_y + 112),
            radius=24,
            fill=(255, 255, 255, 14),
            outline=(255, 255, 255, 22),
            width=1,
        )
        draw.text((card_x + 22, card_y + 18), label, font=metric_label_font, fill=TEXT_SOFT)
        font = metric_value_font if index < 2 else label_font
        value_text = value if index < 2 else textwrap.shorten(value, width=22, placeholder="...")
        draw.text((card_x + 22, card_y + 46), value_text, font=font, fill=TEXT_PRIMARY)

    footer_y = CARD_HEIGHT - 112
    draw.text((92, footer_y), "Nordwind Virtual Group", font=label_font, fill=TEXT_SOFT)
    draw.text((CARD_WIDTH - 314, footer_y), "Powered by Pillow", font=label_font, fill=TEXT_SOFT)

    card.save(output_path, format="PNG")


if __name__ == "__main__":
    main()