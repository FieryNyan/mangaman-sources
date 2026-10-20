// MangaHub — https://mangahub.io (GraphQL API + enc:v1 page lists)
const BASE = "https://mangahub.io";
const API = "https://api.mghcdn.com/graphql";
const CDN = "https://imgx.mghcdn.com";
const THUMB = "https://thumb.mghcdn.com";
const SOURCE = "m01";
const STORE_KEY = "mhub_access";

function randomKey() {
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 32; i++) out += hex.charAt(Math.floor(Math.random() * 16));
  return out;
}

function apiKey() {
  return mm.store.get(STORE_KEY) || randomKey();
}

function saveKey(key) {
  if (key) mm.store.set(STORE_KEY, key);
}

function graphql(query, refreshPath) {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Origin: BASE,
    Referer: BASE + "/",
    "x-mhub-access": apiKey(),
  };
  let res;
  try {
    res = mm.http.post(API, JSON.stringify({ query: query }), headers);
  } catch (e) {
    refreshKey(refreshPath);
    headers["x-mhub-access"] = apiKey();
    res = mm.http.post(API, JSON.stringify({ query: query }), headers);
  }
  let data;
  try {
    data = JSON.parse(res.body);
  } catch (e) {
    mm.errors.fail("MangaHub returned invalid JSON.");
  }
  if (data.errors && data.errors.length) {
    const msg = data.errors.map(function (err) { return err.message || ""; }).join("; ");
    if (/rate\s*limit|api\s*key|encryption/i.test(msg)) {
      refreshKey(refreshPath);
      headers["x-mhub-access"] = apiKey();
      res = mm.http.post(API, JSON.stringify({ query: query }), headers);
      data = JSON.parse(res.body);
      if (data.errors && data.errors.length) {
        mm.errors.fail(data.errors.map(function (err) { return err.message || "GraphQL error"; }).join("; "));
      }
    } else {
      mm.errors.fail(msg || "GraphQL error");
    }
  }
  return data.data;
}

function refreshKey(refreshPath) {
  const path = refreshPath || "/chapter/martial-peak/chapter-" + (1000 + Math.floor(Math.random() * 2000));
  const attempts = [
    BASE + path + (path.indexOf("?") === -1 ? "?reloadKey=1" : "&reloadKey=1"),
    BASE + path,
  ];
  const old = apiKey();
  for (let i = 0; i < attempts.length; i++) {
    try {
      const res = mm.http.get(attempts[i], {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        Referer: BASE + "/",
      });
      const setCookie = res.headers["Set-Cookie"] || res.headers["set-cookie"] || "";
      const match = String(setCookie).match(/mhub_access=([^;]+)/);
      if (match && match[1] && match[1] !== old) {
        saveKey(match[1]);
        return;
      }
    } catch (e) {
      // Challenge bubbles to the app sheet when CF blocks the chapter page.
    }
  }
  saveKey(randomKey());
}

function decryptPages(enc) {
  const parts = String(enc || "").split(":");
  // enc:v1:keyId:iv:authTag:ciphertext
  if (parts.length < 6 || parts[0] !== "enc" || parts[1] !== "v1") {
    mm.errors.fail("Unsupported MangaHub page encryption.");
  }
  const keyId = parts[2];
  const iv = parts[3];
  const tag = parts[4];
  const ciphertext = parts[5];
  const cryptoRes = mm.http.get(BASE + "/api/chapter-crypto", {
    Accept: "application/json",
    Referer: BASE + "/",
    Origin: BASE,
    "x-mhub-access": apiKey(),
  });
  let crypto;
  try {
    crypto = JSON.parse(cryptoRes.body);
  } catch (e) {
    mm.errors.fail("Could not load MangaHub chapter keys.");
  }
  let keyData = null;
  if (crypto.keys && crypto.keys[keyId]) keyData = crypto.keys[keyId];
  else if (crypto.key && (!crypto.keyId || crypto.keyId === keyId)) keyData = crypto.key;
  if (!keyData) mm.errors.fail("MangaHub decrypt key not found.");
  return mm.crypto.aesGcmDecrypt(keyData, iv, tag, ciphertext);
}

function escapeQuery(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function searchQuery(query, genre, order, page) {
  return (
    "{search(x:" + SOURCE + ",q:\"" + escapeQuery(query) + "\",genre:\"" + escapeQuery(genre || "all") +
    "\",mod:" + (order || "POPULAR") + ",offset:" + (page - 1) * 30 + "){rows{title,slug,image}}}"
  );
}

function mangaQuery(slug) {
  return (
    "{manga(x:" + SOURCE + ",slug:\"" + escapeQuery(slug) + "\"){title,slug,status,image,author,artist,genres,description,alternativeTitle,chapters{number,title,date}}}"
  );
}

function pagesQuery(slug, number) {
  return "{chapter(x:" + SOURCE + ",slug:\"" + escapeQuery(slug) + "\",number:" + number + "){pages,mangaID,number}}";
}

function statusOf(text) {
  const t = String(text || "").toLowerCase();
  if (t === "ongoing") return "ongoing";
  if (t === "completed") return "completed";
  return "unknown";
}

function chapterName(title, number) {
  const numberString = String(number).replace(/\.0$/, "");
  const clean = String(title || "").replace(/\s+/g, " ").trim();
  if (clean && clean.indexOf(numberString) !== -1) return clean;
  if (clean) return "Chapter " + numberString + " - " + clean;
  return "Chapter " + numberString;
}

function mangaSummary(row) {
  const image = row.image && String(row.image).trim();
  return {
    id: row.slug,
    title: row.title,
    cover: image ? THUMB + "/" + image.replace(/^\//, "") : undefined,
    status: statusOf(row.status),
    author: row.author || undefined,
    description: row.description || undefined,
    tags: row.genres ? String(row.genres).split(/,\s*/).filter(Boolean) : undefined,
  };
}

function parsePageList(pagesString) {
  let parsed = pagesString;
  if (typeof pagesString === "string") {
    try {
      parsed = JSON.parse(pagesString);
    } catch (e) {
      mm.errors.fail("Could not parse page list.");
    }
  }
  let paths = [];
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && parsed.i) {
    const prefix = parsed.p || "";
    paths = parsed.i.map(function (name) { return prefix + name; });
  } else if (Array.isArray(parsed)) {
    paths = parsed;
  } else if (parsed && typeof parsed === "object") {
    const keys = Object.keys(parsed);
    paths = keys.map(function (k) { return parsed[k]; });
  }
  return paths;
}

globalThis.source = {
  manifest: {
    id: "en.mangahub",
    name: "MangaHub",
    version: 4,
    language: "en",
    nsfw: false,
    baseURL: BASE,
    domains: ["mangahub.io", "mghcdn.com"],
    rateLimitPerSecond: 4,
    imageHeaders: {
      Referer: BASE + "/",
    },
    listings: [
      { id: "popular", name: "Popular" },
      { id: "latest", name: "Latest" },
    ],
    defaultReadingMode: "rtl",
    capabilities: ["listings", "search"],
    settings: [],
  },

  getListing(listingId, page) {
    const order = listingId === "latest" ? "LATEST" : "POPULAR";
    const data = graphql(searchQuery("", "all", order, page));
    const rows = (data.search && data.search.rows) || [];
    return {
      items: rows.map(mangaSummary),
      hasNext: rows.length >= 30,
    };
  },

  search(query, page, filters) {
    const order = (filters && filters.order) || "POPULAR";
    const genre = (filters && filters.genre) || "all";
    const data = graphql(searchQuery(query, genre, order, page));
    const rows = (data.search && data.search.rows) || [];
    return {
      items: rows.map(mangaSummary),
      hasNext: rows.length >= 30,
    };
  },

  getFilters() {
    return [
      {
        id: "order",
        name: "Order",
        kind: "select",
        defaultValue: "POPULAR",
        options: ["POPULAR", "LATEST", "ALPHABET", "NEW", "COMPLETED"],
      },
      {
        id: "genre",
        name: "Genre",
        kind: "select",
        defaultValue: "all",
        options: [
          "all", "action", "adventure", "comedy", "drama", "fantasy", "horror",
          "mystery", "romance", "school-life", "sci-fi", "seinen", "shoujo",
          "shounen", "slice-of-life", "sports", "supernatural", "tragedy",
        ],
      },
    ];
  },

  getManga(id) {
    const data = graphql(mangaQuery(id), "/manga/" + id);
    if (!data.manga) mm.errors.fail("Manga not found.");
    const item = mangaSummary(data.manga);
    const alts = data.manga.alternativeTitle
      ? String(data.manga.alternativeTitle).split(";").map(function (s) { return s.trim(); }).filter(Boolean)
      : [];
    if (alts.length) item.altTitles = alts;
    if (data.manga.artist) item.author = [item.author, data.manga.artist].filter(Boolean).join(", ");
    return item;
  },

  getChapters(mangaId) {
    const data = graphql(mangaQuery(mangaId), "/manga/" + mangaId);
    if (!data.manga || !data.manga.chapters) mm.errors.fail("No chapters found.");
    const chapters = data.manga.chapters.map(function (ch) {
      return {
        id: String(ch.number),
        title: chapterName(ch.title, ch.number),
        chapter: ch.number,
        date: ch.date || undefined,
        language: "en",
      };
    });
    chapters.reverse();
    return chapters;
  },

  getPages(mangaId, chapterId) {
    const number = Number(chapterId);
    if (!isFinite(number)) mm.errors.fail("Bad chapter id.");
    const refreshPath = "/chapter/" + mangaId + "/chapter-" + number;
    const data = graphql(pagesQuery(mangaId, number), refreshPath);
    if (!data.chapter || data.chapter.pages == null) mm.errors.fail("No pages found.");
    let pagesString = data.chapter.pages;
    if (typeof pagesString === "string" && pagesString.indexOf("enc:v1") === 0) {
      pagesString = decryptPages(pagesString);
    }
    const paths = parsePageList(pagesString);
    if (!paths.length) mm.errors.fail("No pages found.");
    return paths.map(function (path) {
      const url = /^https?:\/\//i.test(path) ? path : CDN + "/" + String(path).replace(/^\//, "");
      return { url: url, headers: { Referer: BASE + "/" } };
    });
  },
};
