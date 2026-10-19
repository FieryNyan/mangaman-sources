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

globalThis.source = {
  manifest: {
    id: "en.weebcentral",
    name: "Weeb Central",
    version: 1,
    language: "en",
    nsfw: false,
    baseURL: BASE,
    domains: ["weebcentral.com", "compsci88.com", "planeptune.us"],
    rateLimitPerSecond: 0.5,
    imageHeaders: {
      Referer: BASE + "/",
      Accept: "image/avif,image/webp,*/*",
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
    const res = get(BASE + "/series/" + encodeURIComponent(id) + "/");
    const html = res.body;
    const titleNode = mm.html.select(html, "h1");
    const title = (titleNode[0] && titleNode[0].text.trim()) || id;
    const coverNode = mm.html.select(html, "source");
    let cover = "";
    for (let i = 0; i < coverNode.length; i++) {
      const srcset = coverNode[i].attrs.srcset || "";
      if (srcset.indexOf("/cover/normal/") !== -1) {
        cover = srcset.split(/\s+/)[0];
        break;
      }
      if (!cover && srcset) cover = srcset.split(/\s+/)[0];
    }
    if (!cover) {
      const img = mm.html.select(html, "img");
      for (let i = 0; i < img.length; i++) {
        const src = img[i].attrs.src || "";
        if (src.indexOf("/cover/") !== -1) {
          cover = src;
          break;
        }
      }
    }
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
      cover: cover,
      status: statusOf(statusMatch && statusMatch[1]),
      tags: tags,
    };
  },

  getChapters(mangaId) {
    const res = get(BASE + "/series/" + encodeURIComponent(mangaId) + "/full-chapter-list");
    const links = mm.html.select(res.body, "a");
    const chapters = [];
    for (let i = 0; i < links.length; i++) {
      const href = links[i].attrs.href || "";
      const idMatch = href.match(/\/chapters\/([^/?#]+)/);
      if (!idMatch) continue;
      const titleMatch = links[i].html.match(/<span class="">([^<]+)<\/span>/);
      const title = (titleMatch && titleMatch[1].trim()) || links[i].text.replace(/\s+/g, " ").trim();
      if (!title || title.indexOf("Chapter") === -1 && !/\d/.test(title)) {
        if (!/chapter/i.test(title) && !/^\d/.test(title)) continue;
      }
      const timeMatch = links[i].html.match(/datetime="([^"]+)"/);
      const official = /official/i.test(links[i].html);
      const num = chapterNumber(title);
      chapters.push({
        id: idMatch[1],
        title: title,
        chapter: num,
        date: timeMatch ? timeMatch[1] : undefined,
        scanlator: official ? "Official" : undefined,
        language: "en",
      });
    }
    if (!chapters.length) mm.errors.fail("No chapters found.");
    return chapters;
  },

  getPages(mangaId, chapterId) {
    const url =
      BASE +
      "/chapters/" +
      encodeURIComponent(chapterId) +
      "/images?is_prev=False&reading_style=long_strip";
    const res = get(url);
    const imgs = mm.html.select(res.body, "img");
    const pages = [];
    for (let i = 0; i < imgs.length; i++) {
      const src = imgs[i].attrs.src || imgs[i].attrs["data-src"] || "";
      if (!src || src.indexOf("/static/") !== -1) continue;
      if (!/\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(src) && src.indexOf("manga/") === -1) continue;
      pages.push({
        url: abs(src),
        headers: { Referer: BASE + "/", Accept: "image/avif,image/webp,*/*" },
      });
    }
    if (!pages.length) mm.errors.fail("No pages found.");
    return pages;
  },
};
