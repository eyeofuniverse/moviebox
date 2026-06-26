// ─── CONFIG ──────────────────────────────────────────────────────────────────
// Get your free TMDB API key at: https://www.themoviedb.org/settings/api
const TMDB_KEY = "a656c2d67487bf7b20b7b113e779b508";

const OMDB_KEY = "82b86556";

const TMDB   = "https://api.themoviedb.org/3";
const OMDB   = "https://www.omdbapi.com";
const IMG    = "https://image.tmdb.org/t/p/";
const STREAM = "https://streamimdb.ru/embed";
const PREFIXES = ["play", "run", "stream", "direct", "fast"];

// Genre carousels shown on the homepage
const SECTIONS = [
  { label: "Trending This Week",  url: "/trending/all/week?language=en-US" },
  { label: "Action & Adventure",  url: "/discover/movie?with_genres=28,12&sort_by=popularity.desc&vote_count.gte=100&language=en-US" },
  { label: "Comedy",              url: "/discover/movie?with_genres=35&sort_by=popularity.desc&vote_count.gte=100&language=en-US" },
  { label: "Drama",               url: "/discover/movie?with_genres=18&sort_by=popularity.desc&vote_count.gte=100&language=en-US" },
  { label: "Sci-Fi & Fantasy",    url: "/discover/movie?with_genres=878,14&sort_by=popularity.desc&vote_count.gte=100&language=en-US" },
  { label: "Horror & Thriller",   url: "/discover/movie?with_genres=27,53&sort_by=popularity.desc&vote_count.gte=100&language=en-US" },
  { label: "Animation",           url: "/discover/movie?with_genres=16&sort_by=popularity.desc&vote_count.gte=100&language=en-US" },
  { label: "Popular TV Series",   url: "/discover/tv?sort_by=popularity.desc&vote_count.gte=100&language=en-US" },
  { label: "Romance",             url: "/discover/movie?with_genres=10749&sort_by=popularity.desc&vote_count.gte=100&language=en-US" },
  { label: "Crime & Mystery",     url: "/discover/movie?with_genres=80,9648&sort_by=popularity.desc&vote_count.gte=100&language=en-US" },
];

// ─── STATE ───────────────────────────────────────────────────────────────────
let heroItems   = [];
let heroIdx     = 0;
let heroTimer   = null;
let searchQ     = "";
let searchPg    = 1;
let searchTotal = 1;
let srDebounce  = null;

// ─── DOM ─────────────────────────────────────────────────────────────────────
const $header    = document.getElementById("header");
const $srInput   = document.getElementById("searchInput");
const $srClear   = document.getElementById("searchClear");
const $home      = document.getElementById("homePage");
const $srPage    = document.getElementById("searchPage");
const $srLabel   = document.getElementById("searchLabel");
const $srGrid    = document.getElementById("searchGrid");
const $srLoader  = document.getElementById("searchLoader");
const $pagBar    = document.getElementById("paginationBar");
const $moreBtn   = document.getElementById("loadMoreBtn");
const $pgCount   = document.getElementById("pageCount");
const $heroBg    = document.getElementById("heroBg");
const $heroC     = document.getElementById("heroContent");
const $heroDots  = document.getElementById("heroDots");
const $sections  = document.getElementById("sectionsContainer");
const $modal     = document.getElementById("modal");
const $modalBg   = document.getElementById("modalBg");
const $modalX    = document.getElementById("modalClose");

// ─── BOOT ────────────────────────────────────────────────────────────────────
function boot() {
  if (TMDB_KEY === "YOUR_TMDB_API_KEY") {
    $heroC.innerHTML = `
      <div style="padding:40px 0">
        <p style="font-size:1.1rem;color:#ccc;margin-bottom:12px;">Add your free TMDB API key in <code style="color:#e50914">app.js</code> to get started.</p>
        <p style="color:#666;font-size:0.9rem;">Sign up free at <strong style="color:#aaa">themoviedb.org/settings/api</strong></p>
      </div>`;
    return;
  }
  loadHome();
}

// ─── HOME ────────────────────────────────────────────────────────────────────
async function loadHome() {
  // Build section shells with skeletons immediately
  SECTIONS.forEach((s, i) => {
    $sections.appendChild(makeSectionShell(s.label, i));
  });

  // Load all sections in parallel — hero comes from first (trending)
  SECTIONS.forEach((s, i) => fetchSection(s, i));
}

async function fetchSection(section, idx) {
  const shell = document.getElementById(`section-${idx}`);
  if (!shell) return;
  const track = shell.querySelector(".carousel-track");

  try {
    const data = await api(section.url);
    const items = data?.results || [];

    if (!items.length) { shell.remove(); return; }

    // First section → hero
    if (idx === 0) {
      heroItems = items.filter(x => x.backdrop_path).slice(0, 6);
      if (heroItems.length) {
        renderHero(0);
        buildDots();
        startHeroTimer();
      }
    }

    track.innerHTML = "";
    items.forEach(item => {
      const mt = item.media_type || (section.url.includes("/discover/tv") ? "tv" : "movie");
      track.appendChild(buildCard(item, mt));
    });
    initArrows(shell);
  } catch (_) {
    if (idx !== 0) shell.remove();
  }
}

function makeSectionShell(label, idx) {
  const sec = document.createElement("section");
  sec.className = "genre-section";
  sec.id = `section-${idx}`;
  sec.innerHTML = `
    <div class="genre-header"><h2 class="genre-title">${esc(label)}</h2></div>
    <div class="carousel-wrapper">
      <button class="carousel-btn prev" aria-label="Scroll left">&#8249;</button>
      <div class="carousel-track"></div>
      <button class="carousel-btn next" aria-label="Scroll right">&#8250;</button>
    </div>`;
  // Add skeleton cards
  const track = sec.querySelector(".carousel-track");
  for (let i = 0; i < 9; i++) {
    const sk = document.createElement("div");
    sk.className = "sk-card";
    sk.innerHTML = `<div class="sk-poster"></div><div class="sk-card-line"></div><div class="sk-card-line s"></div>`;
    track.appendChild(sk);
  }
  return sec;
}

// ─── HERO ────────────────────────────────────────────────────────────────────
function renderHero(i) {
  const item = heroItems[i];
  if (!item) return;

  const title = item.title || item.name || "";
  const mt    = item.media_type || "movie";
  const year  = (item.release_date || item.first_air_date || "").slice(0, 4);
  const score = item.vote_average ? item.vote_average.toFixed(1) : "";
  const plot  = item.overview || "";

  // Crossfade backdrop
  $heroBg.style.opacity = "0";
  const img = new Image();
  img.src = `${IMG}w1280${item.backdrop_path}`;
  img.onload = () => {
    $heroBg.style.backgroundImage = `url('${img.src}')`;
    $heroBg.style.opacity = "1";
  };

  $heroC.innerHTML = `
    <span class="hero-badge">${mt === "tv" ? "Series" : "Movie"}</span>
    <h1 class="hero-title">${esc(title)}</h1>
    <div class="hero-meta">
      ${year  ? `<span>${year}</span><span class="sep">·</span>` : ""}
      ${score ? `<span class="rating">&#9733; ${score}</span>` : ""}
    </div>
    <p class="hero-plot">${esc(plot)}</p>
    <div class="hero-btns">
      <button class="btn-watch" id="hWatch">&#9654; Watch Now</button>
      <button class="btn-info"  id="hInfo" >&#x2139; More Info</button>
    </div>`;

  document.getElementById("hWatch").onclick = () =>
    onCardClick(item.id, mt, title, posterUrl(item.poster_path, "w300"), plot, score, year, true);
  document.getElementById("hInfo").onclick = () =>
    onCardClick(item.id, mt, title, posterUrl(item.poster_path, "w300"), plot, score, year, false);

  document.querySelectorAll(".hero-dot").forEach((d, j) => d.classList.toggle("active", j === i));
}

function buildDots() {
  $heroDots.innerHTML = "";
  heroItems.forEach((_, i) => {
    const btn = document.createElement("button");
    btn.className = `hero-dot${i === 0 ? " active" : ""}`;
    btn.setAttribute("aria-label", `Featured ${i + 1}`);
    btn.onclick = () => { clearInterval(heroTimer); heroIdx = i; renderHero(i); startHeroTimer(); };
    $heroDots.appendChild(btn);
  });
}

function startHeroTimer() {
  clearInterval(heroTimer);
  heroTimer = setInterval(() => {
    heroIdx = (heroIdx + 1) % heroItems.length;
    renderHero(heroIdx);
  }, 7000);
}

// ─── CARD ────────────────────────────────────────────────────────────────────
function buildCard(item, mt) {
  const title  = item.title || item.name || "Unknown";
  const year   = (item.release_date || item.first_air_date || "").slice(0, 4);
  const score  = item.vote_average ? item.vote_average.toFixed(1) : "";
  const poster = posterUrl(item.poster_path, "w300");
  const plot   = item.overview || "";

  const div = document.createElement("div");
  div.className = "movie-card";
  div.tabIndex = 0;
  div.setAttribute("role", "button");
  div.setAttribute("aria-label", `Watch ${title}`);

  div.innerHTML = `
    ${poster
      ? `<img class="card-img" src="${poster}" alt="${esc(title)}" loading="lazy"/>`
      : `<div class="card-no-img"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="2"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>No Image</div>`}
    <span class="card-type-badge${mt === "tv" ? " tv" : ""}">${mt === "tv" ? "TV" : "Film"}</span>
    <div class="card-overlay">
      <button class="card-play-btn" aria-label="Play">&#9654;</button>
      <div class="card-title">${esc(title)}</div>
      <div class="card-sub">
        ${year  ? `<span>${year}</span>` : ""}
        ${score ? `<span class="card-rating">&#9733; ${score}</span>` : ""}
      </div>
    </div>`;

  const go = () => onCardClick(item.id, mt, title, poster, plot, score, year, true);
  div.addEventListener("click", go);
  div.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") go(); });
  return div;
}

// ─── CAROUSEL ARROWS ─────────────────────────────────────────────────────────
function initArrows(shell) {
  const track = shell.querySelector(".carousel-track");
  const prev  = shell.querySelector(".carousel-btn.prev");
  const next  = shell.querySelector(".carousel-btn.next");

  const scroll = dir => track.scrollBy({ left: dir * track.clientWidth * 0.75, behavior: "smooth" });
  prev.addEventListener("click", () => scroll(-1));
  next.addEventListener("click", () => scroll(1));

  const sync = () => {
    prev.style.opacity = track.scrollLeft <= 4 ? "0" : "";
    next.style.opacity = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4 ? "0" : "";
  };
  track.addEventListener("scroll", sync, { passive: true });
  sync();
}

// ─── CLICK HANDLER ───────────────────────────────────────────────────────────
// directImdbId: passed when we already have the IMDB ID (e.g. from OMDB search results)
async function onCardClick(tmdbId, mt, title, poster, plot, score, year, autoPlay, directImdbId = null) {
  showModal({ title, poster, plot, score, year, mt, loading: !directImdbId });

  const imdbId = directImdbId || await getImdbId(tmdbId, mt, title, year);

  if (imdbId && autoPlay) {
    const streamType = mt === "tv" ? "tv" : "movie";
    window.open(`${STREAM}/${streamType}/${imdbId}`, "_blank", "noopener");
  }

  fillModalSources(imdbId, mt);
}

async function getImdbId(tmdbId, mt, title, year) {
  // Try TMDB first
  try {
    const type = mt === "tv" ? "tv" : "movie";
    const data = await api(`/${type}/${tmdbId}?append_to_response=external_ids`);
    const id = data?.imdb_id || data?.external_ids?.imdb_id;
    if (id) return id;
  } catch (_) {}

  // Fallback: search OMDB by title so we still get an IMDB ID
  if (title) {
    try {
      const y = year ? `&y=${year}` : "";
      const t = mt === "tv" ? "&type=series" : "&type=movie";
      const res = await fetch(`${OMDB}/?t=${encodeURIComponent(title)}${y}${t}&apikey=${OMDB_KEY}`);
      const data = await res.json();
      if (data.Response === "True" && data.imdbID) return data.imdbID;
    } catch (_) {}
  }

  return null;
}

// ─── MODAL ───────────────────────────────────────────────────────────────────
function showModal({ title, poster, plot, score, year, mt, loading }) {
  document.getElementById("mTitle").textContent = title;
  document.getElementById("mPlot").textContent  = plot || "No description available.";

  const mPoster = document.getElementById("mPoster");
  const mPH     = document.getElementById("mPosterPlaceholder");
  if (poster) {
    mPoster.src = poster;
    mPoster.classList.remove("hidden");
    mPH.classList.add("hidden");
  } else {
    mPoster.src = "";
    mPoster.classList.add("hidden");
    mPH.classList.remove("hidden");
  }

  const tags = document.getElementById("mTags");
  tags.innerHTML = "";
  if (year)  tags.innerHTML += `<span class="modal-tag">${year}</span>`;
  if (mt)    tags.innerHTML += `<span class="modal-tag${mt === "tv" ? " tv-tag" : ""}">${mt === "tv" ? "TV Series" : "Movie"}</span>`;
  if (score) tags.innerHTML += `<span class="modal-tag rating">&#9733; ${score}</span>`;

  document.getElementById("sourcesGrid").innerHTML =
    loading ? `<span style="color:#555;font-size:0.85rem">Finding stream sources…</span>` : "";

  $modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function fillModalSources(imdbId, mt) {
  const grid = document.getElementById("sourcesGrid");
  grid.innerHTML = "";

  if (!imdbId) {
    grid.innerHTML = `<span style="color:#e05050;font-size:0.85rem">Could not find streaming ID for this title.</span>`;
    return;
  }

  const sType = mt === "tv" ? "tv" : "movie";

  const primaryBtn = makeSourceBtn("primary", "primary", "streamimdb.ru",
    `${STREAM}/${sType}/${imdbId}`);
  grid.appendChild(primaryBtn);

  PREFIXES.forEach(p => {
    grid.appendChild(makeSourceBtn("", p, "imdb.com", `https://www.${p}imdb.com/title/${imdbId}/`));
  });
}

function makeSourceBtn(cls, tag, label, url) {
  const btn = document.createElement("button");
  btn.className = `source-btn${cls ? " " + cls : ""}`;
  btn.innerHTML = `<span class="stag">${tag}</span>${label}`;
  btn.addEventListener("click", () => window.open(url, "_blank", "noopener"));
  return btn;
}

function closeModal() {
  $modal.classList.add("hidden");
  document.body.style.overflow = "";
}

$modalX.addEventListener("click", closeModal);
$modalBg.addEventListener("click", closeModal);
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

// ─── SEARCH ──────────────────────────────────────────────────────────────────
async function search(query, page = 1) {
  if (!query.trim()) return;

  if (page === 1) {
    searchQ = query;
    searchPg = 1;
    $srGrid.innerHTML = "";
    $srLabel.textContent = query;
    $pagBar.classList.add("hidden");
    $moreBtn.onclick = null; // reset in case previous search was OMDB mode
    showSearchView();
  }

  $srLoader.classList.remove("hidden");

  try {
    const data = await api(`/search/multi?query=${encodeURIComponent(query)}&page=${page}&language=en-US&include_adult=false`);
    $srLoader.classList.add("hidden");

    const items = (data?.results || []).filter(x => x.media_type !== "person");

    if (!items.length && page === 1) {
      // TMDB found nothing — try OMDB as fallback
      await searchOmdb(query, 1);
      return;
    }

    searchTotal = data.total_pages || 1;
    searchPg    = page;

    items.forEach(item => {
      const card = buildCard(item, item.media_type || "movie");
      $srGrid.appendChild(card);
    });

    if (searchPg < searchTotal) {
      $moreBtn.classList.remove("hidden");
      $pgCount.textContent = `Page ${searchPg} of ${searchTotal}`;
    } else {
      $moreBtn.classList.add("hidden");
      $pgCount.textContent = "All results shown";
    }
    $pagBar.classList.remove("hidden");
  } catch (_) {
    $srLoader.classList.add("hidden");
    showToast("Search failed. Check your connection.");
  }
}

// OMDB search — used when TMDB has no results for a query
async function searchOmdb(query, page = 1) {
  $srLoader.classList.remove("hidden");
  try {
    const res  = await fetch(`${OMDB}/?s=${encodeURIComponent(query)}&page=${page}&apikey=${OMDB_KEY}`);
    const data = await res.json();
    $srLoader.classList.add("hidden");

    if (data.Response === "False" || !data.Search?.length) {
      if (page === 1) $srGrid.innerHTML = `<p class="empty-msg">No results found for &ldquo;${esc(query)}&rdquo;.</p>`;
      return;
    }

    const total = parseInt(data.totalResults, 10) || 0;
    searchTotal = Math.ceil(total / 10);
    searchPg    = page;

    data.Search.forEach(item => $srGrid.appendChild(buildOmdbCard(item)));

    if (searchPg < searchTotal) {
      $moreBtn.onclick = () => searchOmdb(query, searchPg + 1);
      $moreBtn.classList.remove("hidden");
      $pgCount.textContent = `Showing ${Math.min(page * 10, total)} of ${total} results (via IMDB)`;
    } else {
      $moreBtn.classList.add("hidden");
      $pgCount.textContent = `All ${total} result${total !== 1 ? "s" : ""} shown (via IMDB)`;
    }
    $pagBar.classList.remove("hidden");
  } catch (_) {
    $srLoader.classList.add("hidden");
    showToast("Search failed. Check your connection.");
  }
}

// Card built from an OMDB search result — already has the IMDB ID, no TMDB lookup needed
function buildOmdbCard(item) {
  const mt     = item.Type === "series" || item.Type === "episode" ? "tv" : "movie";
  const poster = item.Poster && item.Poster !== "N/A" ? item.Poster : "";
  const year   = item.Year || "";
  const title  = item.Title || "Unknown";
  const imdbId = item.imdbID;

  const div = document.createElement("div");
  div.className = "movie-card";
  div.tabIndex = 0;
  div.setAttribute("role", "button");
  div.setAttribute("aria-label", `Watch ${title}`);

  div.innerHTML = `
    ${poster
      ? `<img class="card-img" src="${poster}" alt="${esc(title)}" loading="lazy"/>`
      : `<div class="card-no-img"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="2"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>No Image</div>`}
    <span class="card-type-badge${mt === "tv" ? " tv" : ""}">${mt === "tv" ? "TV" : "Film"}</span>
    <div class="card-overlay">
      <button class="card-play-btn" aria-label="Play">&#9654;</button>
      <div class="card-title">${esc(title)}</div>
      <div class="card-sub">${year ? `<span>${year}</span>` : ""}</div>
    </div>`;

  const go = () => onCardClick(null, mt, title, poster, "", "", year, true, imdbId);
  div.addEventListener("click", go);
  div.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") go(); });
  return div;
}

function showSearchView() {
  clearInterval(heroTimer);
  $home.classList.add("hidden");
  $srPage.classList.remove("hidden");
}

function showHomeView() {
  $home.classList.remove("hidden");
  $srPage.classList.add("hidden");
  if (heroItems.length) startHeroTimer();
}

// ─── SEARCH EVENTS ───────────────────────────────────────────────────────────
$srInput.addEventListener("input", () => {
  const v = $srInput.value.trim();
  $srClear.classList.toggle("hidden", !v);
  clearTimeout(srDebounce);
  if (v.length >= 2) {
    srDebounce = setTimeout(() => search(v), 450);
  } else if (!v) {
    showHomeView();
  }
});

$srInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && $srInput.value.trim()) {
    clearTimeout(srDebounce);
    search($srInput.value.trim());
  }
});

$srClear.addEventListener("click", () => {
  $srInput.value = "";
  $srClear.classList.add("hidden");
  showHomeView();
});

$moreBtn.addEventListener("click", () => {
  // Default TMDB load more — overridden to searchOmdb when in OMDB mode
  if (!$moreBtn.onclick) search(searchQ, searchPg + 1);
});

// ─── HEADER SCROLL ───────────────────────────────────────────────────────────
window.addEventListener("scroll", () => {
  $header.classList.toggle("scrolled", window.scrollY > 20);
}, { passive: true });

// ─── LOGO ────────────────────────────────────────────────────────────────────
document.getElementById("logoLink").addEventListener("click", e => {
  e.preventDefault();
  $srInput.value = "";
  $srClear.classList.add("hidden");
  showHomeView();
});

// ─── TMDB FETCH ──────────────────────────────────────────────────────────────
async function api(path) {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${TMDB}${path}${sep}api_key=${TMDB_KEY}`);
  if (!res.ok) throw new Error(res.status);
  return res.json();
}

// ─── TOAST ───────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), 3500);
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function esc(s) {
  if (!s) return "";
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function posterUrl(path, size) {
  return path ? `${IMG}${size}${path}` : "";
}

// ─── START ───────────────────────────────────────────────────────────────────
boot();
