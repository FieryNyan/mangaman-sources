// Comix — https://comix.to
// Browse/details/chapters use the public JSON API after Cloudflare is cleared.
// Chapter pages may be signed/encrypted or grid-scrambled by the site; those can still fail.
const BASE = "https://comix.to";

function headers(extra) {
  const out = {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
    Referer: BASE + "/",
    Origin: BASE,
  };
  if (extra) {
    for (const key in extra) out[key] = extra[key];
  }
  return out;
}

function get(url, extra) {
  return mm.http.get(url, headers(extra));
}

function parseJSON(body) {
  try {
    return JSON.parse(body);
  } catch (e) {
    if (/just a moment|cf-browser|cloudflare/i.test(body || "")) {
      mm.errors.fail("Cloudflare challenge. Open Comix once from the challenge sheet, then retry.");
    }
    mm.errors.fail("Comix returned invalid JSON.");
  }
}

function hidOf(id) {
  return String(id || "").split("-")[0];
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

function mangaFromItem(item) {
  const url = item.url || "";
  const slug = url.replace(/^https?:\/\/[^/]+/i, "").replace(/^\/title\//, "").replace(/^\/+/, "") || item.hid;
  const id = slug || item.hid;
  const authors = (item.authors || item.author || []).map(function (a) {
    return typeof a === "string" ? a : a.title;
  }).filter(Boolean);
  const genres = (item.genres || item.genre || []).map(function (g) {
    return typeof g === "string" ? g : g.title;
  }).filter(Boolean);
  return {
    id: id,
    title: item.title,
    author: authors.length ? authors.join(", ") : undefined,
    description: item.synopsis || undefined,
    cover: posterURL(item.poster),
    status: statusOf(item.status),
    tags: genres,
    nsfw: /pornographic|erotica/i.test(item.contentRating || ""),
  };
}

function browse(page, orderKey, query, filters) {
  const params = ["page=" + page, "limit=30"];
  if (orderKey === "latest") params.push("order[chapter_updated_at]=desc");
  else params.push("order[score]=desc");
  if (query) params.push("keyword=" + encodeURIComponent(query));
  const rating = (filters && filters.content_rating) || mm.settings.get("content_rating") || "suggestive";
  if (rating) params.push("content_rating=" + encodeURIComponent(rating));
  const type = filters && filters.type;
  if (type) params.push("types[]=" + encodeURIComponent(type));
  const res = get(BASE + "/api/v1/manga?" + params.join("&"));
  const data = parseJSON(res.body);
  const result = data.result || data;
  const items = (result.items || []).map(mangaFromItem);
  const meta = result.meta || result.pagination || {};
  const hasNext =
    meta.page != null && meta.actualLastPage != null
      ? meta.page < meta.actualLastPage
      : items.length >= 30;
  return { items: items, hasNext: hasNext };
}

function initialData(html) {
  const match = html.match(/<script[^>]*id=["']initial-data["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch (e) {
    return null;
  }
}

function detailFromQueries(queries) {
  if (!queries) return null;
  const keys = Object.keys(queries);
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].indexOf('"detail"') !== -1 || keys[i].indexOf("detail") !== -1) {
      const value = queries[keys[i]];
      if (value && value.title) return value;
      if (value && value.result && value.result.title) return value.result;
    }
  }
  return null;
}

globalThis.source = {
  manifest: {
    id: "en.comix",
    name: "Comix",
    version: 1,
    language: "en",
    nsfw: true,
    baseURL: BASE,
    domains: [
      "comix.to",
      "comix.ws",
      "kkplayer.wtf",
      "cloudflare.com",
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
        id: "content_rating",
        name: "Max content rating",
        kind: "select",
        defaultValue: "suggestive",
        options: ["safe", "suggestive", "erotica", "pornographic"],
      },
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
    return browse(page, listingId === "latest" ? "latest" : "popular", "", {});
  },

  search(query, page, filters) {
    return browse(page, "popular", query, filters || {});
  },

  getFilters() {
    return [
      {
        id: "content_rating",
        name: "Content rating",
        kind: "select",
        defaultValue: "suggestive",
        options: ["safe", "suggestive", "erotica", "pornographic"],
      },
      {
        id: "type",
        name: "Type",
        kind: "select",
        defaultValue: "",
        options: ["", "manga", "manhwa", "manhua", "oel"],
      },
    ];
  },

  getManga(id) {
    const path = "/title/" + id;
    const res = get(BASE + path, { Accept: "text/html" });
    const data = initialData(res.body);
    const detail = detailFromQueries(data && data.queries);
    if (detail) return mangaFromItem(detail);
    // Fallback: API search for this slug/hid
    const hid = hidOf(id);
    const api = get(BASE + "/api/v1/manga?keyword=" + encodeURIComponent(hid) + "&limit=20");
    const parsed = parseJSON(api.body);
    const items = ((parsed.result || parsed).items || []);
    for (let i = 0; i < items.length; i++) {
      const item = mangaFromItem(items[i]);
      if (item.id === id || item.id.indexOf(hid) === 0 || hidOf(item.id) === hid) return item;
    }
    if (items[0]) return mangaFromItem(items[0]);
    mm.errors.fail("Manga not found.");
  },

  getChapters(mangaId) {
    const hid = hidOf(mangaId);
    const chapters = [];
    let page = 1;
    let complete = false;
    while (page <= 50 && !complete) {
      const res = get(
        BASE +
          "/api/v1/manga/" +
          encodeURIComponent(hid) +
          "/chapters?page=" +
          page +
          "&limit=100&order[created_at]=desc"
      );
      const data = parseJSON(res.body);
      const result = data.result || data;
      const items = result.items || result.chapters || (Array.isArray(result) ? result : []);
      if (!items.length) break;
      for (let i = 0; i < items.length; i++) {
        const ch = items[i];
        const number = ch.number;
        const chapterId = String(ch.id);
        const name = ch.name ? "Chapter " + String(number).replace(/\.0$/, "") + ": " + ch.name
          : "Chapter " + String(number).replace(/\.0$/, "");
        chapters.push({
          id: chapterId,
          title: name,
          chapter: number,
          scanlator: ch.group && ch.group.title ? ch.group.title : undefined,
          language: "en",
        });
      }
      const meta = result.meta || result.pagination || {};
      if (meta.page != null && meta.actualLastPage != null) {
        complete = meta.page >= meta.actualLastPage;
      } else {
        complete = items.length < 100;
      }
      page += 1;
    }
    if (!chapters.length) {
      mm.errors.fail(
        "No chapters. Comix may require a signed session — clear the Cloudflare challenge, then retry."
      );
    }
    return chapters;
  },

  getPages(mangaId, chapterId) {
    const res = get(BASE + "/api/v1/chapters/" + encodeURIComponent(chapterId));
    const data = parseJSON(res.body);
    if (data && typeof data.e === "string") {
      mm.errors.fail("Comix encrypted this chapter response. The site requires its signed client.");
    }
    const payload = data.pages || data.result || data;
    const baseUrl = (payload.baseUrl || payload.base_url || "").replace(/\/+$/, "");
    const items = payload.items || payload.pages || [];
    if (!items.length) mm.errors.fail("No pages found.");
    return items.map(function (item) {
      const path = typeof item === "string" ? item : item.url;
      let url = /^https?:\/\//i.test(path) ? path : baseUrl + "/" + String(path).replace(/^\/+/, "");
      if ((item && item.s === 1) || /[?&]v3(=|&|$)/.test(url)) {
        if (url.indexOf("v3") === -1) url += (url.indexOf("?") === -1 ? "?" : "&") + "v3";
      }
      // Comix image hosts reject Referer/Origin.
      return { url: url, headers: { Referer: "", Origin: "" } };
    });
  },
};
