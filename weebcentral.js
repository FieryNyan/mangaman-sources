// Weeb Central — https://weebcentral.com
const BASE = "https://weebcentral.com";
const LIMIT = 32;

function get(url) {
  return mm.http.get(url, { Referer: BASE + "/" });
}

function abs(url) {
  return mm.util.absoluteURL(BASE, url || "");
}

function statusOf(text) {
  const t = String(text || "").toLowerCase();
  if (t.indexOf("ongoing") !== -1) return "ongoing";
  if (t.indexOf("complete") !== -1) return "completed";
  if (t.indexOf("hiatus") !== -1) return "hiatus";
  return "unknown";
}

function chapterNumber(title) {
  const m = String(title || "").match(/(?:chapter|ch\.?)\s*([0-9]+(?:\.[0-9]+)?)/i);
  return m ? Number(m[1]) : undefined;
}

function parseListing(html) {
  const items = [];
  const seen = {};
  const re = /href="(?:https:\/\/weebcentral\.com)?(\/series\/([^"/]+)\/[^"]+)"/g;
  let match;
  while ((match = re.exec(html))) {
    const id = match[2];
    if (seen[id]) continue;
    seen[id] = true;
    const slice = html.slice(Math.max(0, match.index - 120), match.index + 2800);
    const coverMatch =
      slice.match(/srcset="(https:\/\/[^"]+\/cover\/normal\/[^"\s]+)/) ||
      slice.match(/srcset="(https:\/\/[^"]+\/cover\/small\/[^"\s]+)/) ||
      slice.match(/src="(https:\/\/[^"]+\/cover\/[^"]+)"/);
    let cover = coverMatch ? coverMatch[1] : "";
    if (cover.indexOf("/small/") !== -1) cover = cover.replace("/small/", "/normal/");
    const titleMatch =
      slice.match(/alt="([^"]+?)\s+cover"/i) ||
      slice.match(/text-ellipsis[^>]*>\s*([^<]+)/);
    const slugTitle = decodeURIComponent(match[1].split("/").pop().replace(/-/g, " "));
    items.push({
      id: id,
      title: ((titleMatch && titleMatch[1]) || slugTitle).trim(),
      cover: cover,
    });
  }
  return {
    items: items,
    hasNext: /<button\b/i.test(html),
  };
}

function searchURL(query, page, filters) {
  const params = [
    "text=" + encodeURIComponent(String(query || "").replace(/[!#:(),-]/g, " ").trim()),
    "sort=" + encodeURIComponent((filters && filters.sort) || "Popularity"),
    "order=" + encodeURIComponent((filters && filters.order) || "Descending"),
    "official=" + encodeURIComponent((filters && filters.official) || "Any"),
    "anime=" + encodeURIComponent((filters && filters.anime) || "Any"),
    "adult=" + encodeURIComponent((filters && filters.adult) || "Any"),
    "display_mode=" + encodeURIComponent("Full Display"),
    "limit=" + LIMIT,
    "offset=" + (page - 1) * LIMIT,
  ];
  if (filters && filters.status) {
    params.push("included_status=" + encodeURIComponent(filters.status));
  }
  if (filters && filters.type) {
    params.push("included_type=" + encodeURIComponent(filters.type));
  }
  if (filters && filters.tag) {
    params.push("included_tag=" + encodeURIComponent(filters.tag));
  }
  return BASE + "/search/data?" + params.join("&");
}

function parseChapters(html) {
  const chapters = [];
  const seen = {};
  // Keep the window tight so this stays fast on large chapter lists.
  const re =
    /href="\/chapters\/([^"]+)"[\s\S]{0,1500}?span class="">([^<]*)<\/span>[\s\S]{0,800}?datetime="([^"]+)"/g;
  let match;
  while ((match = re.exec(html))) {
    const id = match[1];
    if (seen[id]) continue;
    seen[id] = true;
    const title = match[2].trim();
    const num = chapterNumber(title);
    const item = {
      id: id,
      title: title,
      date: match[3],
      language: "en",
    };
    if (num != null && isFinite(num)) item.chapter = num;
    const around = html.slice(Math.max(0, match.index - 80), match.index + 200);
    if (/official/i.test(around)) item.scanlator = "Official";
    chapters.push(item);
  }
  if (!chapters.length) {
    // Fallback: ids only, still avoids HTMLQuery on multi-MB pages.
    const loose = /href="\/chapters\/([^"]+)"/g;
    while ((match = loose.exec(html))) {
      const id = match[1];
      if (seen[id]) continue;
      seen[id] = true;
      chapters.push({ id: id, title: id, language: "en" });
    }
  }
  return chapters;
}

function parsePages(html) {
  const pages = [];
  const re = /<img\b[^>]*\bsrc="([^"]+)"/gi;
  let match;
  while ((match = re.exec(html))) {
    const src = match[1];
    if (!src || src.indexOf("/static/") !== -1) continue;
    if (!/\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(src) && src.indexOf("manga/") === -1) continue;
    pages.push({
      url: abs(src),
      headers: { Accept: "image/jpeg,image/png,image/webp,image/*,*/*" },
    });
  }
  return pages;
}

globalThis.source = {
  manifest: {
    id: "en.weebcentral",
    name: "Weeb Central",
    version: 3,
    language: "en",
    nsfw: false,
    baseURL: BASE,
    domains: ["weebcentral.com", "compsci88.com", "planeptune.us", "lastation.us"],
    rateLimitPerSecond: 2,
    imageHeaders: {
      Accept: "image/jpeg,image/png,image/webp,image/*,*/*",
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
    const sort = listingId === "latest" ? "Latest Updates" : "Popularity";
    const res = get(searchURL("", page, { sort: sort, order: "Descending" }));
    return parseListing(res.body);
  },

  search(query, page, filters) {
    const res = get(searchURL(query, page, filters || {}));
    return parseListing(res.body);
  },

  getFilters() {
    return [
      {
        id: "sort",
        name: "Sort",
        kind: "select",
        defaultValue: "Popularity",
        options: ["Best Match", "Alphabet", "Popularity", "Subscribers", "Recently Added", "Latest Updates"],
      },
      {
        id: "order",
        name: "Order",
        kind: "select",
        defaultValue: "Descending",
        options: ["Descending", "Ascending"],
      },
      {
        id: "status",
        name: "Status",
        kind: "select",
        defaultValue: "",
        options: ["", "Ongoing", "Complete", "Hiatus", "Canceled"],
      },
      {
        id: "type",
        name: "Type",
        kind: "select",
        defaultValue: "",
        options: ["", "Manga", "Manhwa", "Manhua", "OEL"],
      },
      {
        id: "tag",
        name: "Tag",
        kind: "select",
        defaultValue: "",
        options: [
          "", "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Isekai",
          "Martial Arts", "Mystery", "Romance", "School Life", "Sci-fi", "Seinen",
          "Shoujo", "Shounen", "Slice of Life", "Sports", "Supernatural", "Tragedy",
        ],
      },
      {
        id: "adult",
        name: "Adult",
        kind: "select",
        defaultValue: "Any",
        options: ["Any", "True", "False"],
      },
    ];
  },

  getManga(id) {
    const res = get(BASE + "/series/" + encodeURIComponent(id));
    const html = res.body;
    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const title = titleMatch ? titleMatch[1].trim() : id;
    const coverMatch =
      html.match(/srcset="(https:\/\/[^"]+\/cover\/normal\/[^"\s]+)/) ||
      html.match(/src="(https:\/\/[^"]+\/cover\/[^"]+)"/);
    const authorMatch = html.match(/Author\(s\):\s*<\/strong>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i);
    const statusMatch = html.match(/Status:\s*<\/strong>\s*<a[^>]*>([^<]+)<\/a>/i);
    const descMatch = html.match(/<strong>\s*Description\s*<\/strong>\s*<p[^>]*>([\s\S]*?)<\/p>/i);
    const tags = [];
    const tagRe = /included_tag=([^"&]+)[^>]*>([^<]+)</g;
    let tagMatch;
    while ((tagMatch = tagRe.exec(html))) {
      const name = tagMatch[2].replace(/,$/, "").trim();
      if (name && tags.indexOf(name) === -1) tags.push(name);
    }
    const typeMatch = html.match(/Type:\s*<\/strong>\s*<a[^>]*>([^<]+)<\/a>/i);
    if (typeMatch && tags.indexOf(typeMatch[1].trim()) === -1) tags.push(typeMatch[1].trim());
    return {
      id: id,
      title: title,
      author: authorMatch ? authorMatch[1].trim() : undefined,
      description: descMatch ? descMatch[1].replace(/<[^>]+>/g, "").trim() : undefined,
      cover: coverMatch ? coverMatch[1] : undefined,
      status: statusOf(statusMatch && statusMatch[1]),
      tags: tags,
    };
  },

  getChapters(mangaId) {
    const res = get(BASE + "/series/" + encodeURIComponent(mangaId) + "/full-chapter-list");
    const chapters = parseChapters(res.body);
    if (!chapters.length) mm.errors.fail("No chapters found.");
    return chapters;
  },

  getPages(mangaId, chapterId) {
    const url =
      BASE +
      "/chapters/" +
      encodeURIComponent(chapterId) +
      "/images?is_prev=False&reading_style=long_strip";
    const pages = parsePages(get(url).body);
    if (!pages.length) mm.errors.fail("No pages found.");
    return pages;
  },
};
