// Comix — https://comix.to
// Catalogue, details, and chapter lists are loaded through mm.http.browser so
// Cloudflare clearance stays in the same WKWebView cookie store as the
// challenge sheet. Signed /api/v1 calls cannot be forged after Comix moved the
// signer into a rotating VM.
const BASE = "https://comix.to";

function browse(url, waitMs) {
  return mm.http.browser(url, { waitMs: waitMs || 0 });
}

function ensureHTML(body) {
  const text = body || "";
  if (/just a moment|cf-browser-verification|challenge-platform|performing security verification/i.test(text)) {
    mm.errors.fail("Cloudflare challenge. Complete the browser check, wait for the real page, then Continue.");
  }
  return text;
}

function initialData(html) {
  const match = String(html || "").match(
    /<script[^>]*id=["']initial-data["'][^>]*>([\s\S]*?)<\/script>/i
  );
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch (e) {
    return null;
  }
}

function queryEntries(data) {
  const queries = (data && data.queries) || {};
  const out = [];
  const keys = Object.keys(queries);
  for (let i = 0; i < keys.length; i++) {
    let parsed = null;
    try {
      parsed = JSON.parse(keys[i]);
    } catch (e) {
      parsed = null;
    }
    out.push({ key: parsed, raw: keys[i], value: queries[keys[i]] });
  }
  return out;
}

function statusOf(text) {
  const t = String(text || "").toLowerCase();
  if (t === "ongoing" || t === "publishing") return "ongoing";
  if (t === "completed" || t === "complete" || t === "ended") return "completed";
  if (t === "hiatus" || t === "on_hold" || t === "on hold") return "hiatus";
  return "unknown";
}

function posterURL(poster, quality) {
  if (!poster) return undefined;
  if (typeof poster === "string") return poster;
  const q = quality || mm.settings.get("poster") || "large";
  if (q === "small") return poster.small || poster.medium || poster.large;
  if (q === "medium") return poster.medium || poster.large || poster.small;
  return poster.large || poster.medium || poster.small;
}

function slugFromItem(item) {
  const url = item.url || "";
  const path = String(url)
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/title\//, "")
    .replace(/^\/+/, "");
  return path || item.hid;
}

function mangaFromItem(item) {
  if (!item || !item.title) return null;
  const authors = (item.authors || item.author || [])
    .map(function (a) {
      return typeof a === "string" ? a : a.title;
    })
    .filter(Boolean);
  const genres = (item.genres || item.genre || item.tags || [])
    .map(function (g) {
      return typeof g === "string" ? g : g.title;
    })
    .filter(Boolean);
  return {
    id: slugFromItem(item),
    title: item.title,
    author: authors.length ? authors.join(", ") : undefined,
    description: item.synopsis || undefined,
    cover: posterURL(item.poster),
    status: statusOf(item.status),
    tags: genres,
    nsfw: /pornographic|erotica/i.test(item.contentRating || ""),
  };
}

function listItems(value) {
  if (!value) return [];
  if (value.items) return value.items;
  if (value.result && value.result.items) return value.result.items;
  return [];
}

function homeBundle() {
  const res = browse(BASE + "/home", 800);
  const html = ensureHTML(res.body);
  const data = initialData(html);
  if (!data) mm.errors.fail("Comix home page had no catalogue data. Retry after Cloudflare.");
  return queryEntries(data);
}

function pickHomeList(mode) {
  const entries = homeBundle();
  let best = null;
  for (let i = 0; i < entries.length; i++) {
    const key = entries[i].key;
    if (!Array.isArray(key) || key[0] !== "manga") continue;
    const items = listItems(entries[i].value).filter(function (it) {
      return it && it.hid && it.title;
    });
    if (!items.length) continue;
    if (mode === "latest") {
      if (key[1] === "list") {
        const opts = key[2] || {};
        if (opts.order && opts.order.chapter_updated_at === "desc") return items;
        if (opts.scope === "hot" && !best) best = items;
      }
    } else {
      if (key[1] === "top" && key[2] && key[2].type === "trending") return items;
      if (key[1] === "top" && key[2] && key[2].type === "follows" && !best) best = items;
      if (key[1] === "list" && key[2] && key[2].scope === "hot" && !best) best = items;
    }
  }
  if (best) return best;
  for (let i = 0; i < entries.length; i++) {
    const items = listItems(entries[i].value).filter(function (it) {
      return it && it.hid && it.title;
    });
    if (items.length) return items;
  }
  return [];
}

function detailFromData(data) {
  const entries = queryEntries(data);
  for (let i = 0; i < entries.length; i++) {
    const key = entries[i].key;
    if (!Array.isArray(key) || key[0] !== "manga" || key[1] !== "detail") continue;
    const value = entries[i].value;
    if (value && value.title) return value;
    if (value && value.data && value.data.title) return value.data;
  }
  if (data && data.manga && data.manga.title) return data.manga;
  return null;
}

function chaptersFromHTML(html, mangaId) {
  const chapters = [];
  const seen = {};
  const hid = String(mangaId || "").split("-")[0];
  const re = /\/title\/([a-z0-9-]+)\/(\d+)-chapter-([\w.-]+)/gi;
  let match;
  while ((match = re.exec(html))) {
    const slug = match[1];
    if (hid && slug.indexOf(hid) !== 0 && slug !== mangaId) continue;
    const numericId = match[2];
    const chapterSlug = match[3];
    if (seen[numericId]) continue;
    seen[numericId] = true;
    const number = Number(String(chapterSlug).replace(/_/g, "."));
    chapters.push({
      id: numericId + "-chapter-" + chapterSlug,
      title: "Chapter " + chapterSlug.replace(/_/g, "."),
      chapter: isNaN(number) ? undefined : number,
      language: "en",
    });
  }
  chapters.sort(function (a, b) {
    const an = a.chapter == null ? -1 : a.chapter;
    const bn = b.chapter == null ? -1 : b.chapter;
    return bn - an;
  });
  const deduped = [];
  const seenNum = {};
  for (let i = 0; i < chapters.length; i++) {
    const key = chapters[i].chapter == null ? chapters[i].id : String(chapters[i].chapter);
    if (seenNum[key]) continue;
    seenNum[key] = true;
    deduped.push(chapters[i]);
  }
  return deduped;
}

const PAGE_SCRIPT =
  "(function(){" +
  "var out=[],seen={};" +
  "function add(u){if(!u||seen[u])return;if(/^data:/i.test(u))return;seen[u]=1;out.push(u);}" +
  "document.querySelectorAll('img').forEach(function(img){" +
  "  var u=img.currentSrc||img.src||'';" +
  "  if((img.naturalWidth||0)>=200||/\\/hi\\//i.test(u)||/wowpic/i.test(u)) add(u);" +
  "});" +
  "performance.getEntriesByType('resource').forEach(function(e){" +
  "  if(/\\.(webp|jpg|jpeg|png)(\\?|$)/i.test(e.name)||/\\/hi\\//i.test(e.name)) add(e.name);" +
  "});" +
  "return JSON.stringify(out);" +
  "})()";

globalThis.source = {
  manifest: {
    id: "en.comix",
    name: "Comix",
    version: 5,
    language: "en",
    nsfw: true,
    baseURL: BASE,
    domains: [
      "comix.to",
      "comix.ws",
      "cloudflare.com",
      "wowpic1.store",
      "wowpic2.store",
      "wowpic3.store",
      "wowpic4.store",
      "wowpic5.store",
      "wowpic6.store",
      "wowpic7.store",
      "wowpic8.store",
      "wowpic9.store",
    ],
    rateLimitPerSecond: 1,
    imageHeaders: {},
    listings: [
      { id: "popular", name: "Popular" },
      { id: "latest", name: "Latest" },
    ],
    defaultReadingMode: "webtoon",
    capabilities: ["listings", "search"],
    settings: [
      {
        id: "poster",
        name: "Cover quality",
        kind: "select",
        defaultValue: "large",
        options: ["small", "medium", "large"],
      },
    ],
  },

  getListing(listingId, page) {
    if (page > 1) return { items: [], hasNext: false };
    const items = pickHomeList(listingId === "latest" ? "latest" : "popular")
      .map(mangaFromItem)
      .filter(Boolean);
    return { items: items, hasNext: false };
  },

  search(query, page, filters) {
    if (page > 1) return { items: [], hasNext: false };
    const needle = String(query || "")
      .toLowerCase()
      .trim();
    const pool = pickHomeList("popular").concat(pickHomeList("latest"));
    const seen = {};
    const items = [];
    for (let i = 0; i < pool.length; i++) {
      const manga = mangaFromItem(pool[i]);
      if (!manga || seen[manga.id]) continue;
      seen[manga.id] = true;
      if (!needle || manga.title.toLowerCase().indexOf(needle) !== -1) items.push(manga);
    }
    return { items: items, hasNext: false };
  },

  getFilters() {
    return [];
  },

  getManga(id) {
    const res = browse(BASE + "/title/" + id, 600);
    const html = ensureHTML(res.body);
    const data = initialData(html);
    const detail = detailFromData(data);
    if (detail) {
      const manga = mangaFromItem(detail);
      if (manga) {
        manga.id = id;
        return manga;
      }
    }
    mm.errors.fail("Manga not found.");
  },

  getChapters(mangaId) {
    // Wait for the client chapter list to hydrate after Cloudflare.
    const res = browse(BASE + "/title/" + mangaId, 3500);
    const html = ensureHTML(res.body);
    const chapters = chaptersFromHTML(html, mangaId);
    if (!chapters.length) {
      mm.errors.fail(
        "No chapters found. Complete the Cloudflare check for Comix, wait for the title page to finish loading, then try again."
      );
    }
    return chapters;
  },

  getPages(mangaId, chapterId) {
    const path =
      String(chapterId).indexOf("-chapter-") !== -1
        ? "/title/" + mangaId + "/" + chapterId
        : "/title/" + mangaId + "/" + chapterId;
    const res = mm.http.browser(BASE + path, { waitMs: 4500, script: PAGE_SCRIPT });
    ensureHTML(res.body);
    let urls = [];
    try {
      urls = JSON.parse(res.body);
    } catch (e) {
      urls = [];
    }
    if (!Array.isArray(urls) || !urls.length) {
      mm.errors.fail(
        "No page images yet. Open the chapter once in the browser check if needed, wait for pages to appear, then retry."
      );
    }
    return urls.map(function (url) {
      return { url: url, headers: { Referer: "", Origin: "" } };
    });
  },
};
