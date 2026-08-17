/* ==============================================================
   OVERLAY DATA LAYER
   - Reads the SAME localStorage data your existing app already
     writes (STORAGE_KEY = "ff_teams_data"). Nothing about the
     existing parsing / points calculation is touched.
   - Keeps a reusable live session so one copied link can keep
     showing the latest standings after each upload.
   ============================================================== */

const FF_STORAGE_KEY = "ff_teams_data";
const FF_MAX_TEAMS = 12;
const FF_OVERLAYS_KEY = "ff_overlays_v1";
const FF_TITLE_KEY = "ff_overlay_title";
const FF_LIVE_SESSION_KEY = "ff_live_session_v1";
const FF_LIVE_SESSION_SIGNAL_KEY = "ff_live_session_signal";
const FF_LIVE_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function ffSaveOverlayTitle(titleData) {
  if (!titleData || (!titleData.main && !titleData.sub)) return;
  localStorage.setItem(FF_TITLE_KEY, JSON.stringify({
    main: titleData.main || "",
    sub: titleData.sub || ""
  }));
}

function ffLoadOverlayTitle() {
  try {
    return JSON.parse(localStorage.getItem(FF_TITLE_KEY) || "{}") || {};
  } catch (err) {
    return {};
  }
}

/* Same tie-break order used by script.js on the standings pages */
function ffGetSortedTeams() {
  const data = JSON.parse(localStorage.getItem(FF_STORAGE_KEY)) || {};
  return Object.values(data).sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if ((b.booyah || 0) !== (a.booyah || 0)) return (b.booyah || 0) - (a.booyah || 0);
    if (b.kills !== a.kills) return b.kills - a.kills;
    return 0;
  });
}

/* Best-effort grab of whatever title the user typed on the page
   (standings.html / bg.html / ver.html all use slightly different
   inputs), so the overlay title matches what they see on the poster. */
function ffGetTournamentTitle() {
  const mainEl = document.querySelector(".title-esports");
  const subEl = document.querySelector(".title-phase");
  if (mainEl && mainEl.value && mainEl.value.trim()) {
    const main = mainEl.value.trim();
    const sub = subEl && subEl.value && subEl.value.trim() ? subEl.value.trim() : "";
    const title = [main, sub].filter(Boolean).join(" ");
    ffSaveOverlayTitle({ main, sub });
    return title.toUpperCase();
  }

  const selectors = [
    "#userInput",
    ".standings-underline .user-input",
    ".user-input"
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.value && el.value.trim()) {
      const title = el.value.trim();
      ffSaveOverlayTitle({ main: title, sub: "" });
      return title.toUpperCase();
    }
  }

  const storedTitle = ffLoadOverlayTitle();
  if (storedTitle.main) {
    return [storedTitle.main, storedTitle.sub].filter(Boolean).join(" ").toUpperCase();
  }

  return "ESPORTS STANDINGS";
}

function ffEncodePayload(obj) {
  const json = JSON.stringify(obj);
  return btoa(encodeURIComponent(json).replace(/%([0-9A-F]{2})/g,
    (_, p1) => String.fromCharCode("0x" + p1)));
}

function ffDecodePayload(str) {
  const json = decodeURIComponent(
    atob(str).split("").map(c =>
      "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)
    ).join("")
  );
  return JSON.parse(json);
}

function ffGenerateId() {
  return Math.random().toString(36).slice(2, 8);
}

function ffGetOrCreateLiveSession(forceNew = false) {
  try {
    const stored = JSON.parse(localStorage.getItem(FF_LIVE_SESSION_KEY) || "null");
    if (!forceNew && stored && stored.id && (!stored.expiresAt || stored.expiresAt > Date.now())) {
      return stored;
    }
  } catch (err) {
    // ignore and create a fresh one
  }

  const session = {
    id: ffGenerateId(),
    createdAt: Date.now(),
    expiresAt: Date.now() + FF_LIVE_SESSION_TTL_MS
  };
  localStorage.setItem(FF_LIVE_SESSION_KEY, JSON.stringify(session));
  return session;
}

function ffExpireLiveSession() {
  localStorage.removeItem(FF_LIVE_SESSION_KEY);
  return ffGetOrCreateLiveSession(true);
}

function ffBuildLiveLinks(session, controls, payload) {
  const base = new URL("live.html", window.location.href);
  const params = new URLSearchParams({ controls: String(controls) });
  if (payload) {
    params.set("d", ffEncodePayload(payload));
    params.set("session", session.id);
  } else {
    params.set("session", session.id);
  }
  return `${base.href}?${params.toString()}`;
}

function ffRefreshLiveSessionFromCurrentStandings() {
  const teams = ffGetSortedTeams().slice(0, FF_MAX_TEAMS);
  if (!teams.length) {
    return null;
  }

  const session = ffGetOrCreateLiveSession();
  const payload = {
    id: session.id,
    title: ffGetTournamentTitle(),
    teams: teams.map(t => ({
      n: t.name,
      g: t.games || 0,
      b: t.booyah || 0,
      p: t.pos || 0,
      k: t.kills || 0,
      t: t.total || 0
    })),
    ts: Date.now()
  };

  const store = JSON.parse(localStorage.getItem(FF_OVERLAYS_KEY) || "{}") || {};
  store[session.id] = payload;
  localStorage.setItem(FF_OVERLAYS_KEY, JSON.stringify(store));
  localStorage.setItem(FF_LIVE_SESSION_KEY, JSON.stringify(session));
  localStorage.setItem(FF_LIVE_SESSION_SIGNAL_KEY, String(Date.now()));

  return { payload, session };
}

/* Builds the payload, saves it locally (so this same browser can
   reopen it quickly), and returns the shareable/OBS-ready links. */
function ffGenerateOverlay(options = {}) {
  const teams = ffGetSortedTeams().slice(0, FF_MAX_TEAMS);
  if (!teams.length) {
    alert("No standings data found. Upload a match log first.");
    return null;
  }

  const session = options.rotate ? ffExpireLiveSession() : ffGetOrCreateLiveSession(!!options.forceNew);
  const payload = {
    id: session.id,
    title: ffGetTournamentTitle(),
    teams: teams.map(t => ({
      n: t.name,
      g: t.games || 0,
      b: t.booyah || 0,
      p: t.pos || 0,
      k: t.kills || 0,
      t: t.total || 0
    })),
    ts: Date.now()
  };

  const store = JSON.parse(localStorage.getItem(FF_OVERLAYS_KEY) || "{}") || {};
  store[payload.id] = payload;
  localStorage.setItem(FF_OVERLAYS_KEY, JSON.stringify(store));
  localStorage.setItem(FF_LIVE_SESSION_KEY, JSON.stringify(session));
  localStorage.setItem(FF_LIVE_SESSION_SIGNAL_KEY, String(Date.now()));

  const obsLink = ffBuildLiveLinks(session, 0, payload);
  const previewLink = ffBuildLiveLinks(session, 1, payload);

  return { payload, obsLink, previewLink, session };
}

window.ffRefreshLiveSessionFromCurrentStandings = ffRefreshLiveSessionFromCurrentStandings;
window.ffGenerateOverlay = ffGenerateOverlay;

function ffGetLatestOverlayData() {
  if (typeof ffGetActiveTournament === "function") {
    try {
      const active = ffGetActiveTournament();
      if (active && active.id) {
        const store = JSON.parse(localStorage.getItem(FF_OVERLAYS_KEY) || "{}");
        if (store[active.id]) return store[active.id];
      }
    } catch(e) {}
  }

  try {
    const session = JSON.parse(localStorage.getItem(FF_LIVE_SESSION_KEY) || "null");
    if (session && session.id) {
      const store = JSON.parse(localStorage.getItem(FF_OVERLAYS_KEY) || "{}");
      if (store[session.id]) return store[session.id];
    }
  } catch(e) {}

  try {
    const store = JSON.parse(localStorage.getItem(FF_OVERLAYS_KEY) || "{}");
    const keys = Object.keys(store);
    if (keys.length > 0) {
      const latest = store[keys[keys.length - 1]];
      if (latest && latest.teams && latest.teams.length) return latest;
    }
  } catch(e) {}

  try {
    const teams = ffGetSortedTeams().slice(0, FF_MAX_TEAMS);
    if (teams && teams.length > 0) {
      const title = typeof ffGetTournamentTitle === "function" ? ffGetTournamentTitle() : "ESPORTS STANDINGS";
      return {
        id: "auto",
        title: title,
        teams: teams.map(t => ({
          n: t.name,
          g: t.games || 0,
          b: t.booyah || 0,
          p: t.pos || 0,
          k: t.kills || 0,
          t: t.total || 0
        })),
        ts: Date.now()
      };
    }
  } catch(e) {}

  return null;
}

window.ffGetLatestOverlayData = ffGetLatestOverlayData;

