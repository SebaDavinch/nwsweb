import { Link } from "react-router";
import { Plane, Users, Globe, Clock, ExternalLink, ChevronDown, ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { motion, useInView, useScroll, useTransform } from "motion/react";
import { Button } from "./ui/button";
import { useLanguage } from "../context/language-context";
import { useSiteDesign } from "../hooks/use-site-design";
import { LiveFlightsWidget } from "./live-flights-widget";
import galleryImg1 from "@/assets/5399b1ff6c2f0f60fae26334dfbbcd6d43360dfb.png";
import galleryImg2 from "@/assets/adb05c43b73dc08fc1b4b481360d4c324c56de2c.png";
import galleryImg3 from "@/assets/e32c89aaade0d583e6bedee50681f610342d9a76.png";
import galleryImg4 from "@/assets/26e15098031469524c864ad646ad94972bd0af05.png";
import galleryImg5 from "@/assets/918b78e77231a5b76fcbed9da5749ce9227bc6ca.png";

interface GalleryFeaturedItem {
  id: string;
  title: string;
  assetUrl: string;
  ownerName?: string | null;
  ownerCallsign?: string | null;
  likeCount?: number;
  source?: string;
}

// Animated counter hook
function useCountUp(target: number | null, inView: boolean, duration = 2000) {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!inView || target === null) return;
    const start = Date.now();
    const step = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      }
    };
    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [target, inView, duration]);

  return value;
}

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: EASE_OUT },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

function StatCard({
  icon: Icon,
  label,
  rawValue,
  suffix = "",
  compact = false,
  language = "ru",
}: {
  icon: React.ElementType;
  label: string;
  rawValue: number | null | undefined;
  suffix?: string;
  compact?: boolean;
  language?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const numeric = rawValue !== null && rawValue !== undefined && !Number.isNaN(Number(rawValue)) ? Number(rawValue) : null;
  const counted = useCountUp(numeric, inView);

  const formatDisplay = () => {
    if (numeric === null) return "—";
    if (!compact || numeric < 1000) return counted.toLocaleString() + suffix;
    const abs = Math.abs(numeric);
    const compactSuffix = abs >= 1_000_000 ? (language === "ru" ? "м" : "m") : (language === "ru" ? "к" : "k");
    const divisor = abs >= 1_000_000 ? 1_000_000 : 1000;
    const ratio = counted / divisor;
    return ratio.toFixed(ratio >= 10 ? 0 : 1).replace(/\.0$/, "") + compactSuffix + suffix;
  };

  return (
    <motion.div
      ref={ref}
      variants={fadeUp}
      className="relative flex flex-col items-center gap-3 rounded-3xl border border-white/8 bg-white/5 p-8 backdrop-blur-sm text-center"
      whileHover={{ scale: 1.03, borderColor: "rgba(227,30,36,0.4)" }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E31E24]/15 ring-1 ring-[#E31E24]/30">
        <Icon className="h-7 w-7 text-[#E31E24]" />
      </div>
      <div className="text-4xl font-bold text-white tabular-nums tracking-tight">{formatDisplay()}</div>
      <div className="text-sm font-medium uppercase tracking-[0.18em] text-white/50">{label}</div>
    </motion.div>
  );
}

export function Home() {
  const { t, language } = useLanguage();
  const design = useSiteDesign();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const vkCommunityUrl = String(design.vkCommunityUrl || "").trim();
  const vkWidgetUrl = String(design.vkWidgetUrl || "").trim();
  const vkCommunityName = String(design.vkCommunityName || "").trim() || "Nordwind Virtual VK";

  const [summary, setSummary] = useState<{
    pilots?: number | null;
    pirepsTotal?: number | null;
    aircraftTotal?: number | null;
    flightHours?: number | null;
  } | null>(null);
  const [featuredGallery, setFeaturedGallery] = useState<GalleryFeaturedItem[]>([]);

  const staticFallback: GalleryFeaturedItem[] = [
    { id: "s1", title: "Nordwind Boeing 737", assetUrl: galleryImg1 },
    { id: "s2", title: "Nordwind Tail", assetUrl: galleryImg2 },
    { id: "s3", title: "Nordwind Boeing 737 in Flight", assetUrl: galleryImg3 },
    { id: "s4", title: "Nordwind A321 Sunset", assetUrl: galleryImg4 },
    { id: "s5", title: "Nordwind Silhouette", assetUrl: galleryImg5 },
  ];

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/vamsys/summary", { credentials: "include" });
        if (res.ok) setSummary(await res.json());
      } catch { /* ignore */ }
    };
    void load();
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/public/gallery/featured");
        if (!res.ok) return;
        const payload = await res.json();
        const items: GalleryFeaturedItem[] = Array.isArray(payload?.items) ? payload.items : [];
        if (items.length > 0) setFeaturedGallery(items);
      } catch { /* static fallback */ }
    };
    void load();
  }, []);

  const getPilotsLabel = (value: number | null | undefined) => {
    const numeric = Number(value);
    if (language !== "ru" || !Number.isFinite(numeric)) return t("home.stats.pilots");
    const mod10 = Math.abs(Math.trunc(numeric)) % 10;
    const mod100 = Math.abs(Math.trunc(numeric)) % 100;
    if (mod10 === 1 && mod100 !== 11) return "Пилот";
    if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return "Пилота";
    return "Пилотов";
  };

  // Hero parallax
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress: heroScroll } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroBgY = useTransform(heroScroll, [0, 1], ["0%", "20%"]);
  const heroOpacity = useTransform(heroScroll, [0, 0.8], [1, 0]);

  const galleryItems = featuredGallery.length > 0 ? featuredGallery : staticFallback;

  return (
    <div className="overflow-x-hidden">
      {/* ─── HERO ─── */}
      <section ref={heroRef} className="relative min-h-[100svh] flex items-center justify-center text-white overflow-hidden">
        {/* Parallax background */}
        <motion.div
          className="absolute inset-0 z-0"
          style={{ y: heroBgY }}
        >
          <div
            className="absolute inset-0 scale-110"
            style={{
              backgroundImage: `url('https://images.unsplash.com/photo-1663007714483-2fe4742a6a3c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhaXJwbGFuZSUyMHdpbmclMjBjbG91ZHMlMjBza3l8ZW58MXx8fHwxNzcxMTA2NjE4fDA&ixlib=rb-4.1.0&q=80&w=1920')`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          {/* Nordwind brand overlay — dark navy tint */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0D1018]/75 via-[#131B2E]/50 to-[#0D1018]/85" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#131B2E]/40 via-transparent to-black/15" />
        </motion.div>

        {/* Noise texture overlay for depth */}
        <div
          className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundRepeat: "repeat" }}
        />

        {/* Hero content */}
        <motion.div
          className="relative z-10 max-w-5xl mx-auto px-6 text-center"
          style={{ opacity: heroOpacity }}
        >
          {/* Live badge */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 backdrop-blur-sm mb-8"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E31E24] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E31E24]" />
            </span>
            {tr("Виртуальная авиакомпания", "Virtual Airline")}
          </motion.div>

          {/* Main heading — Oswald display font, Nordwind brand */}
          <div className="overflow-hidden mb-6">
            <motion.h1
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.35, ease: EASE_OUT }}
              className="leading-[1.0] tracking-wide uppercase"
              style={{ fontFamily: "var(--font-display)" }}
            >
              <span className="block text-white/85 text-3xl sm:text-4xl md:text-5xl font-medium tracking-[0.25em] mb-1">
                {t("home.hero.title")}
              </span>
              <span
                className="block text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-bold tracking-tight"
                style={{ color: "#E31E24" }}
              >
                Nordwind
              </span>
              <span className="block text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-semibold text-white tracking-[0.05em]">
                Virtual
              </span>
            </motion.h1>
          </div>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6, ease: "easeOut" }}
            className="text-lg md:text-xl text-white/65 mb-12 max-w-2xl mx-auto leading-relaxed"
          >
            {t("home.hero.subtitle")}
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.75 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Link to="/join">
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <Button
                  className="group bg-[#E31E24] hover:bg-[#C11A20] text-white px-8 py-4 text-base font-semibold rounded-2xl shadow-lg shadow-red-900/30 transition-all duration-200 flex items-center gap-2"
                >
                  {t("home.hero.join")}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </motion.div>
            </Link>
            <Link to="/about">
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <Button
                  variant="outline"
                  className="bg-white/8 border border-white/20 text-white hover:bg-white/15 px-8 py-4 text-base font-semibold rounded-2xl backdrop-blur-sm"
                >
                  {t("home.hero.learn")}
                </Button>
              </motion.div>
            </Link>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <ChevronDown className="h-6 w-6 text-white/40" />
          </motion.div>
        </motion.div>

        {/* Photo dissolve into stats */}
        <div
          className="absolute bottom-0 left-0 right-0 h-64 pointer-events-none z-10"
          style={{ background: "linear-gradient(to bottom, transparent 0%, #111214 100%)" }}
        />
      </section>

      {/* ─── STATS ─── */}
      <section className="bg-[#111214] py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <StatCard icon={Users} label={getPilotsLabel(summary?.pilots)} rawValue={summary?.pilots} language={language} />
            <StatCard icon={Plane} label={t("home.stats.flights")} rawValue={summary?.pirepsTotal} />
            <StatCard icon={Globe} label={t("home.stats.destinations")} rawValue={summary?.aircraftTotal} />
            <StatCard icon={Clock} label={t("home.stats.hours")} rawValue={summary?.flightHours} compact language={language} />
          </motion.div>
        </div>
      </section>

      {/* ─── WHY NORDWIND VIRTUAL ─── */}
      <section className="py-28 bg-white dark:bg-[#111214]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
            className="text-center mb-16"
          >
            <div className="inline-block text-xs font-bold uppercase tracking-[0.25em] text-[#E31E24] mb-4">
              {tr("Наши преимущества", "Our advantages")}
            </div>
            <h2
              className="text-4xl md:text-5xl font-bold text-[#1a1a1a] dark:text-white leading-tight uppercase tracking-wide"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("home.why.title")}{" "}
              <span style={{ color: "#E31E24" }}>Nordwind Virtual</span>?
            </h2>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {[
              {
                title: t("home.why.feature1.title"),
                desc: t("home.why.feature1.desc"),
                icon: "⚡",
                color: "#E31E24",
              },
              {
                title: t("home.why.feature2.title"),
                desc: t("home.why.feature2.desc"),
                icon: "✈️",
                color: "#2563eb",
              },
              {
                title: t("home.why.feature3.title"),
                desc: t("home.why.feature3.desc"),
                icon: "🌍",
                color: "#16a34a",
              },
            ].map((feature, i) => (
              <motion.div
                key={i}
                custom={i}
                variants={fadeUp}
                whileHover={{ y: -6, boxShadow: "0 20px 40px -12px rgba(0,0,0,0.12)" }}
                className="group relative flex flex-col gap-4 rounded-3xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800/60 p-8 shadow-sm transition-all duration-300 overflow-hidden"
              >
                {/* Subtle gradient top-accent */}
                <div
                  className="absolute top-0 left-0 right-0 h-[3px] rounded-t-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: `linear-gradient(90deg, ${feature.color}, transparent)` }}
                />
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
                  style={{ backgroundColor: `${feature.color}15` }}
                >
                  {feature.icon}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#1a1a1a] dark:text-white mb-2">{feature.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── LIVE FLIGHTS ─── */}
      <div className="bg-[#f8f8f8] dark:bg-gray-950">
        <LiveFlightsWidget />
      </div>

      {/* ─── GALLERY ─── */}
      <section className="py-28 bg-[#0d0d0f]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
            className="text-center mb-14"
          >
            <div className="inline-block text-xs font-bold uppercase tracking-[0.25em] text-[#E31E24] mb-4">
              {tr("Фотогалерея", "Photo gallery")}
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white uppercase tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
              {t("home.gallery.title")}
            </h2>
            <p className="mt-3 text-white/45 text-sm">
              {tr("Лучшие скриншоты от пилотов Nordwind Virtual", "Best screenshots from Nordwind Virtual pilots")}
            </p>
          </motion.div>

          {/* Horizontal scroll carousel */}
          <div className="relative">
            {/* Fade-out right edge hint */}
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-l from-[#0d0d0f] to-transparent" />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6 }}
              className="flex gap-3 overflow-x-auto pb-2 scroll-smooth"
              style={{ scrollSnapType: "x mandatory", scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {galleryItems.map((item, index) => (
                <motion.div
                  key={item.id}
                  className="group relative flex-none overflow-hidden rounded-2xl"
                  style={{ width: "clamp(260px, 35vw, 460px)", aspectRatio: "4/3", scrollSnapAlign: "start" }}
                  whileHover="hover"
                  custom={index}
                >
                  <motion.img
                    src={item.assetUrl}
                    alt={item.title}
                    className="absolute inset-0 w-full h-full object-cover"
                    variants={{ hover: { scale: 1.06 } }}
                    transition={{ duration: 0.5, ease: EASE_OUT }}
                  />
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent"
                    variants={{ hover: { opacity: 1 } }}
                    initial={{ opacity: 0.5 }}
                  />
                  {(item.ownerName || item.ownerCallsign) && (
                    <motion.div
                      className="absolute bottom-0 left-0 right-0 px-4 py-3"
                      initial={{ opacity: 0, y: 8 }}
                      variants={{ hover: { opacity: 1, y: 0 } }}
                      transition={{ duration: 0.22 }}
                    >
                      <div className="text-white text-sm font-semibold">
                        {item.ownerName}
                        {item.ownerCallsign && (
                          <span className="ml-1.5 text-white/60 font-normal">· {item.ownerCallsign.toUpperCase()}</span>
                        )}
                      </div>
                      {typeof item.likeCount === "number" && item.likeCount > 0 && (
                        <div className="text-white/50 text-xs mt-0.5">❤ {item.likeCount}</div>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── COMMUNITY ─── */}
      <section className="bg-[#f4f4f6] dark:bg-[#111214] py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="mb-12"
          >
            <div className="inline-block text-xs font-bold uppercase tracking-[0.25em] text-[#E31E24] mb-3">
              {tr("Сообщество", "Community")}
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-[#1a1a1a] dark:text-white max-w-xl leading-tight">
              {tr("Nordwind сообщество", "Nordwind Community")}
            </h2>
            <p className="mt-4 text-gray-500 dark:text-gray-400 max-w-2xl leading-relaxed">
              {tr(
                "Следите за новостями и общайтесь с пилотами в наших сообществах.",
                "Follow the news and connect with other pilots in our communities."
              )}
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="grid gap-5 lg:grid-cols-2"
          >
            {/* VK */}
            {vkCommunityUrl ? (
              <motion.div
                variants={fadeUp}
                className="rounded-3xl border border-[#0077FF]/20 bg-white dark:bg-gray-800/60 dark:border-[#0077FF]/30 p-7 shadow-sm"
                whileHover={{ y: -4, boxShadow: "0 20px 40px -12px rgba(0,119,255,0.12)" }}
                transition={{ duration: 0.25 }}
              >
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0077FF] text-lg font-black text-white shadow-lg shadow-[#0077FF]/30">
                    VK
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0077FF]">VK</div>
                    <div className="text-xl font-bold text-[#1a1a1a] dark:text-white">{vkCommunityName}</div>
                  </div>
                </div>
                <p className="mb-6 text-sm text-gray-500 leading-relaxed">
                  {tr(
                    "Публичная площадка для новостей, анонсов, репостов и связи с внешней аудиторией Nordwind Virtual.",
                    "A public-facing space for announcements, reposts, updates, and outreach around Nordwind Virtual."
                  )}
                </p>
                <a
                  href={vkCommunityUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-xl bg-[#0077FF] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0064d6] shadow-sm"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {tr("Открыть сообщество VK", "Open VK community")}
                </a>
                <div className="mt-6">
                  {vkWidgetUrl ? (
                    <iframe
                      src={vkWidgetUrl}
                      width="100%"
                      height="300"
                      sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
                      className="rounded-2xl border-0 bg-white"
                      title={vkCommunityName}
                    />
                  ) : (
                    <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-2xl bg-[#f8f8fa] p-6 text-center">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0077FF]/15 text-xs font-bold text-[#0077FF]">VK</div>
                      <p className="text-xs text-gray-400 max-w-xs">
                        {tr("Виджет VK пока не задан.", "The VK widget is not configured yet.")}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : null}
          </motion.div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section
        className="relative py-32 text-white overflow-hidden"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1698073176073-2259484c87b4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhaXJwbGFuZSUyMGNvY2twaXQlMjBwaWxvdHxlbnwxfHx8fDE3NzExODg0MTF8MA&ixlib=rb-4.1.0&q=80&w=1920')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#0D1018]/95 via-[#131B2E]/90 to-[#0D1018]/95" />

        {/* Decorative red glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#E31E24]/10 blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: EASE_OUT }}
          >
            <div className="inline-block text-xs font-bold uppercase tracking-[0.25em] text-[#E31E24] mb-6">
              {tr("Присоединяйся", "Join us")}
            </div>
            <h2 className="text-4xl md:text-6xl font-bold leading-tight mb-6 uppercase tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
              {t("home.cta.title")}
            </h2>
            <p className="text-lg text-white/55 mb-12 max-w-xl mx-auto leading-relaxed">
              {t("home.cta.subtitle")}
            </p>
            <Link to="/join">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                className="inline-block"
              >
                <Button className="group bg-[#E31E24] hover:bg-[#C11A20] text-white px-10 py-5 text-base font-semibold rounded-2xl shadow-2xl shadow-red-900/40 flex items-center gap-2">
                  {t("home.cta.register")}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </motion.div>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
