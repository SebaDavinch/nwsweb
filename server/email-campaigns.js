// Email-рассылки (маркетинг) для Nordwind Virtual.
// Абстракция отправки: адаптеры SMTP (nodemailer) и API (Resend/Mailgun-совместимый).
// Аудитория — пилоты из ростера vAMSYS + ручной импорт. Согласие/отписка обязательны.
//
// Подключается из server/index.js:
//   import { mountEmailCampaigns } from "./email-campaigns.js";
//   mountEmailCampaigns(app, { requireAdmin, dataDir, loadPilotsRoster, logger });

import fs from "node:fs";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";

// ───────────────────────── Адаптеры отправки ─────────────────────────

function buildTransport() {
  const mode = String(process.env.EMAIL_PROVIDER || "smtp").toLowerCase();

  if (mode === "api") {
    // Универсальный HTTP-адаптер (Resend по умолчанию; совместимо при EMAIL_API_URL).
    const apiKey = process.env.EMAIL_API_KEY || "";
    const apiUrl = process.env.EMAIL_API_URL || "https://api.resend.com/emails";
    return {
      kind: "api",
      ready: Boolean(apiKey),
      async send({ from, to, subject, html, text, headers }) {
        const res = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ from, to, subject, html, text, headers }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(`api ${res.status}: ${body.slice(0, 200)}`);
        }
        return true;
      },
    };
  }

  // SMTP через nodemailer (ленивый импорт, чтобы не грузить без надобности).
  return {
    kind: "smtp",
    ready: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER),
    _transport: null,
    async send({ from, to, subject, html, text, headers }) {
      if (!this._transport) {
        const nodemailer = await import("nodemailer");
        this._transport = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: String(process.env.SMTP_SECURE || "false") === "true",
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" },
        });
      }
      await this._transport.sendMail({ from, to, subject, html, text, headers });
      return true;
    },
  };
}

// ───────────────────────── Хранилища ─────────────────────────

function makeStore(file, base) {
  let cache = null;
  const read = () => {
    if (cache) return cache;
    try {
      cache = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : structuredClone(base);
    } catch {
      cache = structuredClone(base);
    }
    return cache;
  };
  const write = () => {
    try {
      const tmp = `${file}.tmp`;
      fs.writeFileSync(tmp, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
      fs.renameSync(tmp, file);
    } catch {
      /* ignore */
    }
  };
  return { read, write };
}

const FROM = process.env.EMAIL_FROM || "Nordwind Virtual <noreply@vnws.org>";
const SITE = process.env.PUBLIC_SITE_URL || "https://vnws.org";

const unsubToken = (email) =>
  createHash("sha256").update(`${String(email).toLowerCase()}::${process.env.EMAIL_UNSUB_SECRET || "nws-unsub"}`).digest("hex").slice(0, 32);

const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || "").trim());

// Обёртка-каркас письма в фирменной гамме Nordwind (красный акцент).
const wrapTemplate = (heading, bodyHtml, ctaLabel, ctaHref) => `
<div style="max-width:600px;margin:0 auto;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a1a1a">
  <div style="background:#E31E24;padding:20px 24px;border-radius:12px 12px 0 0">
    <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:.5px">NORDWIND VIRTUAL</span>
  </div>
  <div style="border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;padding:28px 24px">
    <h1 style="margin:0 0 16px;font-size:22px;color:#111">${heading}</h1>
    <div style="font-size:15px;line-height:1.6;color:#333">${bodyHtml}</div>
    ${ctaLabel ? `<p style="margin:24px 0 8px"><a href="${ctaHref}" style="display:inline-block;background:#E31E24;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">${ctaLabel}</a></p>` : ""}
  </div>
</div>`.trim();

// Встроенные пресеты (read-only): новость / событие / дайджест.
const BUILTIN_PRESETS = [
  {
    id: "preset-news",
    name: "Новость",
    preset: "news",
    subject: "Свежие новости Nordwind Virtual",
    html: wrapTemplate(
      "Заголовок новости",
      "<p>Привет, {{name}}!</p><p>Здесь текст новости. Расскажите пилотам, что нового в авиакомпании.</p>",
      "Читать на сайте",
      `${SITE}/news`
    ),
  },
  {
    id: "preset-event",
    name: "Событие",
    preset: "event",
    subject: "Приглашаем на событие Nordwind Virtual",
    html: wrapTemplate(
      "Название события",
      "<p>Привет, {{name}}!</p><p>Дата и время: <strong>—</strong></p><p>Описание события и что нужно для участия.</p>",
      "Подробнее о событии",
      `${SITE}/events`
    ),
  },
  {
    id: "preset-digest",
    name: "Дайджест",
    preset: "digest",
    subject: "Дайджест Nordwind Virtual",
    html: wrapTemplate(
      "Дайджест за период",
      "<p>Привет, {{name}}!</p><ul><li>Пункт дайджеста 1</li><li>Пункт дайджеста 2</li><li>Пункт дайджеста 3</li></ul>",
      "Открыть кабинет пилота",
      `${SITE}/dashboard`
    ),
  },
];

export function mountEmailCampaigns(app, { requireAdmin, dataDir, loadPilotsRoster, logger, express }) {
  const campaignsStore = makeStore(path.join(dataDir, "email-campaigns.json"), { campaigns: [] });
  const templatesStore = makeStore(path.join(dataDir, "email-templates.json"), { templates: [] });
  const subsStore = makeStore(path.join(dataDir, "email-subscriptions.json"), {
    unsubscribed: {}, // emailLower -> ISO (отписки через ссылку — всегда исключаются)
    imported: [], // [{email,name}] — текущая база подписанных (из последнего CSV)
    lastImportedAt: null, // ISO последнего обновления базы
    lastDiff: null, // { added, removed, total, at } — итог последней синхронизации
    importHistory: [], // история диффов (до 24)
  });
  const REFRESH_DAYS = Number(process.env.EMAIL_LIST_REFRESH_DAYS || 30);

  // Парсинг CSV: первый столбец — email, второй — имя. Шапка email/name пропускается.
  const parseCsv = (raw) => {
    const out = [];
    for (const line of String(raw || "").split(/[\r\n]+/)) {
      const t = line.trim();
      if (!t) continue;
      const [emailPart, ...rest] = t.split(/[,;\t]/);
      const email = String(emailPart || "").trim().toLowerCase().replace(/^"|"$/g, "");
      if (email === "email" || !isValidEmail(email)) continue; // шапка/мусор
      out.push({ email, name: rest.join(" ").trim().replace(/^"|"$/g, "") });
    }
    return out;
  };
  const transport = buildTransport();
  const json = express.json({ limit: "1mb" });

  // Анализ согласия из ростера: отдаёт ли vAMSYS флаг подписки.
  const analyzeRoster = async () => {
    let withConsentField = 0; // у скольких поле согласия присутствует (не undefined)
    let consented = 0; // из них согласны
    let activeEmails = 0;
    try {
      const roster = await loadPilotsRoster().catch(() => null);
      for (const p of roster?.pilots || []) {
        const email = String(p.email || "").trim().toLowerCase();
        if (!isValidEmail(email) || p.status !== "active") continue;
        activeEmails += 1;
        if (p.marketingConsent !== undefined) {
          withConsentField += 1;
          if (p.marketingConsent) consented += 1;
        }
      }
    } catch {
      /* ignore */
    }
    return { withConsentField, consented, activeEmails, apiProvidesConsent: withConsentField > 0 };
  };

  // Аудитория = подписанные из CSV-базы, минус отписавшиеся через ссылку.
  // vAMSYS согласие не отдаёт, поэтому источник истины — загруженный CSV.
  const buildAudience = async () => {
    const subs = subsStore.read();
    const seen = new Map();
    for (const it of subs.imported || []) {
      const email = String(it.email || "").trim().toLowerCase();
      if (isValidEmail(email) && !subs.unsubscribed[email]) {
        seen.set(email, { email, name: it.name || "", source: "import" });
      }
    }
    return Array.from(seen.values());
  };

  const renderEmail = (html, recipient) => {
    const token = unsubToken(recipient.email);
    const unsubUrl = `${SITE}/api/email/unsubscribe?e=${encodeURIComponent(recipient.email)}&t=${token}`;
    const footer = `<hr style="margin-top:32px;border:none;border-top:1px solid #eee"/><p style="font-size:12px;color:#888">Вы получили это письмо как пилот/подписчик Nordwind Virtual. <a href="${unsubUrl}">Отписаться</a></p>`;
    const body = String(html || "")
      .replace(/\{\{name\}\}/g, recipient.name || "пилот")
      .replace(/\{\{email\}\}/g, recipient.email)
      .replace(/\{\{unsubscribe\}\}/g, unsubUrl);
    return { html: `${body}${footer}`, unsubUrl, token };
  };

  // ── Публичная отписка (страница + API) ──
  app.get("/api/email/unsubscribe", (req, res) => {
    const email = String(req.query.e || "").trim().toLowerCase();
    const token = String(req.query.t || "");
    if (!isValidEmail(email) || token !== unsubToken(email)) {
      res.status(400).send("Invalid unsubscribe link");
      return;
    }
    const subs = subsStore.read();
    subs.unsubscribed[email] = new Date().toISOString();
    subsStore.write();
    res
      .status(200)
      .set("Content-Type", "text/html; charset=utf-8")
      .send(`<!doctype html><meta charset="utf-8"><title>Отписка</title><body style="font-family:system-ui;max-width:560px;margin:60px auto;padding:0 16px;text-align:center"><h2>Вы отписаны</h2><p>${email} больше не будет получать рассылки Nordwind Virtual.</p><a href="${SITE}">На сайт</a></body>`);
  });

  // ── Админ: статус провайдера + аудитория ──
  app.get("/api/admin/email/status", requireAdmin, async (_req, res) => {
    const audience = await buildAudience();
    const subs = subsStore.read();
    const analysis = await analyzeRoster();
    const lastImportedAt = subs.lastImportedAt || null;
    const ageDays = lastImportedAt
      ? Math.floor((Date.now() - Date.parse(lastImportedAt)) / (24 * 60 * 60 * 1000))
      : null;
    const needsRefresh = lastImportedAt == null || (ageDays != null && ageDays >= REFRESH_DAYS);
    res.json({
      provider: transport.kind,
      ready: transport.ready,
      from: FROM,
      audienceCount: audience.length,
      unsubscribedCount: Object.keys(subs.unsubscribed || {}).length,
      importedCount: (subs.imported || []).length,
      list: { lastImportedAt, ageDays, refreshDays: REFRESH_DAYS, needsRefresh, lastDiff: subs.lastDiff || null },
      // Ответ на вопрос «отдаёт ли vAMSYS маркетинг-базу»:
      consent: {
        apiProvidesConsent: analysis.apiProvidesConsent,
        withConsentField: analysis.withConsentField,
        consented: analysis.consented,
        activeEmails: analysis.activeEmails,
      },
    });
  });

  // ── Админ: синхронизация базы из CSV (полная замена) с диффом ──
  // CSV = текущий список ПОДПИСАННЫХ. Считаем: добавилось / отписалось (было, нет в новом).
  // mode: "preview" — только показать дифф; "apply" — применить.
  app.post("/api/admin/email/import", requireAdmin, json, (req, res) => {
    const subs = subsStore.read();
    const mode = String(req.body?.mode || "apply");
    const incoming = parseCsv(req.body?.list || "");
    const incomingMap = new Map(incoming.map((x) => [x.email, x]));
    const prevSet = new Set((subs.imported || []).map((x) => String(x.email).toLowerCase()));

    const added = [];
    for (const [email] of incomingMap) if (!prevSet.has(email)) added.push(email);
    const removed = [];
    for (const email of prevSet) if (!incomingMap.has(email)) removed.push(email);

    const diff = {
      added: added.length,
      removed: removed.length,
      total: incomingMap.size,
      kept: incomingMap.size - added.length,
      at: new Date().toISOString(),
    };

    if (mode === "preview") {
      res.json({ ok: true, preview: true, diff, removedSample: removed.slice(0, 20), addedSample: added.slice(0, 20) });
      return;
    }

    // применяем: новая база = строго содержимое CSV (работаем только с подписанными).
    // отписавшихся через ссылку держим в unsubscribed (они и так исключаются из аудитории).
    subs.imported = Array.from(incomingMap.values());
    subs.lastImportedAt = diff.at;
    subs.lastDiff = diff;
    subs.importHistory = [diff, ...(subs.importHistory || [])].slice(0, 24);
    subsStore.write();
    res.json({ ok: true, diff, total: subs.imported.length, lastImportedAt: subs.lastImportedAt });
  });

  // ── Админ: шаблоны писем (CRUD) + встроенные пресеты ──
  app.get("/api/admin/email/templates", requireAdmin, (_req, res) => {
    res.json({ templates: templatesStore.read().templates, presets: BUILTIN_PRESETS });
  });

  app.post("/api/admin/email/templates", requireAdmin, json, (req, res) => {
    const store = templatesStore.read();
    const t = {
      id: `tpl-${randomUUID()}`,
      name: String(req.body?.name || "").slice(0, 120) || "Без названия",
      subject: String(req.body?.subject || "").slice(0, 300),
      html: String(req.body?.html || "").slice(0, 200000),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.templates.unshift(t);
    templatesStore.write();
    res.json({ ok: true, template: t });
  });

  app.put("/api/admin/email/templates/:id", requireAdmin, json, (req, res) => {
    const store = templatesStore.read();
    const t = store.templates.find((x) => x.id === req.params.id);
    if (!t) return res.status(404).json({ error: "not found" });
    if (req.body?.name != null) t.name = String(req.body.name).slice(0, 120) || t.name;
    if (req.body?.subject != null) t.subject = String(req.body.subject).slice(0, 300);
    if (req.body?.html != null) t.html = String(req.body.html).slice(0, 200000);
    t.updatedAt = new Date().toISOString();
    templatesStore.write();
    res.json({ ok: true, template: t });
  });

  app.delete("/api/admin/email/templates/:id", requireAdmin, (req, res) => {
    const store = templatesStore.read();
    const before = store.templates.length;
    store.templates = store.templates.filter((x) => x.id !== req.params.id);
    if (store.templates.length === before) return res.status(404).json({ error: "not found" });
    templatesStore.write();
    res.json({ ok: true });
  });

  // ── Админ: список/создание/обновление кампаний ──
  app.get("/api/admin/email/campaigns", requireAdmin, (_req, res) => {
    res.json({ campaigns: campaignsStore.read().campaigns });
  });

  app.post("/api/admin/email/campaigns", requireAdmin, json, (req, res) => {
    const store = campaignsStore.read();
    const c = {
      id: `cmp-${randomUUID()}`,
      subject: String(req.body?.subject || "").slice(0, 300),
      html: String(req.body?.html || "").slice(0, 200000),
      status: "draft", // draft | sending | sent
      createdAt: new Date().toISOString(),
      sentAt: null,
      stats: { total: 0, sent: 0, failed: 0 },
    };
    store.campaigns.unshift(c);
    campaignsStore.write();
    res.json({ ok: true, campaign: c });
  });

  app.put("/api/admin/email/campaigns/:id", requireAdmin, json, (req, res) => {
    const store = campaignsStore.read();
    const c = store.campaigns.find((x) => x.id === req.params.id);
    if (!c) return res.status(404).json({ error: "not found" });
    if (c.status !== "draft") return res.status(400).json({ error: "only drafts editable" });
    if (req.body?.subject != null) c.subject = String(req.body.subject).slice(0, 300);
    if (req.body?.html != null) c.html = String(req.body.html).slice(0, 200000);
    campaignsStore.write();
    res.json({ ok: true, campaign: c });
  });

  // ── Админ: тест-отправка на один адрес ──
  app.post("/api/admin/email/campaigns/:id/test", requireAdmin, json, async (req, res) => {
    const store = campaignsStore.read();
    const c = store.campaigns.find((x) => x.id === req.params.id);
    if (!c) return res.status(404).json({ error: "not found" });
    const to = String(req.body?.email || "").trim();
    if (!isValidEmail(to)) return res.status(400).json({ error: "invalid email" });
    if (!transport.ready) return res.status(503).json({ error: "email provider not configured" });
    try {
      const { html } = renderEmail(c.html, { email: to, name: "Test" });
      await transport.send({ from: FROM, to, subject: `[ТЕСТ] ${c.subject}`, html });
      res.json({ ok: true });
    } catch (e) {
      logger?.warn?.("[email] test_failed", String(e));
      res.status(502).json({ error: String(e?.message || e) });
    }
  });

  // ── Админ: запуск рассылки (очередь с троттлингом) ──
  app.post("/api/admin/email/campaigns/:id/send", requireAdmin, async (req, res) => {
    const store = campaignsStore.read();
    const c = store.campaigns.find((x) => x.id === req.params.id);
    if (!c) return res.status(404).json({ error: "not found" });
    if (c.status === "sending") return res.status(409).json({ error: "already sending" });
    if (!transport.ready) return res.status(503).json({ error: "email provider not configured" });

    const audience = await buildAudience();
    c.status = "sending";
    c.stats = { total: audience.length, sent: 0, failed: 0 };
    campaignsStore.write();
    res.json({ ok: true, queued: audience.length });

    // фоновая отправка с паузой (троттлинг), чтобы не упереться в лимиты
    const delayMs = Number(process.env.EMAIL_THROTTLE_MS || 400);
    void (async () => {
      for (const r of audience) {
        try {
          const { html } = renderEmail(c.html, r);
          await transport.send({
            from: FROM,
            to: r.email,
            subject: c.subject,
            html,
            headers: { "List-Unsubscribe": `<${SITE}/api/email/unsubscribe?e=${encodeURIComponent(r.email)}&t=${unsubToken(r.email)}>` },
          });
          c.stats.sent += 1;
        } catch (e) {
          c.stats.failed += 1;
          logger?.warn?.("[email] send_failed", { to: r.email, err: String(e?.message || e) });
        }
        if (c.stats.sent % 20 === 0) campaignsStore.write();
        await new Promise((rr) => setTimeout(rr, delayMs));
      }
      c.status = "sent";
      c.sentAt = new Date().toISOString();
      campaignsStore.write();
      logger?.info?.("[email] campaign_done", { id: c.id, ...c.stats });
    })();
  });

  logger?.info?.("[email] campaigns mounted", { provider: transport.kind, ready: transport.ready });
}
