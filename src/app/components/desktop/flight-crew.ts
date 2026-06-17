// Детерминированная генерация состава экипажа для рейса.
// vAMSYS не отдаёт экипаж — генерируем локально из базы имён по авиакомпании,
// привязываясь к bookingId/callsign, чтобы у одного рейса экипаж был стабильным.

export type CrewAirline = "nordwind" | "ikar" | "southwind";

export type CrewRole = "captain" | "firstOfficer" | "purser" | "attendant";

export interface CrewMember {
  role: CrewRole;
  name: string;
  initials: string;
  gender: "m" | "f";
}

const ROLE_LABELS: Record<CrewRole, { ru: string; en: string }> = {
  captain: { ru: "Командир воздушного судна", en: "Captain" },
  firstOfficer: { ru: "Второй пилот", en: "First Officer" },
  purser: { ru: "Старший бортпроводник", en: "Purser" },
  attendant: { ru: "Бортпроводник", en: "Flight Attendant" },
};

export function crewRoleLabel(role: CrewRole, language: string): string {
  return language === "ru" ? ROLE_LABELS[role].ru : ROLE_LABELS[role].en;
}

// ── Базы имён ──

const RU_MALE_FIRST = [
  "Александр", "Алексей", "Андрей", "Дмитрий", "Сергей", "Иван", "Михаил", "Николай",
  "Павел", "Роман", "Владимир", "Евгений", "Максим", "Артём", "Денис", "Константин",
  "Виктор", "Олег", "Игорь", "Юрий",
];
const RU_FEMALE_FIRST = [
  "Анна", "Елена", "Мария", "Ольга", "Наталья", "Татьяна", "Ирина", "Екатерина",
  "Светлана", "Юлия", "Дарья", "Ксения", "Виктория", "Алина", "Полина", "Марина",
  "Вероника", "Александра", "Надежда", "Людмила",
];
// Фамилии в мужской форме; для женщин адаптируются ниже.
const RU_LAST = [
  "Иванов", "Смирнов", "Кузнецов", "Попов", "Соколов", "Лебедев", "Козлов", "Новиков",
  "Морозов", "Петров", "Волков", "Соловьёв", "Васильев", "Зайцев", "Павлов", "Семёнов",
  "Голубев", "Виноградов", "Богданов", "Воробьёв", "Фёдоров", "Михайлов", "Беляев", "Тарасов",
];

const TR_MALE_FIRST = [
  "Mehmet", "Mustafa", "Ahmet", "Ali", "Hüseyin", "Hasan", "İbrahim", "Osman",
  "Yusuf", "Murat", "Emre", "Burak", "Kerem", "Can", "Cem", "Onur",
];
const TR_FEMALE_FIRST = [
  "Ayşe", "Fatma", "Emine", "Hatice", "Zeynep", "Elif", "Merve", "Esra",
  "Büşra", "Selin", "Derya", "Gül", "Sevgi", "Ebru", "Pınar", "Aslı",
];
const TR_LAST = [
  "Yılmaz", "Kaya", "Demir", "Şahin", "Çelik", "Yıldız", "Yıldırım", "Öztürk",
  "Aydın", "Arslan", "Doğan", "Kılıç", "Aslan", "Çetin", "Korkmaz", "Koç",
];

// ── PRNG (детерминированный по строке) ──

function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Определение авиакомпании по callsign/маршруту ──

export function detectAirline(callsign?: string, flightNumber?: string): CrewAirline {
  const s = `${callsign || ""} ${flightNumber || ""}`.toUpperCase();
  if (/\b(STW|SWI|SOUTHWIND|ЮЖНЫЙ)\b/.test(s) || /^STW/.test(s)) return "southwind";
  if (/\b(KAR|IKAR|ИКАР|PEGAS)\b/.test(s) || /^KAR/.test(s)) return "ikar";
  return "nordwind";
}

// Женская форма русской фамилии.
function feminizeRu(last: string): string {
  if (/(ов|ев|ёв|ин|ын)$/.test(last)) return last + "а";
  if (/ский$/.test(last)) return last.replace(/ский$/, "ская");
  if (/ой$/.test(last)) return last.replace(/ой$/, "ая");
  return last;
}

function pick<T>(rnd: () => number, arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length) % arr.length];
}

function makeMember(rnd: () => number, role: CrewRole, airline: CrewAirline): CrewMember {
  const gender: "m" | "f" = rnd() < 0.5 ? "m" : "f";
  // Southwind — смешанная база (русские + турецкие имена).
  const useTurkish = airline === "southwind" && rnd() < 0.5;

  let first: string;
  let last: string;
  if (useTurkish) {
    first = pick(rnd, gender === "m" ? TR_MALE_FIRST : TR_FEMALE_FIRST);
    last = pick(rnd, TR_LAST);
  } else {
    first = pick(rnd, gender === "m" ? RU_MALE_FIRST : RU_FEMALE_FIRST);
    const base = pick(rnd, RU_LAST);
    last = gender === "f" ? feminizeRu(base) : base;
  }

  const name = `${first} ${last}`;
  const initials = `${first[0] || ""}${last[0] || ""}`.toUpperCase();
  return { role, name, initials, gender };
}

// Число бортпроводников по типу ВС (грубая прикидка по вместимости).
function cabinCrewCount(aircraft: string): number {
  const a = (aircraft || "").toUpperCase();
  if (/(777|787|A33|A35|330|350|767|74)/.test(a)) return 8;
  if (/(757|320N|321|A21|32Q)/.test(a)) return 5;
  if (/(737|320|319|318|E19|E29|A22|SU9|SSJ|RJ)/.test(a)) return 4;
  return 4;
}

export interface GeneratedCrew {
  airline: CrewAirline;
  flightDeck: CrewMember[];
  cabin: CrewMember[];
}

export function generateCrew(opts: {
  bookingId: number | string;
  callsign?: string;
  flightNumber?: string;
  aircraft?: string;
}): GeneratedCrew {
  const airline = detectAirline(opts.callsign, opts.flightNumber);
  const seed = hashString(`${opts.bookingId}|${opts.callsign || ""}|${airline}`);
  const rnd = mulberry32(seed);

  const captain = makeMember(rnd, "captain", airline);
  const firstOfficer = makeMember(rnd, "firstOfficer", airline);

  const total = cabinCrewCount(opts.aircraft || "");
  const cabin: CrewMember[] = [];
  cabin.push(makeMember(rnd, "purser", airline));
  for (let i = 1; i < total; i++) cabin.push(makeMember(rnd, "attendant", airline));

  return { airline, flightDeck: [captain, firstOfficer], cabin };
}
