import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Users } from "lucide-react";
import { useLanguage } from "../../context/language-context";

// ── Seeded PRNG (mulberry32) ──────────────────────────────────────────────────
function mkRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

// ── Name pools ────────────────────────────────────────────────────────────────
interface NamePool {
  label: string;
  flag: string;
  maleFirst: string[];
  femaleFirst: string[];
  maleLast: string[];
  femaleLast: string[];
}

const POOLS: Record<string, NamePool> = {
  russian: {
    label: "RU", flag: "🇷🇺",
    maleFirst:   ["Александр","Дмитрий","Иван","Сергей","Андрей","Михаил","Алексей","Николай","Павел","Владимир","Артём","Денис","Максим","Роман","Кирилл","Евгений","Антон","Илья","Виктор","Олег"],
    femaleFirst: ["Анна","Мария","Елена","Наталья","Ольга","Ирина","Татьяна","Светлана","Юлия","Екатерина","Алина","Ксения","Марина","Виктория","Дарья","Полина","Валерия","Надежда","Людмила","Вера"],
    maleLast:    ["Иванов","Смирнов","Кузнецов","Попов","Васильев","Петров","Соколов","Михайлов","Новиков","Фёдоров","Морозов","Волков","Алексеев","Лебедев","Семёнов","Зайцев","Козлов","Степанов","Николаев","Орлов"],
    femaleLast:  ["Иванова","Смирнова","Кузнецова","Попова","Васильева","Петрова","Соколова","Михайлова","Новикова","Фёдорова","Морозова","Волкова","Алексеева","Лебедева","Семёнова","Зайцева","Козлова","Степанова","Николаева","Орлова"],
  },
  tatar: {
    label: "KAZ", flag: "🇷🇺",
    maleFirst:   ["Айдар","Ильнур","Рустам","Тимур","Ренат","Фарид","Радик","Ильдар","Булат","Азат","Марат","Руслан","Риф","Нияз","Альберт","Ринат","Камиль","Рамиль","Ильяс","Зиннур"],
    femaleFirst: ["Гульнара","Алсу","Лейсан","Миляуша","Гузель","Диля","Алия","Зиля","Эльмира","Рания","Регина","Лилия","Айгуль","Ильсияр","Резеда","Гульфия","Диана","Нилуфар","Сабина","Ляйсан"],
    maleLast:    ["Гарипов","Хасанов","Закиров","Сафин","Габитов","Мухаметов","Шарипов","Нуриев","Ситдиков","Зиннатов","Галимов","Ахметов","Латыпов","Валиев","Сабиров"],
    femaleLast:  ["Гарипова","Хасанова","Закирова","Сафина","Габитова","Мухаметова","Шарипова","Нуриева","Ситдикова","Зиннатова","Галимова","Ахметова","Латыпова","Валиева","Сабирова"],
  },
  uzbek: {
    label: "UZ", flag: "🇺🇿",
    maleFirst:   ["Акбар","Бобур","Шерзод","Фаррух","Отабек","Санжар","Дилшод","Нодир","Жасур","Умид","Зафар","Равшан","Алишер","Ибрагим","Сардор","Хуршид","Хасан","Бехзод","Камол","Азиз"],
    femaleFirst: ["Малика","Нилуфар","Дилноза","Зебо","Гулнора","Феруза","Мадина","Барно","Камола","Мунира","Насиба","Умида","Лола","Дилрабо","Мухаббат","Хилола","Шахло","Гавхар","Дурдона","Наргиза"],
    maleLast:    ["Каримов","Рашидов","Назаров","Исмоилов","Юсупов","Хасанов","Тошматов","Абдуллаев","Мирзаев","Холиков","Норматов","Рахматов","Эргашев","Ниёзов","Тургунов"],
    femaleLast:  ["Каримова","Рашидова","Назарова","Исмоилова","Юсупова","Хасанова","Тошматова","Абдуллаева","Мирзаева","Холикова","Норматова","Рахматова","Эргашева","Ниёзова","Тургунова"],
  },
  kazakh: {
    label: "KZ", flag: "🇰🇿",
    maleFirst:   ["Нурлан","Асет","Болат","Даурен","Ерлан","Жандос","Айбек","Серик","Руслан","Арман","Бауыржан","Темірлан","Дамир","Алмас","Самат","Санжар","Расул","Ерболат","Нұрсұлтан","Мейрам"],
    femaleFirst: ["Айгүл","Динара","Гульнара","Алия","Мадина","Жулдыз","Алтынай","Сабина","Камила","Айнур","Зарина","Асель","Назгуль","Ақерке","Айдана","Томирис","Гаухар","Дариға","Жанна","Ұлбосын"],
    maleLast:    ["Ахметов","Нурмагамбетов","Бекқали","Жаксыбеков","Сейткали","Байжанов","Алибеков","Касымов","Телебаев","Абенов","Дюсенов","Ибрагимов","Мусин","Сатпаев","Қасымов"],
    femaleLast:  ["Ахметова","Нурмагамбетова","Бекқалиева","Жаксыбекова","Сейткалиева","Байжанова","Алибекова","Касымова","Телебаева","Абенова","Дюсенова","Ибрагимова","Мусина","Сатпаева","Қасымова"],
  },
  turkish: {
    label: "TR", flag: "🇹🇷",
    maleFirst:   ["Mehmet","Ali","Mustafa","Ahmet","Hasan","Hüseyin","İbrahim","Ömer","Yusuf","Murat","Can","Burak","Emre","Serkan","Kemal","Fatih","Volkan","Cem","Onur","Tolga"],
    femaleFirst: ["Fatma","Ayşe","Zeynep","Emine","Hatice","Elif","Merve","Selin","Büşra","Derya","Esra","Kübra","Özlem","Nurgül","Tuğba","İrem","Gizem","Pınar","Yasemin","Dilek"],
    maleLast:    ["Yılmaz","Kaya","Demir","Şahin","Çelik","Öztürk","Arslan","Doğan","Yıldız","Koç","Çetin","Ay","Polat","Güler","Aydın","Erdoğan","Özkan","Şimşek","Yıldırım","Demirci"],
    femaleLast:  ["Yılmaz","Kaya","Demir","Şahin","Çelik","Öztürk","Arslan","Doğan","Yıldız","Koç","Çetin","Ay","Polat","Güler","Aydın","Erdoğan","Özkan","Şimşek","Yıldırım","Demirci"],
  },
  british: {
    label: "GB", flag: "🇬🇧",
    maleFirst:   ["James","Oliver","Harry","George","Jack","Noah","Charlie","Jacob","Alfie","Freddie","William","Thomas","Joshua","Henry","Samuel","Ethan","Max","Leo","Luke","Edward"],
    femaleFirst: ["Olivia","Emma","Sophie","Emily","Isla","Poppy","Ava","Isabella","Lily","Grace","Charlotte","Amelia","Mia","Ella","Alice","Scarlett","Chloe","Ruby","Florence","Rosie"],
    maleLast:    ["Smith","Jones","Williams","Brown","Taylor","Davies","Evans","Wilson","Thomas","Roberts","Johnson","Lewis","Walker","Robinson","Wood","Clark","Hall","Wright","Mitchell","Turner"],
    femaleLast:  ["Smith","Jones","Williams","Brown","Taylor","Davies","Evans","Wilson","Thomas","Roberts","Johnson","Lewis","Walker","Robinson","Wood","Clark","Hall","Wright","Mitchell","Turner"],
  },
  german: {
    label: "DE", flag: "🇩🇪",
    maleFirst:   ["Hans","Wolfgang","Klaus","Dieter","Franz","Karl","Werner","Helmut","Otto","Lukas","Felix","Paul","Leon","Tim","Jonas","Finn","Elias","Max","Moritz","Sebastian"],
    femaleFirst: ["Maria","Anna","Elisabeth","Ursula","Monika","Christine","Stefanie","Sandra","Petra","Andrea","Laura","Lena","Sarah","Julia","Hannah","Leonie","Mia","Sophie","Lisa","Nina"],
    maleLast:    ["Müller","Schmidt","Schneider","Fischer","Weber","Meyer","Wagner","Becker","Schulz","Hoffmann","Schäfer","Koch","Bauer","Richter","Klein","Wolf","Schröder","Neumann","Schwarz","Zimmermann"],
    femaleLast:  ["Müller","Schmidt","Schneider","Fischer","Weber","Meyer","Wagner","Becker","Schulz","Hoffmann","Schäfer","Koch","Bauer","Richter","Klein","Wolf","Schröder","Neumann","Schwarz","Zimmermann"],
  },
  arabic: {
    label: "AE", flag: "🇦🇪",
    maleFirst:   ["Mohammed","Ahmed","Ali","Omar","Khalid","Abdullah","Hamad","Saeed","Faisal","Tariq","Youssef","Hassan","Ibrahim","Karim","Nasser","Rashid","Walid","Bilal","Zaid","Jasim"],
    femaleFirst: ["Fatima","Aisha","Mariam","Sara","Layla","Noor","Hessa","Moza","Sheikha","Reem","Dana","Lina","Hana","Noura","Shamma","Amal","Dina","Rania","Salma","Ghada"],
    maleLast:    ["Al-Rashidi","Al-Mansouri","Al-Maktoum","Al-Farsi","Al-Khalifa","Al-Hamdan","Al-Sayed","Al-Bakri","Al-Nasser","Al-Mutairi","Al-Harbi","Al-Qahtani","Al-Dosari","Al-Balushi","Al-Shamsi"],
    femaleLast:  ["Al-Rashidi","Al-Mansouri","Al-Maktoum","Al-Farsi","Al-Khalifa","Al-Hamdan","Al-Sayed","Al-Bakri","Al-Nasser","Al-Mutairi","Al-Harbi","Al-Qahtani","Al-Dosari","Al-Balushi","Al-Shamsi"],
  },
  ukrainian: {
    label: "UA", flag: "🇺🇦",
    maleFirst:   ["Олексій","Андрій","Богдан","Василь","Дмитро","Євген","Іван","Кирило","Максим","Микола","Назар","Олег","Павло","Роман","Сергій","Тарас","Юрій","Ярослав","Владислав","Данило"],
    femaleFirst: ["Анастасія","Вікторія","Дарина","Ірина","Катерина","Людмила","Марина","Наталія","Оксана","Олена","Поліна","Соломія","Тетяна","Уляна","Юлія","Ганна","Діана","Зоряна","Леся","Мар'яна"],
    maleLast:    ["Коваленко","Шевченко","Бондаренко","Ткаченко","Мельник","Кравченко","Олійник","Лисенко","Павленко","Савченко","Поліщук","Яременко","Гаврилюк","Литвин","Василенко"],
    femaleLast:  ["Коваленко","Шевченко","Бондаренко","Ткаченко","Мельник","Кравченко","Олійник","Лисенко","Павленко","Савченко","Поліщук","Яременко","Гаврилюк","Литвин","Василенко"],
  },
};

const KAZAN_AIRPORTS = new Set(["UWKG","UWKD","UWKS","UWKE"]);

function icaoToPools(icao: string): [string, number][] {
  const code = icao.toUpperCase();
  if (KAZAN_AIRPORTS.has(code)) return [["tatar", 0.6], ["russian", 0.4]];
  const p2 = code.slice(0, 2);
  const p1 = code.slice(0, 1);
  if (p2 === "UT" || p2 === "US") return [["uzbek", 1]];
  if (p2 === "UA" || p2 === "UC") return [["kazakh", 0.7], ["russian", 0.3]];
  if (p2 === "UK") return [["ukrainian", 1]];
  if (p2 === "UM") return [["russian", 1]];
  if (p2 === "UB") return [["russian", 0.4], ["arabic", 0.6]];
  if (p2 === "UG") return [["russian", 0.3], ["arabic", 0.7]];
  if (p2 === "LT") return [["turkish", 1]];
  if (p2 === "EG") return [["british", 1]];
  if (p2 === "ED" || p2 === "ET") return [["german", 1]];
  if (p2 === "OM" || p2 === "OT" || p2 === "OE" || p2 === "OB") return [["arabic", 1]];
  if (p1 === "U") return [["russian", 1]];
  if (p1 === "L" || p1 === "E") return [["british", 0.5], ["german", 0.5]];
  if (p1 === "O") return [["arabic", 1]];
  return [["russian", 0.7], ["british", 0.3]];
}

function pickPool(rng: () => number, pools: [string, number][]): NamePool {
  const r = rng();
  let cum = 0;
  for (const [key, weight] of pools) {
    cum += weight;
    if (r < cum) return POOLS[key] ?? POOLS.russian;
  }
  return POOLS[pools[0][0]] ?? POOLS.russian;
}

function generateSeats(count: number, rng: () => number): string[] {
  const allSeats: string[] = [];
  for (let row = 1; row <= 4; row++)
    for (const s of ["A","B","C","D"]) allSeats.push(`${row}${s}`);
  for (let row = 5; row <= 38; row++)
    for (const s of ["A","B","C","D","E","F"]) allSeats.push(`${row}${s}`);
  for (let i = allSeats.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [allSeats[i], allSeats[j]] = [allSeats[j], allSeats[i]];
  }
  return allSeats.slice(0, count).sort((a, b) => {
    const ra = parseInt(a, 10), rb = parseInt(b, 10);
    return ra !== rb ? ra - rb : a.slice(-1).localeCompare(b.slice(-1));
  });
}

interface Passenger {
  seat: string;
  row: number;
  col: string;
  lastName: string;
  firstName: string;
  gender: "M" | "F";
  birthYear: number;
  nationality: string;
  flag: string;
}

function generateManifest(bookingId: number, depIcao: string, arrIcao: string, paxCount: number): Passenger[] {
  const seed = Math.abs(bookingId * 2654435761 + depIcao.split("").reduce((a, c) => a + c.charCodeAt(0), 0));
  const rng = mkRng(seed);
  const depPools = icaoToPools(depIcao);
  const arrPools = icaoToPools(arrIcao);
  const seats = generateSeats(paxCount, rng);
  return seats.map((seat) => {
    const pools = rng() < 0.5 ? depPools : arrPools;
    const pool = pickPool(rng, pools);
    const isFemale = rng() < 0.42;
    return {
      seat,
      row: parseInt(seat, 10),
      col: seat.replace(/\d+/, ""),
      lastName: isFemale ? pick(rng, pool.femaleLast) : pick(rng, pool.maleLast),
      firstName: isFemale ? pick(rng, pool.femaleFirst) : pick(rng, pool.maleFirst),
      gender: isFemale ? "F" : "M",
      birthYear: 1950 + Math.floor(rng() * 60),
      nationality: pool.label,
      flag: pool.flag,
    };
  });
}

// ── Seat Map ──────────────────────────────────────────────────────────────────
function SeatMap({ manifest }: { manifest: Passenger[] }) {
  const [tooltip, setTooltip] = useState<{ seat: string; name: string; gender: "M"|"F" } | null>(null);

  const seatMap = useMemo(() => {
    const m = new Map<string, Passenger>();
    manifest.forEach((p) => m.set(p.seat, p));
    return m;
  }, [manifest]);

  const maxRow = useMemo(() => Math.max(...manifest.map((p) => p.row), 4), [manifest]);

  const businessCols = ["A","B","C","D"];
  const economyCols  = ["A","B","C","D","E","F"];

  return (
    <div className="overflow-x-auto pb-2">
      <div className="inline-block min-w-full">
        {/* Column header */}
        <div className="mb-1 flex gap-px pl-8">
          {["A","B","C"].map((c) => (
            <div key={c} className="w-6 text-center text-[10px] font-bold text-gray-400">{c}</div>
          ))}
          <div className="w-4" />
          {["D","E","F"].map((c) => (
            <div key={c} className="w-6 text-center text-[10px] font-bold text-gray-400">{c}</div>
          ))}
        </div>

        {/* Rows */}
        {Array.from({ length: maxRow }, (_, i) => i + 1).map((row) => {
          const isBusiness = row <= 4;
          const cols = isBusiness ? businessCols : economyCols;
          const leftCols  = isBusiness ? ["A","B"] : ["A","B","C"];
          const rightCols = isBusiness ? ["C","D"] : ["D","E","F"];

          return (
            <div key={row} className={`flex items-center gap-px mb-px ${isBusiness ? "" : ""}`}>
              <div className="w-7 text-right text-[10px] text-gray-400 pr-1 shrink-0">{row}</div>
              {/* Left seats */}
              {leftCols.map((col) => {
                const key = `${row}${col}`;
                const pax = seatMap.get(key);
                return (
                  <div
                    key={col}
                    onMouseEnter={() => pax ? setTooltip({ seat: key, name: `${pax.lastName} ${pax.firstName}`, gender: pax.gender }) : undefined}
                    onMouseLeave={() => setTooltip(null)}
                    title={pax ? `${pax.lastName} ${pax.firstName} · ${pax.birthYear} · ${pax.flag}` : key}
                    className={`w-6 h-5 rounded-sm text-[9px] flex items-center justify-center cursor-default transition-all select-none
                      ${isBusiness
                        ? pax
                          ? pax.gender === "M" ? "bg-amber-400 text-white" : "bg-amber-300 text-amber-900"
                          : "bg-amber-100 border border-amber-200"
                        : pax
                          ? pax.gender === "M" ? "bg-blue-500 text-white" : "bg-pink-400 text-white"
                          : "bg-gray-100 border border-gray-200"
                      }
                      ${tooltip?.seat === key ? "ring-2 ring-[#E31E24] z-10" : ""}
                    `}
                  >
                    {pax ? (isBusiness ? "J" : "") : ""}
                  </div>
                );
              })}
              {/* Aisle */}
              <div className="w-3 shrink-0" />
              {/* Right seats */}
              {rightCols.map((col) => {
                const key = `${row}${col}`;
                const pax = seatMap.get(key);
                return (
                  <div
                    key={col}
                    onMouseEnter={() => pax ? setTooltip({ seat: key, name: `${pax.lastName} ${pax.firstName}`, gender: pax.gender }) : undefined}
                    onMouseLeave={() => setTooltip(null)}
                    title={pax ? `${pax.lastName} ${pax.firstName} · ${pax.birthYear} · ${pax.flag}` : key}
                    className={`w-6 h-5 rounded-sm text-[9px] flex items-center justify-center cursor-default transition-all select-none
                      ${isBusiness
                        ? pax
                          ? pax.gender === "M" ? "bg-amber-400 text-white" : "bg-amber-300 text-amber-900"
                          : "bg-amber-100 border border-amber-200"
                        : pax
                          ? pax.gender === "M" ? "bg-blue-500 text-white" : "bg-pink-400 text-white"
                          : "bg-gray-100 border border-gray-200"
                      }
                      ${tooltip?.seat === key ? "ring-2 ring-[#E31E24] z-10" : ""}
                    `}
                  >
                    {pax ? (isBusiness ? "J" : "") : ""}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-gray-500 pl-8">
          <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-4 rounded-sm bg-blue-500" /> Муж. / Male</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-4 rounded-sm bg-pink-400" /> Жен. / Female</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-4 rounded-sm bg-amber-400" /> Бизнес / Business</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-4 rounded-sm bg-gray-100 border border-gray-200" /> Пусто / Empty</span>
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div className="mt-2 pl-8 text-xs text-gray-600">
            <span className="font-medium">{tooltip.seat}</span> — {tooltip.name}
            <span className={`ml-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${tooltip.gender === "M" ? "bg-blue-50 text-blue-600" : "bg-pink-50 text-pink-600"}`}>
              {tooltip.gender}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
interface PassengerManifestProps {
  bookingId: number;
  departureCode: string;
  arrivalCode: string;
  passengers?: number | null;
  flightNumber?: string;
}

const PAGE_SIZE = 30;
type ManifestView = "list" | "map";

export function PassengerManifest({ bookingId, departureCode, arrivalCode, passengers, flightNumber }: PassengerManifestProps) {
  const { language } = useLanguage();
  const isRu = language === "ru";
  const tr = (ru: string, en: string) => (isRu ? ru : en);

  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<ManifestView>("list");
  const [page, setPage] = useState(0);

  const count = Math.max(1, Math.min(300, Number(passengers) || 168));

  const manifest = useMemo(
    () => generateManifest(bookingId, departureCode, arrivalCode, count),
    [bookingId, departureCode, arrivalCode, count],
  );

  const maleCount = manifest.filter((p) => p.gender === "M").length;
  const femaleCount = manifest.filter((p) => p.gender === "F").length;
  const totalPages = Math.ceil(manifest.length / PAGE_SIZE);
  const pageData = manifest.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E31E24]/10">
            <Users className="h-4 w-4 text-[#E31E24]" />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">
              {tr("Список пассажиров", "Passenger Manifest")}
              {flightNumber && <span className="ml-2 text-gray-400 font-normal">· {flightNumber}</span>}
            </div>
            <div className="text-xs text-gray-500">
              {count} {tr("пассажиров", "passengers")}
              <span className="mx-1.5 text-gray-300">·</span>
              ♂ {maleCount} / ♀ {femaleCount}
              <span className="mx-1.5 text-gray-300">·</span>
              {departureCode} → {arrivalCode}
            </div>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className="border-t border-gray-100">
          {/* View toggle + stats */}
          <div className="flex items-center justify-between bg-gray-50 px-5 py-3 border-b border-gray-100">
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>{tr("Всего", "Total")}: <strong className="text-gray-700">{count}</strong></span>
              <span className="text-blue-500 font-medium">♂ {maleCount}</span>
              <span className="text-pink-500 font-medium">♀ {femaleCount}</span>
            </div>
            <div className="flex gap-1 rounded-lg bg-gray-200 p-0.5">
              {(["list","map"] as ManifestView[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${view === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                >
                  {v === "list" ? tr("Список", "List") : tr("Схема", "Map")}
                </button>
              ))}
            </div>
          </div>

          {/* List view */}
          {view === "list" && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      <th className="px-4 py-2.5 text-left w-16">{tr("Место", "Seat")}</th>
                      <th className="px-4 py-2.5 text-left">{tr("Фамилия", "Last Name")}</th>
                      <th className="px-4 py-2.5 text-left">{tr("Имя", "First Name")}</th>
                      <th className="px-4 py-2.5 text-center w-12">{tr("Пол", "Sex")}</th>
                      <th className="px-4 py-2.5 text-center w-20">{tr("Год рожд.", "Born")}</th>
                      <th className="px-4 py-2.5 text-center w-20">{tr("Гражд.", "Nat.")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pageData.map((p, i) => {
                      const isBusiness = p.row <= 4;
                      return (
                        <tr key={`${p.seat}-${i}`} className={`hover:bg-gray-50 transition-colors ${isBusiness ? "bg-amber-50/40" : ""}`}>
                          <td className="px-4 py-2 font-mono font-semibold text-gray-700">
                            {p.seat}
                            {isBusiness && <span className="ml-1 text-[10px] text-amber-500">J</span>}
                          </td>
                          <td className="px-4 py-2 font-medium text-gray-900">{p.lastName}</td>
                          <td className="px-4 py-2 text-gray-600">{p.firstName}</td>
                          <td className="px-4 py-2 text-center">
                            <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${p.gender === "M" ? "bg-blue-50 text-blue-600" : "bg-pink-50 text-pink-600"}`}>
                              {p.gender}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center text-gray-500">{p.birthYear}</td>
                          <td className="px-4 py-2 text-center">
                            <span title={p.nationality}>{p.flag} {p.nationality}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
                  <span className="text-xs text-gray-400">
                    {tr("Показано", "Showing")} {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, count)} {tr("из", "of")} {count}
                  </span>
                  <div className="flex gap-1">
                    <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">←</button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      const idx = totalPages <= 7 ? i : Math.max(0, Math.min(totalPages - 7, page - 3)) + i;
                      return (
                        <button key={idx} type="button" onClick={() => setPage(idx)}
                          className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${idx === page ? "border-[#E31E24] bg-[#E31E24] text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                          {idx + 1}
                        </button>
                      );
                    })}
                    <button type="button" disabled={page === totalPages - 1} onClick={() => setPage((p) => p + 1)}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">→</button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Seat map view */}
          {view === "map" && (
            <div className="px-5 py-4">
              <SeatMap manifest={manifest} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
