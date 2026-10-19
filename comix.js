// Comix — https://comix.to
// Browse uses the public JSON API. Chapters/pages are signed with `_` and may
// return {"e":"..."} envelopes that must be decoded with the site cipher.
const BASE = "https://comix.to";
const API = BASE + "/api/v1";

// --- ComixCrypto (from site secure-*.js / N3uralCreativity ComixCrypto) ---
const SBOX1 =
  "gbicCvAMzfcXEtGAyjvvhmb2yCWzWhjqcxXZ7ZhpzANOzoQLo3nuPZ2vK9dkb9hJExC0Vni/hdQBceI+mw611gkhQFjBuf4bJg1TxYqM+SL4YDqtwjxiGSdeH7so7Fn1HiRo37Z+RNvl44twXWVhomtMjw+8bemfmv9XEXr7mS82MxaCOJZRR0oHd9PLI5O+gyBGT6hcLoduNa7yCObVVCk3bFWsoD+xcqTrBcP6dNJN/NB1Br2QGhSN2snHAqeRNKVFQiyeAFLPSKGwY8aq9EPgsi17qd4ywPMxiH8w6N1qX1tLKtzhOeemHWeJQfFQ5H23q7qSlJUcjgTEl3x2/Q==";
const KEY1 = "rafYl4oSAKQX+GYoic9oW4iGwiYpZzs0";
const SBOX2 =
  "2lQehmgyYFAoWUi0haazZqHy5zZ34NN+VzlfsoB2Y1yY0IuMLjgVcV2xt8t4moH+AP0NMJ5qekW7DFIHEWKkOgIBIMhDdA8lbM6iHKjDlq6IChpb3CnA9NmsvQW/afdt1SfJjTdwcvpKqunCJLxBFmXX9hecm6tGb+HRxD7BC3njoxPxgnX5pdKP1IMSkd4/O3NRfZSE6DVLG2s9uexaipA05cpJzE8Qkv/z5jzHAwlEWOLd3yxA+0cvVbpOoJPFGc8f1lb4vu2HUxjuuEwEQk0GsPCVnyKvfOoh9TG2YYmZLV4I67UU2NsrrakqZ47k/O+ne25/DjPGZCMdnZcmzQ==";
const KEY2 = "2USAq+VTo5ht4bQn+K9DUcpUQRTtrB56";
const SBOX3 =
  "+mhJSFwzaV+PQPDyKp2scO/S9SdFsy/7e56UWT8XHbK3E2+19nEPwfwOgE9uVCaDtOAWTobCZX+cBCXlIbBqyDyQB1beKLspW6kGPhBCV9x0jf0KUeFhHjmlMf7qMFIB41PfDFprZ3bJiK4YxrZDv+K6dcwJmggVO8f5ktrXTM0cZL4fer0SpnkbvNajPbHxfuTz5lVEBarOI4rdc+2V6zTsjpfQYjgN1MMr6EvA6eehN6dQ1bgUogt9rZOBbQBeNnLYY00uZqSoJBnFi5gthCJsWF33ykosn9v/9KB8udMCz0YRYImrA4VHr5mMgpH4xDXLeEHRd5vZOiAalofuMg==";
const KEY3 = "yNHlokVEnuecesDrB/lDhVuUNiheWc3a47VtkwZ2ENg=";
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

function b64UrlDecode(input) {
  return b64Decode(String(input || "").replace(/-/g, "+").replace(/_/g, "/"));
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

function fromUtf8(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i++];
    if (b < 0x80) out += String.fromCharCode(b);
    else if (b < 0xe0) {
      const b2 = bytes[i++];
      out += String.fromCharCode(((b & 0x1f) << 6) | (b2 & 0x3f));
    } else if (b < 0xf0) {
      const b2 = bytes[i++];
      const b3 = bytes[i++];
      out += String.fromCharCode(((b & 0x0f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f));
    } else {
      const b2 = bytes[i++];
      const b3 = bytes[i++];
      const b4 = bytes[i++];
      let cp =
        ((b & 0x07) << 18) | ((b2 & 0x3f) << 12) | ((b3 & 0x3f) << 6) | (b4 & 0x3f);
      cp -= 0x10000;
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    }
  }
  return out;
}

function makeLayer(sboxB64, keyB64, iv) {
  const sbox = b64Decode(sboxB64);
  const inverse = new Array(256);
  for (let i = 0; i < sbox.length; i++) inverse[sbox[i]] = i;
  return { sbox: sbox, inverse: inverse, key: b64Decode(keyB64), iv: iv };
}

const CRYPTO_LAYERS = [
  makeLayer(SBOX1, KEY1, 189),
  makeLayer(SBOX2, KEY2, 133),
  makeLayer(SBOX3, KEY3, 32),
];

function cryptoEncode(input) {
  let bytes = utf8Bytes(input);
  for (let li = 0; li < CRYPTO_LAYERS.length; li++) {
    const layer = CRYPTO_LAYERS[li];
    const out = new Array(bytes.length);
    let prev = layer.iv;
    for (let a = 0; a < bytes.length; a++) {
      const f = layer.sbox[(bytes[a] ^ layer.key[a % layer.key.length] ^ prev) & 0xff];
      out[a] = f;
      prev = f;
    }
    bytes = out;
  }
  return b64UrlEncode(bytes);
}

function cryptoDecode(token) {
  let bytes = b64UrlDecode(token);
  for (let i = CRYPTO_LAYERS.length - 1; i >= 0; i--) {
    const layer = CRYPTO_LAYERS[i];
    const out = new Array(bytes.length);
    let prev = layer.iv;
    for (let s = 0; s < bytes.length; s++) {
      const cipher = bytes[s];
      out[s] = (layer.inverse[cipher] ^ layer.key[s % layer.key.length] ^ prev) & 0xff;
      prev = cipher;
    }
    bytes = out;
  }
  return fromUtf8(bytes);
}

function needsToken(apiPath) {
  return /^\/manga(?:\/|$)/.test(apiPath) || /^\/chapters\/[^/]+/.test(apiPath);
}

function signedURL(apiPath, params) {
  const keys = [];
  for (const key in params) {
    if (key === "_" || params[key] == null || params[key] === "") continue;
    keys.push(key);
  }
  keys.sort();
  const pairs = [];
  for (let i = 0; i < keys.length; i++) {
    pairs.push(keys[i] + "=" + params[keys[i]]);
  }
  const query = pairs.join("&");
  const plain = query ? apiPath + "?" + query : apiPath;
  const parts = [];
  for (let i = 0; i < keys.length; i++) {
    parts.push(encodeURIComponent(keys[i]) + "=" + encodeURIComponent(params[keys[i]]));
  }
  if (needsToken(apiPath)) {
    parts.push("_=" + encodeURIComponent(cryptoEncode(plain)));
  }
  return API + apiPath + (parts.length ? "?" + parts.join("&") : "");
}

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
  let text = body || "";
  if (/just a moment|cf-browser|cloudflare/i.test(text)) {
    mm.errors.fail("Cloudflare challenge. Open Comix once from the challenge sheet, then retry.");
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    mm.errors.fail("Comix returned invalid JSON.");
  }
  if (data && typeof data.e === "string") {
    try {
      data = JSON.parse(cryptoDecode(data.e));
    } catch (e2) {
      mm.errors.fail("Could not decrypt Comix response. The site may have rotated its cipher.");
    }
  }
  return data;
}

function apiGet(apiPath, params) {
  const res = get(signedURL(apiPath, params || {}));
  return parseJSON(res.body);
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
  const slug =
    url.replace(/^https?:\/\/[^/]+/i, "").replace(/^\/title\//, "").replace(/^\/+/, "") ||
    item.hid;
  const id = slug || item.hid;
  const authors = (item.authors || item.author || [])
    .map(function (a) {
      return typeof a === "string" ? a : a.title;
    })
    .filter(Boolean);
  const genres = (item.genres || item.genre || [])
    .map(function (g) {
      return typeof g === "string" ? g : g.title;
    })
    .filter(Boolean);
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
  const params = {
    page: String(page),
    limit: "30",
  };
  if (orderKey === "latest") params["order[chapter_updated_at]"] = "desc";
  else params["order[score]"] = "desc";
  if (query) params.keyword = query;
  const rating = (filters && filters.content_rating) || mm.settings.get("content_rating") || "suggestive";
  if (rating) params.content_rating = rating;
  const type = filters && filters.type;
  if (type) params["types[]"] = type;
  const data = apiGet("/manga", params);
  const result = data.result || data;
  const items = (result.items || []).map(mangaFromItem);
  const meta = result.meta || result.pagination || {};
  const hasNext =
    meta.page != null && (meta.lastPage != null || meta.actualLastPage != null)
      ? meta.page < (meta.lastPage != null ? meta.lastPage : meta.actualLastPage)
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
    version: 3,
    language: "en",
    nsfw: true,
    baseURL: BASE,
    domains: [
      "comix.to",
      "comix.ws",
      "kkplayer.wtf",
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
    rateLimitPerSecond: 2,
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
    const hid = hidOf(id);
    const apiData = apiGet("/manga/" + hid, {});
    const apiDetail = apiData.result || apiData;
    if (apiDetail && apiDetail.title) return mangaFromItem(apiDetail);
    const path = "/title/" + id;
    const res = get(BASE + path, { Accept: "text/html" });
    const boot = initialData(res.body);
    const htmlDetail = detailFromQueries(boot && boot.queries);
    if (htmlDetail) return mangaFromItem(htmlDetail);
    const parsed = apiGet("/manga", { keyword: hid, limit: "20" });
    const items = (parsed.result || parsed).items || [];
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
      const data = apiGet("/manga/" + hid + "/chapters", {
        page: String(page),
        limit: "100",
        "order[number]": "desc",
      });
      const result = data.result || data;
      const items = result.items || result.chapters || (Array.isArray(result) ? result : []);
      if (!items.length) break;
      for (let i = 0; i < items.length; i++) {
        const ch = items[i];
        const number = ch.number;
        const chapterId = String(ch.id);
        const name = ch.name
          ? "Chapter " + String(number).replace(/\.0$/, "") + ": " + ch.name
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
      if (meta.hasNext === false) complete = true;
      else if (meta.page != null && meta.lastPage != null) complete = meta.page >= meta.lastPage;
      else if (meta.page != null && meta.actualLastPage != null) complete = meta.page >= meta.actualLastPage;
      else complete = items.length < 100;
      page += 1;
    }
    if (!chapters.length) {
      mm.errors.fail(
        "No chapters. Clear the Cloudflare challenge for Comix, then retry."
      );
    }
    return chapters;
  },

  getPages(mangaId, chapterId) {
    const data = apiGet("/chapters/" + chapterId, {});
    const payload = data.pages || (data.result && data.result.pages) || data.result || data;
    const baseUrl = (payload.baseUrl || payload.base_url || "").replace(/\/+$/, "");
    const items = payload.items || payload.pages || [];
    if (!items.length) mm.errors.fail("No pages found.");
    return items.map(function (item) {
      const path = typeof item === "string" ? item : item.url;
      let url = /^https?:\/\//i.test(path)
        ? path
        : baseUrl + "/" + String(path).replace(/^\/+/, "");
      if ((item && item.s === 1) || /[?&]v3(=|&|$)/.test(url)) {
        if (url.indexOf("v3") === -1) url += (url.indexOf("?") === -1 ? "?" : "&") + "v3";
      }
      return { url: url, headers: { Referer: "", Origin: "" } };
    });
  },
};
