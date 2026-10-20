// Comix — https://comix.to
// Cloudflare + a rotating in-page API signer mean catalogue data must be read
// from the site's own WebView fetch (same approach as Keiyoushi Comix).
const BASE = "https://comix.to";

// Installed at document-start so we see /api/v1/manga before the SPA finishes.
const BROWSE_INJECT =
  "(function(){" +
  "if(window.__mmComixBrowseHook)return;" +
  "window.__mmComixBrowseHook=1;" +
  "window.__mmComixBrowse='';" +
  "function capture(parsed){" +
  "  try{" +
  "    if(parsed&&Array.isArray(parsed.items))parsed={result:parsed};" +
  "    if(parsed&&parsed.result&&Array.isArray(parsed.result.items)&&parsed.result.items.length){" +
  "      window.__mmComixBrowse=JSON.stringify(parsed);" +
  "      return true;" +
  "    }" +
  "  }catch(e){}" +
  "  return false;" +
  "}" +
  "function fromInitial(){" +
  "  try{" +
  "    var el=document.querySelector('script#initial-data');" +
  "    if(!el)return;" +
  "    var queries=JSON.parse(el.textContent).queries;" +
  "    if(!queries)return;" +
  "    var vals=Object.keys(queries).map(function(k){return queries[k];});" +
  "    for(var i=0;i<vals.length;i++) if(capture(vals[i])) return;" +
  "  }catch(e){}" +
  "}" +
  "function should(url){" +
  "  try{" +
  "    var u=new URL(url,location.origin);" +
  "    if(u.pathname.indexOf('/api/v1/manga')===-1)return false;" +
  "    if(/\\/chapters\\/?$/.test(u.pathname))return false;" +
  "    return true;" +
  "  }catch(e){return false;}" +
  "}" +
  "var ofetch=window.fetch;" +
  "if(typeof ofetch==='function'){" +
  "  window.fetch=function(){" +
  "    return ofetch.apply(this,arguments).then(function(r){" +
  "      try{" +
  "        if(should(r.url||'')) r.clone().text().then(function(t){try{capture(JSON.parse(t));}catch(e){}});" +
  "      }catch(e){}" +
  "      return r;" +
  "    });" +
  "  };" +
  "}" +
  "var oOpen=XMLHttpRequest.prototype.open,oSend=XMLHttpRequest.prototype.send;" +
  "XMLHttpRequest.prototype.open=function(m,u){this.__mmU=String(u||'');return oOpen.apply(this,arguments);};" +
  "XMLHttpRequest.prototype.send=function(){" +
  "  this.addEventListener('load',function(){try{if(should(this.__mmU))capture(JSON.parse(this.responseText));}catch(e){}});" +
  "  return oSend.apply(this,arguments);" +
  "};" +
  "document.addEventListener('DOMContentLoaded',fromInitial);" +
  "setTimeout(fromInitial,0);" +
  "})();";

const BROWSE_POLL =
  "(function(){" +
  "if(window.__mmComixBrowse) return window.__mmComixBrowse;" +
  "try{" +
  "  var el=document.querySelector('script#initial-data');" +
  "  if(!el) return '';" +
  "  var queries=JSON.parse(el.textContent).queries;" +
  "  if(!queries) return '';" +
  "  var vals=Object.keys(queries).map(function(k){return queries[k];});" +
  "  for(var i=0;i<vals.length;i++){" +
  "    var parsed=vals[i];" +
  "    if(parsed&&Array.isArray(parsed.items)) parsed={result:parsed};" +
  "    if(parsed&&parsed.result&&Array.isArray(parsed.result.items)&&parsed.result.items.length){" +
  "      window.__mmComixBrowse=JSON.stringify(parsed);" +
  "      return window.__mmComixBrowse;" +
  "    }" +
  "  }" +
  "}catch(e){}" +
  "return window.__mmComixBrowse||'';" +
  "})()";

const CHAPTERS_INJECT =
  "(function(){" +
  "if(window.__mmComixChHook)return;" +
  "window.__mmComixChHook=1;" +
  "window.__mmComixChapters='';" +
  "function capture(parsed){" +
  "  try{" +
  "    var items=(parsed&&parsed.items)||(parsed&&parsed.result&&parsed.result.items)||null;" +
  "    if(items&&items.length&&items[0]&&(items[0].id!=null||items[0].hid!=null||items[0].number!=null)){" +
  "      window.__mmComixChapters=JSON.stringify(parsed.items?parsed:parsed.result||parsed);" +
  "      return true;" +
  "    }" +
  "  }catch(e){}" +
  "  return false;" +
  "}" +
  "function should(url){" +
  "  try{" +
  "    var u=new URL(url,location.origin);" +
  "    return /\\/api\\/v1\\/manga\\/[^/]+\\/chapters\\/?$/.test(u.pathname);" +
  "  }catch(e){return false;}" +
  "}" +
  "var ofetch=window.fetch;" +
  "if(typeof ofetch==='function'){" +
  "  window.fetch=function(){" +
  "    return ofetch.apply(this,arguments).then(function(r){" +
  "      try{if(should(r.url||'')) r.clone().text().then(function(t){try{capture(JSON.parse(t));}catch(e){}});}catch(e){}" +
  "      return r;" +
  "    });" +
  "  };" +
  "}" +
  "})();";

const CHAPTERS_POLL = "window.__mmComixChapters||''";

const PAGES_INJECT =
  "(function(){" +
  "if(window.__mmComixPgHook)return;" +
  "window.__mmComixPgHook=1;" +
  "window.__mmComixPages='';" +
  "function capture(parsed){" +
  "  try{" +
  "    var items=null, base='';" +
  "    if(parsed&&Array.isArray(parsed.items)){items=parsed.items;base=parsed.baseUrl||parsed.base_url||'';}" +
  "    else if(parsed&&parsed.data&&Array.isArray(parsed.data.items)){items=parsed.data.items;base=parsed.data.baseUrl||'';}" +
  "    else if(parsed&&parsed.result&&Array.isArray(parsed.result.items)){items=parsed.result.items;base=parsed.result.baseUrl||'';}" +
  "    else if(Array.isArray(parsed)){items=parsed;}" +
  "    if(items&&items.length&&items[0]&&(typeof items[0]==='string'||items[0].url)){" +
  "      window.__mmComixPages=JSON.stringify({baseUrl:base,items:items});" +
  "      return true;" +
  "    }" +
  "  }catch(e){}" +
  "  return false;" +
  "}" +
  "function should(url){" +
  "  try{" +
  "    var u=new URL(url,location.origin);" +
  "    return /\\/api\\/v1\\/chapters\\/[^/]+\\/?$/.test(u.pathname);" +
  "  }catch(e){return false;}" +
  "}" +
  "var ofetch=window.fetch;" +
  "if(typeof ofetch==='function'){" +
  "  window.fetch=function(){" +
  "    return ofetch.apply(this,arguments).then(function(r){" +
  "      try{if(should(r.url||'')) r.clone().text().then(function(t){try{capture(JSON.parse(t));}catch(e){}});}catch(e){}" +
  "      return r;" +
  "    });" +
  "  };" +
  "}" +
  "})();";

const PAGES_POLL = "window.__mmComixPages||''";

const PAGE_IMG_FALLBACK =
  "(function(){" +
  "var out=[],seen={};" +
  "function add(u){if(!u||seen[u])return;if(/^data:/i.test(u))return;seen[u]=1;out.push(u);}" +
  "document.querySelectorAll('img').forEach(function(img){" +
  "  var u=img.currentSrc||img.src||'';" +
  "  if((img.naturalWidth||0)>=200||/\\/hi\\//i.test(u)||/wowpic/i.test(u)) add(u);" +
  "});" +
  "return out.length?JSON.stringify({baseUrl:'',items:out.map(function(u){return {url:u};})}):'';" +
  "})()";

function browseCapture(url, inject, poll, timeoutMs) {
  // Clear previous payload so a stale listing cannot leak into the next call.
  const clear =
    inject.indexOf("__mmComixBrowse") !== -1
      ? "window.__mmComixBrowse='';"
      : inject.indexOf("__mmComixChapters") !== -1
        ? "window.__mmComixChapters='';"
        : "window.__mmComixPages='';";
  return mm.http.browser(url, {
    waitMs: 300,
    inject: clear + inject,
    script: poll,
    pollMs: 450,
    timeoutMs: timeoutMs || 22000,
  });
}

function ensureNotChallenge(body) {
  const text = body || "";
  if (/<title>\s*just a moment/i.test(text) || /cdn-cgi\/challenge-platform/i.test(text)) {
    mm.errors.fail("Cloudflare challenge. Complete the browser check, wait for the real site, then Continue.");
  }
  return text;
}

function parseJSONBody(res) {
  const text = ensureNotChallenge(res.body);
  try {
    return JSON.parse(text);
  } catch (e) {
    mm.errors.fail(
      "Comix did not return catalogue data. Complete Cloudflare, wait for the browse page to finish loading, then Continue."
    );
  }
}

function statusOf(text) {
  const t = String(text || "").toLowerCase();
  if (t === "ongoing" || t === "publishing" || t === "releasing") return "ongoing";
  if (t === "completed" || t === "complete" || t === "ended" || t === "finished") return "completed";
  if (t === "hiatus" || t === "on_hold" || t === "on hold" || t === "on_hiatus") return "hiatus";
  return "unknown";
}

function posterURL(poster) {
  if (!poster) return undefined;
  if (typeof poster === "string") return poster;
  const q = mm.settings.get("poster") || "large";
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
  if (path) return path;
  const hid = item.hid || "";
  const slug = item.slug;
  return slug ? hid + "-" + slug : hid;
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

function listResult(data) {
  const result = (data && data.result) || data || {};
  const items = (result.items || [])
    .map(mangaFromItem)
    .filter(Boolean);
  const hasNext =
    result.hasNext === true ||
    (result.meta && result.meta.hasNext === true) ||
    (result.pagination && result.pagination.hasNext === true) ||
    items.length >= 36;
  return { items: items, hasNext: !!hasNext };
}

function browseURL(orderKey, page, query, filters) {
  const params = [
    "order[" + orderKey + "]=desc",
    "page=" + encodeURIComponent(String(page || 1)),
  ];
  if (query) params.push("keyword=" + encodeURIComponent(query));
  const rating = (filters && filters.content_rating) || "";
  if (rating) params.push("content_rating=" + encodeURIComponent(rating));
  const type = filters && filters.type;
  if (type) params.push("types[]=" + encodeURIComponent(type));
  return BASE + "/browse?" + params.join("&");
}

function browseList(orderKey, page, query, filters) {
  const url = browseURL(orderKey, page, query, filters);
  const res = browseCapture(url, BROWSE_INJECT, BROWSE_POLL, 25000);
  return listResult(parseJSONBody(res));
}

function hidOf(id) {
  return String(id || "").split("-")[0];
}

function chapterIdOf(chapterId) {
  const s = String(chapterId || "");
  if (s.indexOf("-chapter-") !== -1) return s.split("-")[0];
  return s;
}

globalThis.source = {
  manifest: {
    id: "en.comix",
    name: "Comix",
    version: 6,
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
    const order = listingId === "latest" ? "chapter_updated_at" : "score";
    return browseList(order, page, "", {});
  },

  search(query, page, filters) {
    return browseList("score", page, query, filters || {});
  },

  getFilters() {
    return [
      {
        id: "content_rating",
        name: "Content rating",
        kind: "select",
        defaultValue: "",
        options: ["", "safe", "suggestive", "erotica", "pornographic"],
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
    const DETAIL_POLL =
      "(function(){" +
      "try{" +
      "  var el=document.querySelector('script#initial-data');" +
      "  if(!el)return '';" +
      "  var queries=JSON.parse(el.textContent).queries||{};" +
      "  var keys=Object.keys(queries);" +
      "  for(var i=0;i<keys.length;i++){" +
      "    var key; try{key=JSON.parse(keys[i]);}catch(e){continue;}" +
      "    if(!Array.isArray(key)||key[0]!=='manga'||key[1]!=='detail')continue;" +
      "    var v=queries[keys[i]];" +
      "    if(v&&v.title) return JSON.stringify(v);" +
      "    if(v&&v.data&&v.data.title) return JSON.stringify(v.data);" +
      "  }" +
      "}catch(e){}" +
      "return '';" +
      "})()";
    const res = mm.http.browser(BASE + "/title/" + id, {
      waitMs: 400,
      script: DETAIL_POLL,
      pollMs: 450,
      timeoutMs: 20000,
    });
    let detail;
    try {
      detail = JSON.parse(res.body);
    } catch (e) {
      detail = null;
    }
    if (detail && detail.title) {
      const manga = mangaFromItem(detail);
      if (manga) {
        manga.id = id;
        return manga;
      }
    }
    const html = ensureNotChallenge(res.body);
    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (titleMatch) return { id: id, title: titleMatch[1].trim() };
    mm.errors.fail("Manga not found.");
  },

  getChapters(mangaId) {
    const res = browseCapture(BASE + "/title/" + mangaId, CHAPTERS_INJECT, CHAPTERS_POLL, 30000);
    const data = parseJSONBody(res);
    const items = data.items || data.chapters || [];
    if (!items.length) mm.errors.fail("No chapters found. Wait for the title page to finish loading, then retry.");
    const chapters = [];
    for (let i = 0; i < items.length; i++) {
      const ch = items[i];
      const number = ch.number;
      const cid = String(ch.id);
      const slug = String(number).replace(/\./g, "_");
      const name = ch.name
        ? "Chapter " + String(number).replace(/\.0$/, "") + ": " + ch.name
        : "Chapter " + String(number).replace(/\.0$/, "");
      chapters.push({
        id: cid + "-chapter-" + slug,
        title: name,
        chapter: number,
        scanlator: ch.type || (ch.group && ch.group.title) || undefined,
        language: "en",
      });
    }
    chapters.sort(function (a, b) {
      const an = a.chapter == null ? -1 : a.chapter;
      const bn = b.chapter == null ? -1 : b.chapter;
      return bn - an;
    });
    return chapters;
  },

  getPages(mangaId, chapterId) {
    const numeric = chapterIdOf(chapterId);
    const path =
      String(chapterId).indexOf("-chapter-") !== -1
        ? "/title/" + mangaId + "/" + chapterId
        : "/title/" + mangaId + "/" + chapterId;
    let res = browseCapture(BASE + path, PAGES_INJECT, PAGES_POLL, 30000);
    let payload;
    try {
      payload = JSON.parse(res.body);
    } catch (e) {
      payload = null;
    }
    if (!payload || !payload.items || !payload.items.length) {
      res = mm.http.browser(BASE + path, {
        waitMs: 4000,
        script: PAGE_IMG_FALLBACK,
        pollMs: 500,
        timeoutMs: 12000,
      });
      try {
        payload = JSON.parse(res.body);
      } catch (e2) {
        payload = null;
      }
    }
    if (!payload || !payload.items || !payload.items.length) {
      mm.errors.fail("No page images yet. Open the chapter once after Cloudflare, wait for pages, then retry.");
    }
    const base = String(payload.baseUrl || "").replace(/\/+$/, "");
    return payload.items.map(function (item) {
      const pathOrUrl = typeof item === "string" ? item : item.url;
      let url = /^https?:\/\//i.test(pathOrUrl)
        ? pathOrUrl
        : base + "/" + String(pathOrUrl).replace(/^\/+/, "");
      if ((item && item.s === 1) || /[?&]v3(=|&|$)/.test(url)) {
        if (url.indexOf("v3") === -1) url += (url.indexOf("?") === -1 ? "?" : "&") + "v3";
      }
      return { url: url, headers: { Referer: "", Origin: "" } };
    });
  },
};
