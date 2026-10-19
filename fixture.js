// Fixture source. Pages are drawn by the app from mangaman-fixture URLs.
const manga = [
  {
    id: "paper-boat",
    title: "Paper Boat",
    author: "Mina Cho",
    description: "A letter folded at a kitchen table finds its way to the harbor.",
    status: "ongoing",
    tags: ["Slice of life"],
    nsfw: false,
    altTitles: ["Paperboat"],
    updated: "2026-03-02",
  },
  {
    id: "night-market",
    title: "Night Market",
    author: "Leo Park",
    description: "Two stalls, one storm, and the last bowl of noodles on the lane.",
    status: "completed",
    tags: ["Food"],
    nsfw: false,
    altTitles: [],
    updated: "2026-01-18",
  },
  {
    id: "quiet-station",
    title: "The Quiet Station",
    author: "A. Rahman",
    description: "The last train leaves. The people who missed it wait for morning.",
    status: "ongoing",
    tags: ["Drama"],
    nsfw: false,
    altTitles: ["Quiet Station"],
    updated: "2026-04-11",
  },
];

const chapters = {
  "paper-boat": [
    { id: "1", title: "The Fold", chapter: 1, date: "2026-01-04", pages: ["A square of paper.", "Crease down the middle.", "The corners meet.", "It almost looks like a boat.", "She writes nothing inside.", "The window is open."] },
    { id: "2", title: "The Gutter", chapter: 2, date: "2026-02-09", pages: ["Rain takes it off the sill.", "It sticks in the gutter.", "A kid in a yellow coat.", "He frees it with a stick.", "The boat turns once.", "Then it runs."] },
    { id: "3", title: "The Harbor", chapter: 3, date: "2026-03-02", pages: ["The drain meets the canal.", "Workers on the night shift.", "Someone sets it upright.", "It passes the moored boats.", "Dawn on the water.", "Still folded. Still going."] },
  ],
  "night-market": [
    { id: "1", title: "Steam", chapter: 1, date: "2025-12-12", pages: ["Lamps come on at six.", "The broth has been on since noon.", "First customer, no words.", "Chili oil, careful.", "Rain starts between stalls.", "They move the pots closer."] },
    { id: "2", title: "Closing", chapter: 2, date: "2026-01-18", pages: ["The lane thins out.", "One bowl left.", "She gives it to the sweeper.", "He pays anyway.", "Lights off, one by one.", "Steam, then just rain."] },
  ],
  "quiet-station": [
    { id: "1", title: "Last Train", chapter: 1, date: "2026-02-01", pages: ["The board flips to departed.", "She still runs.", "The doors close two steps early.", "A paper cup rolls.", "The platform exhales.", "Nobody speaks yet."] },
    { id: "2", title: "Benches", chapter: 2, date: "2026-02-20", pages: ["Three people, three benches.", "A student with headphones.", "A man counting coins.", "She rereads the same text.", "The heater ticks.", "An hour passes."] },
    { id: "3", title: "Announcement", chapter: 3, date: "2026-03-15", pages: ["The speaker crackles.", "Service resumes at dawn.", "The student laughs once.", "Coins go back in the pocket.", "She puts the phone away.", "They choose one bench."] },
    { id: "4", title: "Morning", chapter: 4, date: "2026-04-11", pages: ["Gray light on the tracks.", "Coffee from a machine.", "The first train shows its lamps.", "No one runs this time.", "Doors open and stay open.", "The station is loud again."] },
  ],
};

function summary(entry) {
  return {
    id: entry.id,
    title: entry.title,
    author: entry.author,
    description: entry.description,
    cover: pageURL(entry.id, "cover", 0, entry.title),
    status: entry.status,
    tags: entry.tags,
    nsfw: false,
    altTitles: entry.altTitles,
  };
}

function pageURL(mangaId, chapterId, index, caption) {
  return "mangaman-fixture://page?manga=" + encodeURIComponent(mangaId)
    + "&chapter=" + encodeURIComponent(chapterId)
    + "&page=" + encodeURIComponent(String(index))
    + "&caption=" + encodeURIComponent(caption);
}

function paginate(list, page) {
  const size = 2;
  const start = (page - 1) * size;
  return { items: list.slice(start, start + size), hasNext: start + size < list.length };
}

globalThis.source = {
  manifest: {
    id: "app.mangaman.fixture",
    name: "Fixture",
    version: 1,
    language: "en",
    nsfw: false,
    baseURL: "https://fixture.mangaman.local",
    domains: ["fixture.mangaman.local"],
    rateLimitPerSecond: 5,
    imageHeaders: {},
    listings: [
      { id: "popular", name: "Popular" },
      { id: "latest", name: "Latest" },
    ],
    defaultReadingMode: "rtl",
    capabilities: ["listings", "search"],
    settings: [
      {
        id: "note",
        name: "Reader note",
        kind: "text",
        defaultValue: "",
        options: [],
      },
    ],
  },

  getListing(listingId, page) {
    const list = manga.slice();
    if (listingId === "latest") {
      list.sort((a, b) => (a.updated < b.updated ? 1 : -1));
    }
    return paginate(list.map(summary), page);
  },

  search(query, page, filters) {
    const q = String(query || "").toLowerCase();
    const genre = filters && filters.genre ? String(filters.genre) : "";
    const list = manga.filter((entry) => {
      const hay = (entry.title + " " + entry.author + " " + entry.tags.join(" ")).toLowerCase();
      if (q && hay.indexOf(q) === -1) return false;
      if (genre && entry.tags.indexOf(genre) === -1) return false;
      return true;
    });
    return paginate(list.map(summary), page);
  },

  getFilters() {
    return [
      {
        id: "genre",
        name: "Genre",
        kind: "select",
        defaultValue: "",
        options: ["", "Slice of life", "Food", "Drama"],
      },
    ];
  },

  getManga(id) {
    const entry = manga.find((item) => item.id === id);
    if (!entry) mm.errors.fail("No manga " + id);
    const item = summary(entry);
    const note = mm.settings.get("note");
    if (note) item.description = item.description + "\n\n" + note;
    return item;
  },

  getChapters(mangaId) {
    const list = chapters[mangaId];
    if (!list) mm.errors.fail("No chapters for " + mangaId);
    return list.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      chapter: chapter.chapter,
      date: chapter.date + "T00:00:00Z",
      language: "en",
    }));
  },

  getPages(mangaId, chapterId) {
    const list = chapters[mangaId] || [];
    const chapter = list.find((item) => item.id === chapterId);
    if (!chapter) mm.errors.fail("No chapter " + chapterId);
    return chapter.pages.map((caption, index) => ({
      url: pageURL(mangaId, chapterId, index + 1, caption),
    }));
  },
};
