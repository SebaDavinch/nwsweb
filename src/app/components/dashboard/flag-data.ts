// Inline SVG flags — no external requests
// viewBox "0 0 20 13" (~3:2 ratio) for all entries
// Usage: getFlagUri("ru")  →  "data:image/svg+xml,..."
//        icaoToCountry("ULLI") → "ru"

// ── ICAO prefix → ISO 3166-1 alpha-2 ─────────────────────────────────────────

const ICAO_MAP: Record<string, string> = {
  // Russia (multiple FIRs) — UN = Западная Сибирь (UNKL, UNNT, UNOO…)
  UU: "ru", UL: "ru", UR: "ru", UW: "ru", US: "ru", UI: "ru",
  UO: "ru", UE: "ru", UH: "ru", UN: "ru", UF: "ru",
  // CIS / post-Soviet
  UK: "ua", // Ukraine (UKBB, UKKK, UKOO…)
  UA: "kz", // Kazakhstan
  UB: "az", // Azerbaijan
  UC: "kg", // Kyrgyzstan
  UD: "am", // Armenia
  UG: "ge", // Georgia
  UM: "by", // Belarus (UMKK = Калининград/РФ — override ниже)
  UT: "uz", // Uzbekistan (UTD*=Таджикистан, UTA*=Туркменистан — overrides ниже)
  // Europe
  ED: "de", ET: "de",
  EG: "gb",
  EH: "nl",
  EI: "ie",
  EK: "dk",
  EL: "lu",
  EN: "no",
  EP: "pl",
  ES: "se",
  EV: "lv",
  EY: "lt",
  EE: "ee",
  EF: "fi",
  LB: "bg",
  LC: "cy",
  LD: "hr",
  LE: "es",
  LF: "fr",
  LG: "gr",
  LH: "hu",
  LI: "it",
  LJ: "si",
  LK: "cz",
  LL: "il",
  LM: "mt",
  LN: "mc",
  LO: "at",
  LP: "pt",
  LQ: "ba",
  LR: "ro",
  LS: "ch",
  LT: "tr",
  LU: "md",
  LW: "mk",
  LX: "gi",
  LY: "rs",
  LZ: "sk",
  // Middle East
  OB: "bh",
  OE: "sa",
  OJ: "jo",
  OK: "kw",
  OL: "lb",
  OM: "ae",
  OO: "om",
  OP: "pk",
  OR: "iq",
  OS: "sy",
  OT: "qa",
  OY: "ye",
  OI: "ir",
  // Africa
  HE: "eg",
  // Asia-Pacific
  VT: "th",
  VD: "kh",
  VH: "hk",
  VI: "in",
  VN: "vn",
  VO: "in",
  VR: "mo",
  VV: "vn",
  WA: "id",
  WB: "bn",
  WI: "id",
  WM: "my",
  WP: "tl",
  WQ: "id",
  WS: "sg",
  ZB: "cn",
  ZG: "cn",
  ZH: "cn",
  ZJ: "cn",
  ZK: "kp",
  ZL: "cn",
  ZM: "mn",
  ZP: "cn",
  ZS: "cn",
  ZT: "cn",
  ZU: "cn",
  ZW: "cn",
  ZY: "cn",
  RJ: "jp",
  RO: "jp",
  RK: "kr",
  // Oceania
  YB: "au",
  YM: "au",
  YP: "au",
  YS: "au",
};

// 3-letter overrides where the 2-letter prefix is ambiguous
const ICAO_3: Record<string, string> = {
  UMK: "ru", // Калининград (UMKK) — РФ, не Беларусь
  UTD: "tj", // Душанбе/Куляб — Таджикистан
  UTA: "tm", // Ашхабад/Туркменбаши — Туркменистан
};

// 4-letter overrides
const ICAO_4: Record<string, string> = {
  UKBB: "ua", UKKK: "ua", UKFF: "ua", UKDD: "ua", UKOO: "ua",
  UKLN: "ua", UKLH: "ua", UKDE: "ua",
};

export function icaoToCountry(icao?: string | null): string {
  if (!icao) return "";
  const code = icao.trim().toUpperCase();
  return (
    ICAO_4[code] ||
    ICAO_3[code.slice(0, 3)] ||
    ICAO_MAP[code.slice(0, 2)] ||
    ""
  );
}

// ── Inline SVG flag strings ───────────────────────────────────────────────────

const F: Record<string, string> = {
  // ── Russia / CIS ────────────────────────────────────────────────────────────
  ru: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="4.33" fill="#fff"/><rect y="4.33" width="20" height="4.33" fill="#0039A6"/><rect y="8.67" width="20" height="4.33" fill="#D52B1E"/></svg>`,
  ua: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="6.5" fill="#005BBB"/><rect y="6.5" width="20" height="6.5" fill="#FFD500"/></svg>`,
  by: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="8.67" fill="#CF101A"/><rect y="8.67" width="20" height="4.33" fill="#007C30"/><rect width="2.5" height="13" fill="#fff"/></svg>`,
  kz: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#00AFCA"/><circle cx="10" cy="6.5" r="2.2" fill="#F0D000"/><circle cx="10" cy="6.5" r="1.2" fill="#00AFCA"/></svg>`,
  az: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="4.33" fill="#0092BC"/><rect y="4.33" width="20" height="4.33" fill="#E8112D"/><rect y="8.67" width="20" height="4.33" fill="#00B140"/><circle cx="10" cy="6.5" r="2" fill="#fff"/><circle cx="10.75" cy="6.5" r="1.55" fill="#E8112D"/><polygon points="12.5,6.5 12.8,5.7 13.6,5.7 12.95,6.25 13.2,7.1 12.5,6.65 11.8,7.1 12.05,6.25 11.4,5.7 12.2,5.7" fill="#fff"/></svg>`,
  am: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="4.33" fill="#D90012"/><rect y="4.33" width="20" height="4.33" fill="#0033A0"/><rect y="8.67" width="20" height="4.33" fill="#F2A800"/></svg>`,
  ge: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#fff"/><rect x="9" width="2" height="13" fill="#FF0000"/><rect y="5.5" width="20" height="2" fill="#FF0000"/><rect x="1.2" y="1.2" width="2" height="2.6" fill="#FF0000"/><rect x="16.8" y="1.2" width="2" height="2.6" fill="#FF0000"/><rect x="1.2" y="9.2" width="2" height="2.6" fill="#FF0000"/><rect x="16.8" y="9.2" width="2" height="2.6" fill="#FF0000"/></svg>`,
  kg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#E8112D"/><circle cx="10" cy="6.5" r="3" fill="#F7C30C"/><circle cx="10" cy="6.5" r="1.9" fill="#E8112D"/></svg>`,
  tj: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="4.33" fill="#CC0001"/><rect y="4.33" width="20" height="4.33" fill="#fff"/><rect y="8.67" width="20" height="4.33" fill="#006600"/></svg>`,
  uz: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="4.5" fill="#1ACFFF"/><rect y="4.5" width="20" height="0.5" fill="#CE1126"/><rect y="5.0" width="20" height="3.0" fill="#fff"/><rect y="8.0" width="20" height="0.5" fill="#CE1126"/><rect y="8.5" width="20" height="4.5" fill="#1EB53A"/></svg>`,

  // ── Western Europe ───────────────────────────────────────────────────────────
  de: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="4.33" fill="#000"/><rect y="4.33" width="20" height="4.33" fill="#DD0000"/><rect y="8.67" width="20" height="4.33" fill="#FFCE00"/></svg>`,
  fr: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="6.67" height="13" fill="#002395"/><rect x="6.67" width="6.67" height="13" fill="#fff"/><rect x="13.33" width="6.67" height="13" fill="#ED2939"/></svg>`,
  gb: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#012169"/><path d="M0,0 L20,13 M20,0 L0,13" stroke="#fff" stroke-width="2.8"/><path d="M0,0 L20,13 M20,0 L0,13" stroke="#C8102E" stroke-width="1.7"/><rect x="8.5" width="3" height="13" fill="#fff"/><rect y="5" width="20" height="3" fill="#fff"/><rect x="9" width="2" height="13" fill="#C8102E"/><rect y="5.5" width="20" height="2" fill="#C8102E"/></svg>`,
  es: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#c60b1e"/><rect y="3.25" width="20" height="6.5" fill="#ffc400"/></svg>`,
  it: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="6.67" height="13" fill="#009246"/><rect x="6.67" width="6.67" height="13" fill="#fff"/><rect x="13.33" width="6.67" height="13" fill="#CE2B37"/></svg>`,
  nl: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="4.33" fill="#AE1C28"/><rect y="4.33" width="20" height="4.33" fill="#fff"/><rect y="8.67" width="20" height="4.33" fill="#21468B"/></svg>`,
  at: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="4.33" fill="#ED2939"/><rect y="4.33" width="20" height="4.33" fill="#fff"/><rect y="8.67" width="20" height="4.33" fill="#ED2939"/></svg>`,
  pt: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="8" height="13" fill="#006600"/><rect x="8" width="12" height="13" fill="#FF0000"/></svg>`,
  ch: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#FF0000"/><rect x="8.5" y="2" width="3" height="9" fill="#fff"/><rect x="4.5" y="5" width="11" height="3" fill="#fff"/></svg>`,
  be: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="6.67" height="13" fill="#000"/><rect x="6.67" width="6.67" height="13" fill="#FFD90C"/><rect x="13.33" width="6.67" height="13" fill="#F31830"/></svg>`,
  se: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#006AA7"/><rect x="6.5" width="3" height="13" fill="#FECC00"/><rect y="5" width="20" height="3" fill="#FECC00"/></svg>`,
  no: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#EF2B2D"/><rect x="6.5" width="3" height="13" fill="#fff"/><rect y="5" width="20" height="3" fill="#fff"/><rect x="7" width="2" height="13" fill="#002868"/><rect y="5.5" width="20" height="2" fill="#002868"/></svg>`,
  dk: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#C60C30"/><rect x="6.5" width="3" height="13" fill="#fff"/><rect y="5" width="20" height="3" fill="#fff"/></svg>`,
  fi: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#fff"/><rect x="5" width="3.5" height="13" fill="#003580"/><rect y="4.75" width="20" height="3.5" fill="#003580"/></svg>`,
  ie: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="6.67" height="13" fill="#169B62"/><rect x="6.67" width="6.67" height="13" fill="#fff"/><rect x="13.33" width="6.67" height="13" fill="#FF883E"/></svg>`,
  // ── Central / Eastern Europe ─────────────────────────────────────────────────
  pl: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="6.5" fill="#fff"/><rect y="6.5" width="20" height="6.5" fill="#DC143C"/></svg>`,
  cz: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="6.5" fill="#fff"/><rect y="6.5" width="20" height="6.5" fill="#D7141A"/><polygon points="0,0 10,6.5 0,13" fill="#11457E"/></svg>`,
  sk: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="4.33" fill="#fff"/><rect y="4.33" width="20" height="4.33" fill="#0B4EA2"/><rect y="8.67" width="20" height="4.33" fill="#EE1C25"/></svg>`,
  hu: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="4.33" fill="#CE2939"/><rect y="4.33" width="20" height="4.33" fill="#fff"/><rect y="8.67" width="20" height="4.33" fill="#477050"/></svg>`,
  ro: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="6.67" height="13" fill="#002B7F"/><rect x="6.67" width="6.67" height="13" fill="#FCD116"/><rect x="13.33" width="6.67" height="13" fill="#CE1126"/></svg>`,
  bg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="4.33" fill="#fff"/><rect y="4.33" width="20" height="4.33" fill="#00966E"/><rect y="8.67" width="20" height="4.33" fill="#D62612"/></svg>`,
  rs: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="4.33" fill="#C6363C"/><rect y="4.33" width="20" height="4.33" fill="#0C4076"/><rect y="8.67" width="20" height="4.33" fill="#fff"/></svg>`,
  hr: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="4.33" fill="#FF0000"/><rect y="4.33" width="20" height="4.33" fill="#fff"/><rect y="8.67" width="20" height="4.33" fill="#0000FF"/></svg>`,
  lt: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="4.33" fill="#FDB913"/><rect y="4.33" width="20" height="4.33" fill="#006A44"/><rect y="8.67" width="20" height="4.33" fill="#C1272D"/></svg>`,
  lv: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="5.2" fill="#9E3039"/><rect y="5.2" width="20" height="2.6" fill="#fff"/><rect y="7.8" width="20" height="5.2" fill="#9E3039"/></svg>`,
  ee: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="4.33" fill="#0072CE"/><rect y="4.33" width="20" height="4.33" fill="#000"/><rect y="8.67" width="20" height="4.33" fill="#fff"/></svg>`,
  gr: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#0D5EAF"/><rect y="0" width="20" height="1.44" fill="#fff"/><rect y="2.89" width="20" height="1.44" fill="#fff"/><rect y="5.78" width="20" height="1.44" fill="#fff"/><rect y="8.67" width="20" height="1.44" fill="#fff"/><rect y="11.56" width="20" height="1.44" fill="#fff"/><rect width="7.78" height="7.22" fill="#0D5EAF"/><rect x="2.89" width="2" height="7.22" fill="#fff"/><rect y="2.61" width="7.78" height="2" fill="#fff"/></svg>`,
  // ── Turkey ───────────────────────────────────────────────────────────────────
  tr: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#E30A17"/><circle cx="7.5" cy="6.5" r="3.2" fill="#fff"/><circle cx="8.6" cy="6.5" r="2.5" fill="#E30A17"/><polygon points="12.2,6.5 12.6,5.3 13.7,5.3 12.85,6.1 13.2,7.3 12.2,6.65 11.2,7.3 11.55,6.1 10.7,5.3 11.8,5.3" fill="#fff"/></svg>`,
  // ── Middle East ──────────────────────────────────────────────────────────────
  ae: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="4.33" fill="#00732F"/><rect y="4.33" width="20" height="4.33" fill="#fff"/><rect y="8.67" width="20" height="4.33" fill="#000"/><rect width="5" height="13" fill="#FF0000"/></svg>`,
  sa: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#006C35"/><line x1="3" y1="6.5" x2="17" y2="6.5" stroke="#fff" stroke-width="0.6"/></svg>`,
  jo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="4.33" fill="#000"/><rect y="4.33" width="20" height="4.33" fill="#fff"/><rect y="8.67" width="20" height="4.33" fill="#007A3D"/><polygon points="0,0 9,6.5 0,13" fill="#CE1126"/><polygon points="4,6.5 4.4,5.5 5.3,5.5 4.6,6.1 4.9,7.1 4,6.6 3.1,7.1 3.4,6.1 2.7,5.5 3.6,5.5" fill="#fff"/></svg>`,
  kw: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="4.33" fill="#007A3D"/><rect y="4.33" width="20" height="4.33" fill="#fff"/><rect y="8.67" width="20" height="4.33" fill="#CE1126"/><polygon points="0,0 7,6.5 0,13" fill="#000"/></svg>`,
  qa: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#8D1B3D"/><path d="M0,0 L7,1.44 L5.5,2.89 L7,4.33 L5.5,5.78 L7,7.22 L5.5,8.67 L7,10.11 L5.5,11.56 L7,13 L0,13 Z" fill="#fff"/></svg>`,
  bh: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#CE1126"/><path d="M0,0 L7,1.3 L5.5,2.6 L7,3.9 L5.5,5.2 L7,6.5 L5.5,7.8 L7,9.1 L5.5,10.4 L7,11.7 L0,13 Z" fill="#fff"/></svg>`,
  om: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="4.33" fill="#DB161B"/><rect y="4.33" width="20" height="4.33" fill="#fff"/><rect y="8.67" width="20" height="4.33" fill="#008000"/><rect width="5" height="13" fill="#DB161B"/></svg>`,
  lb: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="2.6" fill="#FF0000"/><rect y="2.6" width="20" height="7.8" fill="#fff"/><rect y="10.4" width="20" height="2.6" fill="#FF0000"/><circle cx="10" cy="6.5" r="2" fill="#00A550"/><rect x="8.7" y="5.5" width="2.6" height="2" fill="#00A550"/></svg>`,
  iq: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="4.33" fill="#CE1126"/><rect y="4.33" width="20" height="4.33" fill="#fff"/><rect y="8.67" width="20" height="4.33" fill="#000"/></svg>`,
  sy: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="4.33" fill="#CE1126"/><rect y="4.33" width="20" height="4.33" fill="#fff"/><rect y="8.67" width="20" height="4.33" fill="#000"/><polygon points="7,6.5 7.35,5.5 8.2,5.5 7.55,6.1 7.8,7.0 7,6.55 6.2,7.0 6.45,6.1 5.8,5.5 6.65,5.5" fill="#007A3D"/><polygon points="13,6.5 13.35,5.5 14.2,5.5 13.55,6.1 13.8,7.0 13,6.55 12.2,7.0 12.45,6.1 11.8,5.5 12.65,5.5" fill="#007A3D"/></svg>`,
  ye: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="4.33" fill="#CE1126"/><rect y="4.33" width="20" height="4.33" fill="#fff"/><rect y="8.67" width="20" height="4.33" fill="#000"/></svg>`,
  ir: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="4.33" fill="#239F40"/><rect y="4.33" width="20" height="4.33" fill="#fff"/><rect y="8.67" width="20" height="4.33" fill="#DA0000"/></svg>`,
  pk: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#01411C"/><rect width="5" height="13" fill="#fff"/><circle cx="12.5" cy="6.5" r="2.6" fill="#fff"/><circle cx="13.3" cy="6.5" r="2.0" fill="#01411C"/></svg>`,
  il: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#fff"/><rect y="1.5" width="20" height="1.7" fill="#0038B8"/><rect y="9.8" width="20" height="1.7" fill="#0038B8"/><polygon points="10,4.5 11.4,7.2 8.6,7.2" fill="none" stroke="#0038B8" stroke-width="0.6"/><polygon points="10,9 11.4,6.3 8.6,6.3" fill="none" stroke="#0038B8" stroke-width="0.6"/></svg>`,
  // ── Africa ───────────────────────────────────────────────────────────────────
  eg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="4.33" fill="#CE1126"/><rect y="4.33" width="20" height="4.33" fill="#fff"/><rect y="8.67" width="20" height="4.33" fill="#000"/></svg>`,
  ma: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#C1272D"/><polygon points="10,4.5 10.9,7.2 8.3,5.4 11.7,5.4 9.1,7.2" fill="none" stroke="#006233" stroke-width="0.6"/></svg>`,
  tn: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#E70013"/><circle cx="10" cy="6.5" r="3.5" fill="#fff"/><circle cx="10" cy="6.5" r="2.8" fill="#E70013"/><circle cx="10.7" cy="6.5" r="2.2" fill="#fff"/><circle cx="11.4" cy="6.5" r="1.7" fill="#E70013"/></svg>`,
  ke: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="4.33" fill="#006600"/><rect y="4.33" width="20" height="4.33" fill="#fff"/><rect y="8.67" width="20" height="4.33" fill="#BB0000"/><rect y="4.7" width="20" height="3.6" fill="#000"/></svg>`,
  // ── Asia-Pacific ─────────────────────────────────────────────────────────────
  th: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#A51931"/><rect y="2.17" width="20" height="2.17" fill="#fff"/><rect y="4.33" width="20" height="4.33" fill="#2D2A4A"/><rect y="8.67" width="20" height="2.17" fill="#fff"/></svg>`,
  cn: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#DE2910"/><polygon points="4,1.3 4.53,2.77 6.09,2.82 4.86,3.78 5.29,5.28 4,4.4 2.71,5.28 3.14,3.78 1.91,2.82 3.47,2.77" fill="#FFDE00"/><polygon points="7,0.8 7.4,1.3 8,1.1 7.6,1.6 7.85,2.2 7.3,1.9 6.8,2.2 7.0,1.6 6.6,1.1 7.2,1.3" fill="#FFDE00"/><polygon points="8.5,2.0 8.9,2.5 9.5,2.3 9.1,2.8 9.35,3.4 8.8,3.1 8.3,3.4 8.5,2.8 8.1,2.3 8.7,2.5" fill="#FFDE00"/><polygon points="8.5,3.8 8.9,4.3 9.5,4.1 9.1,4.6 9.35,5.2 8.8,4.9 8.3,5.2 8.5,4.6 8.1,4.1 8.7,4.3" fill="#FFDE00"/><polygon points="7,5.2 7.4,5.7 8,5.5 7.6,6.0 7.85,6.6 7.3,6.3 6.8,6.6 7.0,6.0 6.6,5.5 7.2,5.7" fill="#FFDE00"/></svg>`,
  jp: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#fff"/><circle cx="10" cy="6.5" r="3.9" fill="#BC002D"/></svg>`,
  kr: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#fff"/><circle cx="10" cy="6.5" r="3.2" fill="#CD2E3A"/><path d="M10,3.3 A3.2,3.2 0 0,1 10,9.7 A1.6,1.6 0 0,1 10,6.5 A1.6,1.6 0 0,0 10,3.3" fill="#003478"/></svg>`,
  in: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="4.33" fill="#FF9933"/><rect y="4.33" width="20" height="4.33" fill="#fff"/><rect y="8.67" width="20" height="4.33" fill="#138808"/><circle cx="10" cy="6.5" r="1.5" fill="none" stroke="#000080" stroke-width="0.4"/></svg>`,
  mn: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="6.67" height="13" fill="#C4272F"/><rect x="6.67" width="6.67" height="13" fill="#015197"/><rect x="13.33" width="6.67" height="13" fill="#C4272F"/></svg>`,
  sg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="6.5" fill="#EF3340"/><rect y="6.5" width="20" height="6.5" fill="#fff"/><circle cx="5" cy="6.5" r="2.2" fill="#fff"/><circle cx="5.9" cy="6.5" r="1.7" fill="#EF3340"/></svg>`,
  vn: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#DA251D"/><polygon points="10,3.3 10.9,6.0 13.8,6.0 11.5,7.7 12.4,10.4 10,8.7 7.6,10.4 8.5,7.7 6.2,6.0 9.1,6.0" fill="#FFFF00"/></svg>`,
  my: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#fff"/><rect y="0" width="20" height="0.93" fill="#CC0001"/><rect y="1.86" width="20" height="0.93" fill="#CC0001"/><rect y="3.71" width="20" height="0.93" fill="#CC0001"/><rect y="5.57" width="20" height="0.93" fill="#CC0001"/><rect y="7.43" width="20" height="0.93" fill="#CC0001"/><rect y="9.29" width="20" height="0.93" fill="#CC0001"/><rect y="11.14" width="20" height="0.93" fill="#CC0001"/><rect width="9" height="7.43" fill="#010066"/></svg>`,
  id: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="6.5" fill="#CE1126"/><rect y="6.5" width="20" height="6.5" fill="#fff"/></svg>`,
  // ── Oceania ───────────────────────────────────────────────────────────────────
  au: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#012169"/><path d="M0,0 L10,6.5 M10,0 L0,6.5" stroke="#fff" stroke-width="1.6"/><path d="M0,0 L10,6.5 M10,0 L0,6.5" stroke="#C8102E" stroke-width="0.9"/><rect x="4.3" width="1.4" height="6.5" fill="#fff"/><rect y="2.55" width="10" height="1.4" fill="#fff"/><rect x="4.65" width="0.7" height="6.5" fill="#C8102E"/><rect y="2.9" width="10" height="0.7" fill="#C8102E"/></svg>`,
  // ── Добитые флаги (страны из ICAO-маппинга без картинок) ─────────────────────
  kp: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#024FA2"/><rect y="2" width="20" height="9" fill="#fff"/><rect y="2.6" width="20" height="7.8" fill="#ED1C27"/><circle cx="7" cy="6.5" r="2.4" fill="#fff"/><polygon points="7,4.6 7.55,6.0 9.0,6.0 7.85,6.95 8.3,8.4 7,7.5 5.7,8.4 6.15,6.95 5.0,6.0 6.45,6.0" fill="#ED1C27"/></svg>`,
  tm: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#00843D"/><rect x="2.5" width="3.5" height="13" fill="#B22234"/><circle cx="13" cy="3.6" r="1.7" fill="#fff"/><circle cx="13.7" cy="3.6" r="1.35" fill="#00843D"/></svg>`,
  lu: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="4.33" fill="#EF3340"/><rect y="4.33" width="20" height="4.33" fill="#fff"/><rect y="8.67" width="20" height="4.33" fill="#00A2E1"/></svg>`,
  cy: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#fff"/><ellipse cx="10" cy="5.7" rx="4.2" ry="2" fill="#D57800"/><path d="M5,9.3 Q7,8 10,8.4 Q13,8.8 15,9.3" stroke="#4E5B31" stroke-width="0.8" fill="none"/></svg>`,
  si: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="4.33" fill="#fff"/><rect y="4.33" width="20" height="4.33" fill="#005CE5"/><rect y="8.67" width="20" height="4.33" fill="#ED1C24"/><polygon points="4.5,2.2 6.3,2.2 6.3,4.0 5.4,5.0 4.5,4.0" fill="#005CE5" stroke="#ED1C24" stroke-width="0.3"/></svg>`,
  mt: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="10" height="13" fill="#fff"/><rect x="10" width="10" height="13" fill="#CF142B"/><rect x="1.4" y="1.2" width="2.4" height="2.4" fill="none" stroke="#9D9D9D" stroke-width="0.5"/></svg>`,
  mc: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="6.5" fill="#CE1126"/><rect y="6.5" width="20" height="6.5" fill="#fff"/></svg>`,
  ba: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#002395"/><polygon points="6,0 14.5,0 14.5,13" fill="#FECB00"/><polygon points="5.4,1.0 5.75,2.0 6.8,2.0 5.95,2.6 6.3,3.6 5.4,3.0 4.5,3.6 4.85,2.6 4.0,2.0 5.05,2.0" fill="#fff" transform="scale(0.65) translate(3.2,0.5)"/></svg>`,
  md: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="6.67" height="13" fill="#0046AE"/><rect x="6.67" width="6.67" height="13" fill="#FFD200"/><rect x="13.33" width="6.67" height="13" fill="#CC092F"/><circle cx="10" cy="6.5" r="1.6" fill="none" stroke="#A77B3B" stroke-width="0.5"/></svg>`,
  mk: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#D20000"/><circle cx="10" cy="6.5" r="2.2" fill="#FFE600"/><path d="M10,6.5 L0,0 M10,6.5 L20,0 M10,6.5 L0,13 M10,6.5 L20,13 M10,6.5 L10,0 M10,6.5 L10,13 M10,6.5 L0,6.5 M10,6.5 L20,6.5" stroke="#FFE600" stroke-width="1.3"/><circle cx="10" cy="6.5" r="2.2" fill="#FFE600"/></svg>`,
  gi: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="8.67" fill="#fff"/><rect y="8.67" width="20" height="4.33" fill="#DA000C"/><rect x="7.6" y="3" width="4.8" height="3.6" fill="#DA000C"/><rect x="8.6" y="2.2" width="0.9" height="1" fill="#DA000C"/><rect x="10.5" y="2.2" width="0.9" height="1" fill="#DA000C"/></svg>`,
  kh: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#032EA1"/><rect y="3.25" width="20" height="6.5" fill="#E00025"/><rect x="7.5" y="4.6" width="5" height="3.4" fill="#fff"/><rect x="8.4" y="3.8" width="0.9" height="1" fill="#fff"/><rect x="9.55" y="3.4" width="0.9" height="1.4" fill="#fff"/><rect x="10.7" y="3.8" width="0.9" height="1" fill="#fff"/></svg>`,
  hk: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#DE2910"/><circle cx="10" cy="6.5" r="2.6" fill="#fff"/><circle cx="10" cy="5.3" r="0.9" fill="#DE2910"/><circle cx="11.2" cy="6.1" r="0.9" fill="#DE2910"/><circle cx="10.7" cy="7.5" r="0.9" fill="#DE2910"/><circle cx="9.3" cy="7.5" r="0.9" fill="#DE2910"/><circle cx="8.8" cy="6.1" r="0.9" fill="#DE2910"/></svg>`,
  mo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#00785E"/><circle cx="10" cy="7" r="2.6" fill="#fff"/><circle cx="10" cy="8.2" r="2.6" fill="#00785E"/><circle cx="10" cy="4.0" r="0.7" fill="#FBD116"/></svg>`,
  bn: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#F7E017"/><polygon points="0,2.5 20,8.2 20,10.5 0,4.8" fill="#fff"/><polygon points="0,4.8 20,10.5 20,12.5 0,6.8" fill="#000"/></svg>`,
  tl: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#DC241F"/><polygon points="0,0 11,6.5 0,13" fill="#FFC726"/><polygon points="0,0 7.5,6.5 0,13" fill="#000"/><polygon points="2.8,6.5 3.15,5.5 4.0,5.5 3.35,6.1 3.6,7.0 2.8,6.55 2.0,7.0 2.25,6.1 1.6,5.5 2.45,5.5" fill="#fff"/></svg>`,
  nz: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 13"><rect width="20" height="13" fill="#012169"/><path d="M0,0 L10,6.5 M10,0 L0,6.5" stroke="#fff" stroke-width="1.6"/><path d="M0,0 L10,6.5 M10,0 L0,6.5" stroke="#C8102E" stroke-width="0.9"/><rect x="4.3" width="1.4" height="6.5" fill="#fff"/><rect y="2.55" width="10" height="1.4" fill="#fff"/><rect x="4.65" width="0.7" height="6.5" fill="#C8102E"/><rect y="2.9" width="10" height="0.7" fill="#C8102E"/></svg>`,
};

// ── Public helpers ────────────────────────────────────────────────────────────

export function getFlagUri(countryCode?: string | null): string {
  if (!countryCode) return "";
  const svg = F[countryCode.toLowerCase()];
  if (!svg) return "";
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function getIcaoFlagUri(icao?: string | null): string {
  return getFlagUri(icaoToCountry(icao));
}
