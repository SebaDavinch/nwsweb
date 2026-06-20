import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

# ── Dimensions ───────────────────────────────────────────────────────────────
CARD_W = 860
PAD = 28
SEC_PAD = 20
GAP = 14

# ── Palette ──────────────────────────────────────────────────────────────────
BG          = (22,  25,  31, 255)
SEC_BG      = (31,  35,  43, 255)
HDR_RED     = (227, 30,  36, 255)
HDR_RED_DIM = (180, 22,  28, 255)
MET_BG      = (40,  45,  55, 255)
SEP         = (50,  56,  68, 255)
TXT_W       = (245, 247, 252, 255)
TXT_M       = (160, 170, 190, 255)
TXT_S       = (100, 110, 130, 255)
DOT_CLR     = (227, 30,  36, 255)

# ── ICAO prefix → ISO-2 (first 2 chars of ICAO) ─────────────────────────────
ICAO_CC = {
    "UU": "RU", "UW": "RU", "UF": "RU", "UH": "RU", "UI": "RU",
    "UL": "RU", "UN": "KZ", "UO": "RU", "US": "UZ", "UT": "UZ",
    "UE": "RU", "UK": "UA", "UR": "UA", "UA": "KZ", "UB": "AZ",
    "UC": "KG", "UD": "AM", "UG": "GE", "UM": "BY",
    "LT": "TR", "LK": "CZ", "LZ": "SK", "LO": "AT", "LH": "HU",
    "LI": "IT", "LF": "FR", "LE": "ES", "LP": "PT", "LG": "GR",
    "LR": "RO", "LB": "BG", "LY": "RS", "LJ": "SI", "LW": "MK",
    "EG": "GB", "ED": "DE", "EF": "FI", "EH": "NL", "EI": "IE",
    "EK": "DK", "EN": "NO", "EP": "PL", "ES": "SE", "EV": "LV",
    "EY": "LT", "EE": "EE",
    "KF": "US", "KG": "US", "KH": "US", "KI": "US", "KJ": "US",
    "KK": "US", "KL": "US", "KM": "US", "KN": "US", "KP": "US",
    "KS": "US", "KT": "US", "KV": "US", "KW": "US",
}

CC_NAME = {
    "RU": "RUS", "TR": "TUR", "UA": "UKR", "KZ": "KAZ", "AZ": "AZE",
    "AM": "ARM", "GE": "GEO", "BY": "BLR", "UZ": "UZB", "KG": "KGZ",
    "DE": "GER", "FR": "FRA", "GB": "GBR", "IT": "ITA", "ES": "ESP",
    "NL": "NLD", "PL": "POL", "CZ": "CZE", "AT": "AUT", "CH": "CHE",
    "HU": "HUN", "RO": "ROU", "SE": "SWE", "NO": "NOR", "DK": "DNK",
    "FI": "FIN", "EE": "EST", "LV": "LVA", "LT": "LTU", "GR": "GRC",
    "PT": "PRT", "SK": "SVK", "SI": "SVN", "RS": "SRB", "BG": "BGR",
    "MK": "MKD", "US": "USA",
}

def icao_cc(icao):
    prefix = icao[:2].upper() if icao else ""
    return ICAO_CC.get(prefix, "")

def cc_label(icao):
    cc = icao_cc(icao)
    return CC_NAME.get(cc, "   ")

# ── Font loader ───────────────────────────────────────────────────────────────
def load_font(size, bold=False):
    win_b = "C:/Windows/Fonts/segoeuib.ttf"
    win_r = "C:/Windows/Fonts/segoeui.ttf"
    lnx_b = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    lnx_r = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    lib_b = "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf"
    lib_r = "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf"
    candidates = [win_b if bold else win_r, lnx_b if bold else lnx_r, lib_b if bold else lib_r]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size=size)
            except Exception:
                pass
    return ImageFont.load_default()

# ── Draw helpers ──────────────────────────────────────────────────────────────
def rrect(draw, xy, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)

def text_w(draw, text, font):
    bb = draw.textbbox((0, 0), text, font=font)
    return bb[2] - bb[0]

def text_h(draw, text, font):
    bb = draw.textbbox((0, 0), text, font=font)
    return bb[3] - bb[1]

def draw_text(draw, xy, text, font, fill, anchor="la"):
    draw.text(xy, text, font=font, fill=fill, anchor=anchor)

# ── Header ────────────────────────────────────────────────────────────────────
def draw_header(draw, logo, fonts, generated_at, y):
    hdr_h = 68
    rrect(draw, (PAD, y, CARD_W - PAD, y + hdr_h), radius=14, fill=HDR_RED)
    # Logo
    logo_x = PAD + 16
    if logo:
        lw = int(logo.width * (hdr_h - 16) / max(1, logo.height))
        logo_sm = logo.resize((lw, hdr_h - 16), Image.Resampling.LANCZOS)
        return logo_sm, logo_x, y + 8, hdr_h  # caller composites
    title_x = logo_x
    draw_text(draw, (title_x, y + hdr_h // 2), "NORDWIND VA", fonts["hdr_title"], TXT_W, anchor="lm")
    right_x = CARD_W - PAD - 16
    draw_text(draw, (right_x, y + hdr_h // 2), f"Статистика · {generated_at}", fonts["hdr_sub"], TXT_W, anchor="rm")
    return None, 0, 0, hdr_h

# ── Section ───────────────────────────────────────────────────────────────────
def section_height(window, fonts, draw_ref):
    """Estimate rendered height for a window block."""
    # label row + date + metrics + table rows
    n_routes = len(window.get("topRoutes", []))
    n_airports = len(window.get("busiestAirports", []))
    table_rows = max(n_routes, n_airports, 1)
    row_h = 22
    return (
        SEC_PAD            # top pad
        + 30               # label bar
        + 10               # gap
        + 56               # metrics strip
        + 12               # gap
        + 20               # table header
        + table_rows * row_h
        + SEC_PAD          # bottom pad
    )

def draw_section(img, draw, logo, window, fonts, y):
    label     = str(window.get("label", "")).upper()
    date_lbl  = str(window.get("dateLabel", ""))
    flights   = str(window.get("flights", 0))
    ft        = str(window.get("flightTime", "—"))
    pilots    = str(window.get("pilots", 0))
    routes    = window.get("topRoutes", [])
    airports  = window.get("busiestAirports", [])

    sec_w = CARD_W - PAD * 2
    est_h = section_height(window, fonts, draw)
    x0, x1 = PAD, CARD_W - PAD

    # section background
    rrect(draw, (x0, y, x1, y + est_h), radius=12, fill=SEC_BG)

    cur_y = y + SEC_PAD

    # ── Label bar ────────────────────────────────────────────────────────────
    bar_h = 30
    rrect(draw, (x0 + SEC_PAD, cur_y, x0 + SEC_PAD + 90, cur_y + bar_h), radius=7, fill=HDR_RED_DIM)
    draw_text(draw, (x0 + SEC_PAD + 45, cur_y + bar_h // 2), label, fonts["sec_label"], TXT_W, anchor="mm")
    draw_text(draw, (x0 + SEC_PAD + 100, cur_y + bar_h // 2), date_lbl, fonts["sec_date"], TXT_M, anchor="lm")
    cur_y += bar_h + 10

    # ── Metric strip ─────────────────────────────────────────────────────────
    met_h = 56
    met_labels = ["Рейсы", "Налёт", "Пилоты"]
    met_vals   = [flights, ft, pilots]
    col_w = sec_w // 3
    for i, (lbl, val) in enumerate(zip(met_labels, met_vals)):
        mx = x0 + i * col_w + SEC_PAD
        my = cur_y
        mw = col_w - SEC_PAD * 2 + (SEC_PAD if i == 2 else 0)
        rrect(draw, (mx, my, mx + mw, my + met_h), radius=8, fill=MET_BG)
        draw_text(draw, (mx + mw // 2, my + 14), val,  fonts["met_val"],  TXT_W, anchor="mt")
        draw_text(draw, (mx + mw // 2, my + met_h - 12), lbl, fonts["met_lbl"], TXT_S, anchor="mb")
    cur_y += met_h + 12

    # ── Table ─────────────────────────────────────────────────────────────────
    half = sec_w // 2
    col_r_x = x0 + half + SEC_PAD

    # headers
    draw_text(draw, (x0 + SEC_PAD, cur_y), "Маршруты", fonts["tbl_hdr"], TXT_M)
    draw_text(draw, (col_r_x, cur_y), "Аэропорты", fonts["tbl_hdr"], TXT_M)
    cur_y += 20

    # separator line
    draw.line([(x0 + SEC_PAD, cur_y - 2), (x1 - SEC_PAD, cur_y - 2)], fill=SEP, width=1)

    row_h = 22
    n_rows = max(len(routes), len(airports))
    for i in range(n_rows):
        ry = cur_y + i * row_h

        # left: route
        if i < len(routes):
            r = routes[i]
            route_str = str(r.get("route", ""))
            count_str = f"×{r.get('count', 1)}"
            # small colored index dot
            dot_r = 4
            draw.ellipse((x0 + SEC_PAD, ry + row_h // 2 - dot_r, x0 + SEC_PAD + dot_r * 2, ry + row_h // 2 + dot_r), fill=DOT_CLR)
            draw_text(draw, (x0 + SEC_PAD + dot_r * 2 + 6, ry + row_h // 2), route_str, fonts["tbl_val"], TXT_W, anchor="lm")
            draw_text(draw, (x0 + half - SEC_PAD, ry + row_h // 2), count_str, fonts["tbl_cnt"], TXT_M, anchor="rm")

        # right: airport
        if i < len(airports):
            a = airports[i]
            icao = str(a.get("icao", ""))
            cnt  = f"×{a.get('count', 1)}"
            cc   = cc_label(icao)
            draw.ellipse((col_r_x, ry + row_h // 2 - dot_r, col_r_x + dot_r * 2, ry + row_h // 2 + dot_r), fill=DOT_CLR)
            draw_text(draw, (col_r_x + dot_r * 2 + 6, ry + row_h // 2), icao, fonts["tbl_val"], TXT_W, anchor="lm")
            if cc:
                cc_x = col_r_x + dot_r * 2 + 6 + text_w(draw, icao, fonts["tbl_val"]) + 8
                draw_text(draw, (cc_x, ry + row_h // 2), cc, fonts["tbl_cc"], TXT_S, anchor="lm")
            draw_text(draw, (x1 - SEC_PAD, ry + row_h // 2), cnt, fonts["tbl_cnt"], TXT_M, anchor="rm")

    cur_y += n_rows * row_h
    cur_y += SEC_PAD
    return cur_y

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    if len(sys.argv) < 3:
        raise SystemExit("Usage: discord-daily-stats-card.py <output_path> <payload_json>")

    output_path = sys.argv[1]
    try:
        payload = json.loads(sys.argv[2])
    except Exception:
        payload = {}

    generated_at = str(payload.get("generatedAt") or "")
    windows = payload.get("windows") if isinstance(payload.get("windows"), list) else []
    logo_path = str(payload.get("logoPath") or "")

    # Load fonts
    fonts = {
        "hdr_title": load_font(22, bold=True),
        "hdr_sub":   load_font(14),
        "sec_label": load_font(14, bold=True),
        "sec_date":  load_font(13),
        "met_val":   load_font(20, bold=True),
        "met_lbl":   load_font(11),
        "tbl_hdr":   load_font(12, bold=True),
        "tbl_val":   load_font(13, bold=True),
        "tbl_cnt":   load_font(13),
        "tbl_cc":    load_font(11),
        "footer":    load_font(11),
    }

    # Load logo
    logo = None
    if logo_path and os.path.exists(logo_path):
        try:
            logo = Image.open(logo_path).convert("RGBA")
        except Exception:
            logo = None

    # Pre-calculate total height
    dummy_img = Image.new("RGBA", (CARD_W, 100), BG)
    dummy_draw = ImageDraw.Draw(dummy_img)
    total_h = PAD + 68 + GAP  # header
    for w in windows:
        total_h += section_height(w, fonts, dummy_draw) + GAP
    total_h += PAD + 20  # footer

    # Create canvas
    img = Image.new("RGBA", (CARD_W, total_h), BG)
    draw = ImageDraw.Draw(img)

    # Subtle top-left glow
    glow = Image.new("RGBA", (CARD_W, total_h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((-80, -80, 300, 300), fill=(227, 30, 36, 28))
    img = Image.alpha_composite(img, glow)
    draw = ImageDraw.Draw(img)

    y = PAD

    # ── Header ────────────────────────────────────────────────────────────────
    hdr_h = 68
    rrect(draw, (PAD, y, CARD_W - PAD, y + hdr_h), radius=14, fill=HDR_RED)
    title_x = PAD + 18
    if logo:
        lh = hdr_h - 16
        lw = max(1, int(logo.width * lh / max(1, logo.height)))
        logo_sm = logo.resize((lw, lh), Image.Resampling.LANCZOS)
        img.alpha_composite(logo_sm, (PAD + 10, y + 8))
        title_x = PAD + 10 + lw + 14
        draw = ImageDraw.Draw(img)
    draw_text(draw, (title_x, y + hdr_h // 2), "NORDWIND VA", fonts["hdr_title"], TXT_W, anchor="lm")
    draw_text(draw, (CARD_W - PAD - 14, y + hdr_h // 2), f"Статистика · {generated_at}", fonts["hdr_sub"], TXT_W, anchor="rm")
    y += hdr_h + GAP

    # ── Sections ──────────────────────────────────────────────────────────────
    for window in windows:
        y = draw_section(img, draw, logo, window, fonts, y)
        y += GAP

    # ── Footer ────────────────────────────────────────────────────────────────
    draw_text(draw, (CARD_W // 2, y + 10), "Nordwind Virtual Group · nordwindva.ru", fonts["footer"], TXT_S, anchor="mt")

    # Save
    img.convert("RGB").save(output_path, format="PNG", optimize=True)


if __name__ == "__main__":
    main()
