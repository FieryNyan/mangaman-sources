// MangaFire — https://mangafire.to (VRF-signed /api)
const BASE = "https://mangafire.to";
const LANG = "en";
const LIMIT = 50;

// --- VrfSigner (Keiyoushi MangaFire) ---
const TABLE_1 =
  "yINlmUNho8VYJT+ibTIP+9ESiULpVEtMOoD6U6lRE0R/xwXo/Xp9NrUgC4cw/Lmo33vUyjUE40kUoEWIr/fxfNNcq2s79ShQ5NhNrFnJ4hXPwOu/SuXzIbuTQKGFvfm08E9jvCfqAtoDqvQq3dVWPQFmJjgvkISBeXY3BgANR+yVnjGbcxZ47d6kLNfZPIayTq3/YGySb1KuVZodWp/WGNAO5pfMcpaK53Hhs0allBszaMaxuouOwdxbwgxIw6YunSsXjI05Yi0j9j4eHKfSXR8Ifo/Od+8iamRfCXTyvm7NGRGYdcQ0ywcK/u6RXhrbcCm4t2eCtrDgQVecJGkQ+A==";
const KEY_1 = "0Ec58JOY3uBzJK9m3zqIOpdlF7UFiax9DmA=";
const TABLE_2 =
  "IUFltCxD3Oc2cwCgkJffthaOg9cgPUb0LgW6H/VtfcF0kc5F25t+aWj6JH9VOhOaY0rAFdUxlDnl5BLNvwEJvQtP5qcw7vdb/K+chnbwnspSHT8mz5lqwz41TezG0hkO06FTjJZhsyNuFLDpD2ZZxQj/QIRcF90zpmQ7Byu483WsQqUE0C342HL+JXngRB6fRzxRyVTaKu83h7UYTJ0QMt6ixFh6S3F8gqkKwrGTL3jHNBsD45UnifK8+RGtishQV2K3rujLKEkiZxpr2dYcudFW4oFsDKhad3CLBvuyTqsCo4B7mL5IKQ1vXo/MOOvq1I1d8ar9X6Ttu5KF4fZgiA==";
const KEY_2 = "AAdjb1iPY8CiDmq9H34tKTBF8a3oDQ==";
const TABLE_3 =
  "NQHlu1/wVO5EmkwQymF810qqY2xG1k2obcas4Z9mCsPEIFl9pRIjFxbJ7ybMHbBckT5Ton85E0FOeHezbh/mjlEYpmpnlXOS8dgrqeq2KfxImTh1YK9y0PeMNhzA1OQzSY9brYOJq/l2QnE/hwOeZIhPixVSKIUlDb5vLcH6RWKxkIEMuP0bDwIqQ71AJJaEaMJL7A6YtyIwoRT+L5v4aZzodN/0+3nOGsfblFjgxSfPzVDjNFeNl5P26+kEC/8AHgdrpAbt3hHz3HrRN1Y6e+JHgF7ncFWnoF0y3THL1S71WgWGCa6KtSzTCCG58n68nTyj2T3Sshk7utqCtMi/ZQ==";
const KEY_3 = "DELOJgPsVaCcblDtTGMdHzM=";

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64_INV = (function () {
  const inv = [];
  for (let i = 0; i < 128; i++) inv[i] = -1;
  for (let i = 0; i < B64.length; i++) inv[B64.charCodeAt(i)] = i;
  return inv;
})();

function b64Decode(input) {
  const s = String(input || "").replace(/=+$/, "");
  const out = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    const v = code < 128 ? B64_INV[code] : -1;
    if (v < 0) continue;
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return out;
}

function b64UrlEncode(bytes) {
  let sb = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : -1;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : -1;
    sb += B64[b0 >> 2];
    sb += B64[((b0 & 3) << 4) | (b1 >= 0 ? b1 >> 4 : 0)];
    if (b1 >= 0) sb += B64[((b1 & 15) << 2) | (b2 >= 0 ? b2 >> 6 : 0)];
    if (b2 >= 0) sb += B64[b2 & 63];
  }
  return sb.replace(/\+/g, "-").replace(/\//g, "_");
}

function utf8Bytes(str) {
  const out = [];
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const c2 = s.charCodeAt(++i);
      const cp = 0x10000 + (((c & 0x3ff) << 10) | (c2 & 0x3ff));
      out.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f)
      );
    } else {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return out;
}

function encryptStage(data, table, key, iv) {
  const out = new Array(data.length);
  let prev = iv;
  for (let i = 0; i < data.length; i++) {
    prev = table[(data[i] ^ key[i % key.length] ^ prev) & 0xff];
    out[i] = prev;
  }
  return out;
}

const VRF_STAGES = [
  [b64Decode(TABLE_1), b64Decode(KEY_1), 0x5a],
  [b64Decode(TABLE_2), b64Decode(KEY_2), 0x35],
  [b64Decode(TABLE_3), b64Decode(KEY_3), 0xba],
];

function vrfSign(path) {
  let data = utf8Bytes(path);
  for (let i = 0; i < VRF_STAGES.length; i++) {
    const stage = VRF_STAGES[i];
    data = encryptStage(data, stage[0], stage[1], stage[2]);
  }
  return b64UrlEncode(data);
}

function apiGet(path, params) {
  const entries = [];
  const src = params || {};
  const keys = Object.keys(src);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const value = src[key];
    if (value == null || value === "") continue;
    if (Array.isArray(value)) {
      for (let j = 0; j < value.length; j++) {
        if (value[j] == null || value[j] === "") continue;
        entries.push([key, String(value[j])]);
      }
    } else {
      entries.push([key, String(value)]);
    }
  }
  entries.sort(function (a, b) {
    if (a[0] < b[0]) return -1;
    if (a[0] > b[0]) return 1;
    return 0;
  });

  let lastKey = "";
  let index = 0;
  const signParts = [];
  for (let i = 0; i < entries.length; i++) {
    const key = entries[i][0];
    const value = entries[i][1];
    let newKey = key;
    if (key.slice(-2) === "[]") {
      if (lastKey !== key) index = 0;
      lastKey = key;
      newKey = key.slice(0, -2) + "[" + index + "]";
      index += 1;
    }
    signParts.push(newKey + "=" + value);
  }
  const toSign = path + (signParts.length ? "?" + signParts.join("&") : "");
  const vrf = vrfSign(toSign);

  const urlParts = [];
  for (let i = 0; i < entries.length; i++) {
    urlParts.push(
      encodeURIComponent(entries[i][0]) + "=" + encodeURIComponent(entries[i][1])
    );
  }
  urlParts.push("vrf=" + encodeURIComponent(vrf));
  const url = BASE + "/api" + path + "?" + urlParts.join("&");
  const res = mm.http.get(url, {
    Accept: "application/json",
    Referer: BASE + "/",
  });
  let data;
  try {
    data = JSON.parse(res.body || "");
  } catch (e) {
    mm.errors.fail("MangaFire returned invalid JSON.");
  }
  if (data && data.message) {
    mm.errors.fail(String(data.message));
  }
  return data;
}

function hidOf(id) {
  const last = String(id || "")
    .replace(/\/+$/, "")
    .split("/")
    .pop();
  if (last.indexOf(".") !== -1) return last.split(".").pop();
  if (last.indexOf("-") !== -1) return last.split("-")[0];
  return last;
}

function mangaId(item) {
  const hid = item.hid || "";
  const slug = item.slug;
  return slug ? hid + "-" + slug : hid;
}

function posterURL(poster) {
  if (!poster) return undefined;
  return poster.large || poster.medium || poster.small || undefined;
}

function statusOf(text) {
  const t = String(text || "").toLowerCase();
  if (t === "releasing") return "ongoing";
  if (t === "finished") return "completed";
  if (t === "on_hiatus") return "hiatus";
  return "unknown";
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function entityTitles(list) {
  if (!list || !list.length) return [];
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const title = typeof list[i] === "string" ? list[i] : list[i].title;
    if (title) out.push(title);
  }
  return out;
}

function mangaFromItem(item) {
  const tags = [];
  if (item.type) tags.push(String(item.type).replace(/^./, function (c) { return c.toUpperCase(); }));
  entityTitles(item.genres).forEach(function (g) { tags.push(g); });
  entityTitles(item.themes).forEach(function (g) { tags.push(g); });
  const authors = entityTitles(item.authors);
  const artists = entityTitles(item.artists);
  const author = authors.concat(artists).filter(Boolean).join(", ") || undefined;
  return {
    id: mangaId(item),
    title: item.title,
    cover: posterURL(item.poster),
    status: statusOf(item.status),
    author: author,
    description: item.synopsisHtml ? stripHtml(item.synopsisHtml) : item.synopsis || undefined,
    tags: tags.length ? tags : undefined,
  };
}

function parseList(data) {
  const items = ((data && data.items) || []).map(mangaFromItem);
  const meta = (data && data.meta) || {};
  return {
    items: items,
    hasNext: !!meta.hasNext,
  };
}

const GENRE_IDS = {
  Action: "1",
  Adventure: "78",
  Comedy: "5",
  Drama: "6",
  Fantasy: "79",
  Horror: "530",
  Isekai: "13",
  "Martial Arts": "534",
  Mystery: "22",
  Romance: "26",
  School: "73",
  "Sci-Fi": "28",
  Seinen: "537",
  Shoujo: "30",
  Shounen: "31",
  "Slice of Life": "538",
  Sports: "34",
  Supernatural: "76",
};

function applyFilters(params, filters) {
  const f = filters || {};
  if (f.type) params["types[]"] = f.type;
  if (f.status) params["statuses[]"] = f.status;
  if (f.genre && GENRE_IDS[f.genre]) params["genres_in[]"] = GENRE_IDS[f.genre];
  if (f.content_rating) params["content_rating[]"] = f.content_rating;
  const sort = f.sort || "";
  if (sort && sort.indexOf(":") !== -1) {
    const parts = sort.split(":");
    params["order[" + parts[0] + "]"] = parts[1] || "desc";
  }
}

function browse(page, orderKey, orderDir) {
  const params = {
    page: String(page),
    limit: String(LIMIT),
  };
  params["order[" + orderKey + "]"] = orderDir || "desc";
  return parseList(apiGet("/titles", params));
}

function chapterTitle(ch) {
  const number = String(ch.number).replace(/\.0$/, "");
  const name = String(ch.name || "").trim();
  if (!name) return "Ch. " + number;
  if (/\b(?:ch(?:\.|apter)?|ep(?:\.|isode)?)\s?\d/i.test(name)) return name;
  return "Ch. " + number + " - " + name;
}

function isoDate(seconds) {
  if (!seconds) return undefined;
  const d = new Date(Number(seconds) * 1000);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

globalThis.source = {
  manifest: {
    id: "en.mangafire",
    name: "MangaFire",
    version: 1,
    language: "en",
    nsfw: false,
    baseURL: BASE,
    domains: [
      "mangafire.to",
      "mfcdn.nl",
      "mfcdn1.xyz",
      "mfcdn2.xyz",
      "mfcdn3.xyz",
      "mfcdn4.xyz",
    ],
    rateLimitPerSecond: 2,
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
    if (listingId === "latest") {
      return browse(page, "chapter_updated_at", "desc");
    }
    return browse(page, "views_30d", "desc");
  },

  search(query, page, filters) {
    const f = filters || {};
    const params = {
      page: String(page),
      limit: String(LIMIT),
    };
    if (query) params.keyword = String(query).trim();
    applyFilters(params, f);
    if (!f.sort) {
      // Default search order: relevance when querying, else popular.
      if (query) params["order[relevance]"] = "desc";
      else params["order[views_30d]"] = "desc";
    }
    return parseList(apiGet("/titles", params));
  },

  getFilters() {
    return [
      {
        id: "sort",
        name: "Sort",
        kind: "select",
        defaultValue: "",
        options: [
          "",
          "chapter_updated_at:desc",
          "relevance:desc",
          "created_at:desc",
          "title:asc",
          "title:desc",
          "year:desc",
          "score:desc",
          "views_7d:desc",
          "views_30d:desc",
          "views_total:desc",
          "follows_total:desc",
        ],
      },
      {
        id: "type",
        name: "Type",
        kind: "select",
        defaultValue: "",
        options: ["", "manga", "manhwa", "manhua", "other"],
      },
      {
        id: "status",
        name: "Status",
        kind: "select",
        defaultValue: "",
        options: ["", "releasing", "finished", "on_hiatus", "discontinued"],
      },
      {
        id: "content_rating",
        name: "Content rating",
        kind: "select",
        defaultValue: "",
        options: ["", "safe", "suggestive", "erotica", "pornographic"],
      },
      {
        id: "genre",
        name: "Genre",
        kind: "select",
        defaultValue: "",
        options: [""].concat(Object.keys(GENRE_IDS)),
      },
    ];
  },

  getManga(id) {
    const hid = hidOf(id);
    const data = apiGet("/titles/" + encodeURIComponent(hid), {});
    const detail = data && data.data;
    if (!detail || !detail.title) mm.errors.fail("Manga not found.");
    return mangaFromItem(detail);
  },

  getChapters(mangaId) {
    const hid = hidOf(mangaId);
    const chapters = [];
    let page = 1;
    let lastPage = 1;
    while (page <= lastPage && page <= 40) {
      const data = apiGet("/titles/" + encodeURIComponent(hid) + "/chapters", {
        language: LANG,
        sort: "number",
        order: "desc",
        page: String(page),
        limit: "200",
      });
      const items = (data && data.items) || [];
      const meta = (data && data.meta) || {};
      if (page === 1) lastPage = meta.lastPage || 1;
      for (let i = 0; i < items.length; i++) {
        const ch = items[i];
        chapters.push({
          id: String(ch.id),
          title: chapterTitle(ch),
          chapter: ch.number,
          scanlator: ch.type || undefined,
          date: isoDate(ch.createdAt),
          language: LANG,
        });
      }
      if (!items.length) break;
      page += 1;
    }
    if (!chapters.length) mm.errors.fail("No chapters found.");
    return chapters;
  },

  getPages(mangaId, chapterId) {
    const data = apiGet("/chapters/" + encodeURIComponent(chapterId), {});
    const pages = data && data.data && data.data.pages;
    if (!pages || !pages.length) mm.errors.fail("No pages found.");
    return pages.map(function (page) {
      return {
        url: page.url,
        headers: { Referer: BASE + "/" },
      };
    });
  },
};
