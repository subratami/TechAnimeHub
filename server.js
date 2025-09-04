import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import axios from "axios";
import cron from "node-cron";
import { XMLParser } from "fast-xml-parser";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });

const SOURCES = {
  tech: [
    "https://www.theverge.com/rss/index.xml",
    "https://feeds.arstechnica.com/arstechnica/index",
	"https://techcrunch.com/feed/",
    "https://www.engadget.com/rss.xml",
    "https://www.wired.com/feed/rss",
    "https://www.tomshardware.com/feeds/all",
    "https://www.theregister.com/headlines.atom",
    "https://hnrss.org/frontpage",
    "https://www.xda-developers.com/feed/",
    "https://feeds.feedburner.com/ign/tech-articles"
  ],
  anime: [
    "https://www.animenewsnetwork.com/all/rss.xml",
	  "https://myanimelist.net/rss/news.xml",
    "https://animeuknews.net/feed/",
    "https://otakuusamagazine.com/feed/"
  ],
  movies: [
    "https://variety.com/feed/",
    "https://www.hollywoodreporter.com/movies/movie-news/feed/",
	  "https://collider.com/feed/",
    "https://www.bollywoodhungama.com/rss/news.xml"
  ]
};

const mem = { tech: [], anime: [], movies: [], fetchedAt: null };
const cacheDir = path.join(__dirname, "cache");
const ogCacheFile = path.join(cacheDir, "og-cache.json");
if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
if (!fs.existsSync(ogCacheFile)) fs.writeFileSync(ogCacheFile, "{}");

function readOGCache() { try { return JSON.parse(fs.readFileSync(ogCacheFile, "utf-8")); } catch { return {}; } }
function writeOGCache(obj) { fs.writeFileSync(ogCacheFile, JSON.stringify(obj, null, 2)); }

function pickFirstImage(item) {
  const media = item["media:content"] || item["media:thumbnail"];
  if (typeof media === 'string') return media;
  if (media?.url) return media.url;
  if (Array.isArray(media) && media[0]?.url) return media[0].url;
  if (item.enclosure?.url) return item.enclosure.url;
  const html = item["content:encoded"] || item.content || "";
  if (typeof html === "string") {
    const m = html.match(/<img[^>]+src=['\"]([^'\"]+)['\"]/i);
    if (m) return m[1];
  }
  return null;
}
function normalizeItem(i) {
  const title = i.title?.["#text"] || i.title || "";
  const link = i.link?.href || i.link || i.guid?.["#text"] || i.guid || "";
  const pubDate = i.pubDate || i.published || i.updated || null;
  let image = pickFirstImage(i);
  return title && link ? { title, link, pubDate, image } : null;
}
async function fetchFeed(url) {
  try {
    const { data } = await axios.get(url, { timeout: 20000, headers: { "User-Agent": "TechAnimeHub/1.0" } });
    const obj = parser.parse(typeof data === "string" ? data : data.toString());
    const items = obj?.rss?.channel?.item || obj?.feed?.entry || [];
    return items.map(normalizeItem).filter(Boolean);
  } catch (e) {
    console.error("Feed error:", url, e.message);
    return [];
  }
}
async function refreshCategory(cat) {
  const urls = SOURCES[cat] || [];
  const all = (await Promise.all(urls.map(fetchFeed))).flat();
  const seen = new Set();
  const dedup = [];
  for (const it of all) { if (!seen.has(it.link)) { seen.add(it.link); dedup.push(it); } }
  mem[cat] = dedup.slice(0, 70);
  mem.fetchedAt = new Date().toISOString();
  return mem[cat];
}
// find OG/Twitter image (cache the URL)
async function ensureThumbnail(item, category) {
  if (item.image) return item.image;
  const ogCache = readOGCache();
  if (ogCache[item.link]) return ogCache[item.link];
  // console.log(`[Thumbnail] Fetching OG image for: ${item.link}`);
  try {
    const resp = await axios.get(item.link, { timeout: 15000, headers: { "User-Agent": "TechAnimeHub/1.0" } });
    const html = resp.data || "";
    const og = String(html).match(/<meta[^>]+property=['\"]og:image['\"][^>]+content=['\"]([^'\"]+)['\"][^>]*>/i);
    const tw = String(html).match(/<meta[^>]+name=['\"]twitter:image['\"][^>]+content=['\"]([^'\"]+)['\"][^>]*>/i);
    const href = String(html).match(/<link[^>]+rel=['\"]image_src['\"][^>]+href=['\"]([^'\"]+)['\"][^>]*>/i);
    const found = og?.[1] || tw?.[1] || href?.[1] || null;
    if (found) {
      // console.log(`[Thumbnail] Found OG image: ${found}`);
      ogCache[item.link] = found;
      writeOGCache(ogCache);
      return found;
    }
  } catch (e) {
    // console.error(`[Thumbnail] Error fetching ${item.link}: ${e.message}`);
  }
  const placeholder = `/placeholders/${category}.svg`;
  // console.log(`[Thumbnail] Using placeholder for ${item.link}: ${placeholder}`);
  return placeholder;
}
// initial prefetch & light enrichment
(async () => {
  for (const c of Object.keys(SOURCES)) await refreshCategory(c);
  for (const cat of Object.keys(SOURCES)) {
    const slice = mem[cat].slice(0, 20);
    for (const it of slice) { it.image = await ensureThumbnail(it, cat); }
  }
})();
// cron refresh
cron.schedule("*/30 * * * *", async () => {
  console.log("Cron: refreshing feeds...");
  for (const c of Object.keys(SOURCES)) await refreshCategory(c);
  console.log("Cron: done.");
});
// endpoints
app.get("/api/news/:category", async (req, res) => {
  const cat = req.params.category;
  if (!SOURCES[cat]) return res.status(404).json({ error: "Unknown category" });
  const out = await Promise.all((mem[cat] || []).slice(0, 60).map(async it => ({ ...it, image: await ensureThumbnail(it, cat) })));
  res.json({ category: cat, fetchedAt: mem.fetchedAt, items: out });
});
app.post("/api/refresh", async (_req, res) => {
  for (const c of Object.keys(SOURCES)) await refreshCategory(c);
  res.json({ ok: true, fetchedAt: mem.fetchedAt });
});
const playlistFile = path.join(__dirname, "data", "playlist.json");
function readPlaylist() { try { return JSON.parse(fs.readFileSync(playlistFile, "utf-8")); } catch { return []; } }
app.get("/api/playlist", (_req, res) => {
  const list = readPlaylist().map(v => ({ ...v, videoId: v.id, thumbnail: v.thumbnail || `https://img.youtube.com/vi/${v.id}/hqdefault.jpg` }));
  res.json(list);
});
app.get("*", (_req, res) => { res.sendFile(path.join(__dirname, "public", "index.html")); });
app.listen(PORT, () => console.log(`✅ TechAnimeHub running at http://localhost:${PORT}`));
