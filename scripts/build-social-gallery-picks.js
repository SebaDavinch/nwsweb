import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

const workspaceRoot = path.resolve(process.cwd());
dotenv.config();
if (!process.env.AUTH_STORAGE_FILE) {
  dotenv.config({ path: path.resolve(workspaceRoot, "temp_vamsys.env") });
}

const authStoreFile = process.env.AUTH_STORAGE_FILE
  ? path.resolve(workspaceRoot, process.env.AUTH_STORAGE_FILE)
  : path.resolve(workspaceRoot, "data/auth-store.json");
const dataDir = path.dirname(authStoreFile);
const socialGalleryFile = path.join(dataDir, "social-gallery.json");
const picksFile = path.join(dataDir, "social-gallery-picks.json");
const picksLimit = Math.max(Number(process.env.SOCIAL_GALLERY_PICKS_LIMIT || 18) || 18, 1);
const minLikes = Math.max(Number(process.env.SOCIAL_GALLERY_MIN_LIKES || 1) || 1, 0);

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, payload) {
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, filePath);
}

function normalizeText(value, fallback = "") {
  const resolved = String(value || "").trim();
  return resolved || fallback;
}

function buildScore(item) {
  const likes = Array.isArray(item?.likes) ? item.likes.length : 0;
  const createdAt = Date.parse(String(item?.createdAt || ""));
  const ageDays = Number.isFinite(createdAt) ? Math.max(0, (Date.now() - createdAt) / 86400000) : 365;
  const freshnessBoost = Math.max(0, 30 - ageDays) * 0.5;
  const visibilityBoost = String(item?.visibility || "public") === "public" ? 8 : -100;
  const tagBoost = Array.isArray(item?.tags) ? Math.min(item.tags.length, 5) : 0;
  return likes * 12 + freshnessBoost + visibilityBoost + tagBoost;
}

ensureDataDir();

const store = readJson(socialGalleryFile, { categories: [], albums: [], media: [], activity: [] });
const albumsById = new Map((Array.isArray(store?.albums) ? store.albums : []).map((item) => [String(item?.id || ""), item]));
const categoriesById = new Map((Array.isArray(store?.categories) ? store.categories : []).map((item) => [String(item?.id || ""), item]));

const publicMedia = (Array.isArray(store?.media) ? store.media : [])
  .filter((item) => String(item?.visibility || "public") !== "private")
  .filter((item) => normalizeText(item?.assetUrl))
  .filter((item) => (Array.isArray(item?.likes) ? item.likes.length : 0) >= minLikes);

const ranked = [...publicMedia]
  .sort((left, right) => {
    const scoreDiff = buildScore(right) - buildScore(left);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return Date.parse(String(right?.createdAt || "")) - Date.parse(String(left?.createdAt || ""));
  })
  .slice(0, picksLimit)
  .map((item, index) => {
    const album = albumsById.get(String(item?.albumId || "")) || null;
    const categoryTitles = Array.isArray(item?.categoryIds)
      ? item.categoryIds
          .map((categoryId) => categoriesById.get(String(categoryId || "")))
          .filter(Boolean)
          .map((category) => normalizeText(category?.title))
          .filter(Boolean)
      : [];
    return {
      id: String(item?.id || `pick-${index + 1}`),
      title: normalizeText(item?.title, "Untitled screenshot"),
      assetUrl: normalizeText(item?.assetUrl),
      ownerPilotId: Number(item?.ownerPilotId || 0) || null,
      ownerUsername: normalizeText(item?.ownerUsername) || null,
      ownerName: normalizeText(item?.ownerName, "Pilot"),
      likeCount: Array.isArray(item?.likes) ? item.likes.length : 0,
      albumTitle: normalizeText(album?.title) || null,
      categoryTitles,
      tags: Array.isArray(item?.tags) ? item.tags.map((tag) => normalizeText(tag)).filter(Boolean) : [],
      createdAt: normalizeText(item?.createdAt) || null,
      selectedAt: new Date().toISOString(),
      rank: index + 1,
      score: Number(buildScore(item).toFixed(2)),
    };
  });

const payload = {
  generatedAt: new Date().toISOString(),
  picks: ranked,
  stats: {
    totalPicks: ranked.length,
    totalCandidates: publicMedia.length,
    minLikes,
    picksLimit,
  },
};

writeJson(picksFile, payload);

console.log(`Generated ${ranked.length} social gallery picks -> ${path.relative(workspaceRoot, picksFile)}`);