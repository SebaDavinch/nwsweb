// Генерация data/changelog.json из истории git.
// Группирует коммиты по тегам версий (если есть), иначе — в один блок "latest".
// Категории по conventional-префиксам: feat/fix/perf/refactor/docs/style/chore/прочее.
// Запуск: node scripts/changelog-from-git.mjs

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "data", "changelog.json");

// execFile без шелла — иначе Windows cmd ломает %-плейсхолдеры git-формата.
function git(...args) {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

const TYPE_MAP = [
  [/^feat(\(.+\))?!?:/i, "feature"],
  [/^fix(\(.+\))?!?:/i, "fix"],
  [/^perf(\(.+\))?!?:/i, "perf"],
  [/^refactor(\(.+\))?!?:/i, "refactor"],
  [/^docs(\(.+\))?!?:/i, "docs"],
  [/^(style|chore|build|ci)(\(.+\))?!?:/i, "chore"],
];

function classify(subject) {
  for (const [re, type] of TYPE_MAP) {
    if (re.test(subject)) return type;
  }
  return "other";
}

function cleanSubject(subject) {
  return subject.replace(/^[a-z]+(\(.+\))?!?:\s*/i, "").trim();
}

// Список тегов (новые → старые)
const tags = git("tag", "--sort=-creatordate").split("\n").filter(Boolean);

function commitsBetween(...rangeArgs) {
  const raw = git("log", ...rangeArgs, "--no-merges", "--date=short", "--pretty=%h|%ad|%s");
  if (!raw) return [];
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [hash, date, ...rest] = line.split("|");
      const subject = rest.join("|");
      return { hash, date, subject, type: classify(subject), text: cleanSubject(subject) };
    });
}

function buildEntry(version, date, commits) {
  // только содержательные категории, исключаем чистый chore-шум при желании оставляем
  const items = commits
    .filter((c) => c.text && c.type !== "chore")
    .map((c) => ({ type: c.type, text: c.text, hash: c.hash }));
  return { version, date, count: items.length, items };
}

const entries = [];

if (tags.length > 0) {
  for (let i = 0; i < tags.length; i += 1) {
    const tag = tags[i];
    const prev = tags[i + 1];
    const range = prev ? `${prev}..${tag}` : tag;
    const commits = commitsBetween(range);
    if (!commits.length) continue;
    const date = git("log", "-1", "--date=short", "--pretty=%ad", tag) || commits[0].date;
    entries.push(buildEntry(tag, date, commits));
  }
  // незарелиженные коммиты после последнего тега
  const unreleased = commitsBetween(`${tags[0]}..HEAD`);
  if (unreleased.length) {
    entries.unshift(buildEntry("Unreleased", unreleased[0].date, unreleased));
  }
} else {
  // тегов нет — берём последние 80 коммитов одним блоком
  const commits = commitsBetween("-n", "80");
  let version = "latest";
  try {
    version = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version || "latest";
  } catch {
    /* ignore */
  }
  entries.push(buildEntry(version, commits[0]?.date || new Date().toISOString().slice(0, 10), commits));
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify({ generatedAt: new Date().toISOString(), entries }, null, 2)}\n`, "utf8");
console.log(`changelog: ${entries.length} version block(s) → ${path.relative(ROOT, OUT)}`);
