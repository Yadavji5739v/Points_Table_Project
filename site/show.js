/* ============================================================
   SHOW CONTROLLER — Cinematic Broadcast Sequence
   Extracted from show.html inline <script> for modularity
   Added: keyboard navigation, 6-match MVP logic, session params
   ============================================================ */

const FF_MVP_KEY = "ff_mvp_players";
const FF_OVERLAYS_KEY = "ff_overlays_v1";
const FF_STORAGE_KEY = "ff_teams_data";

// Stage tracking for keyboard navigation
let ffCurrentStageIndex = -1;
let ffStageQueue = [];
let ffMatchSixMilestone = false; // true if 6-matches completed (multiple of 6)
let ffChampionTeamName = "CHAMPION";
let ffMvpPlayers = [];
let ffAdvanceResolve = null;
let ffPointsTableShown = false;

// Tiny anime-less promise-based animation helpers
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
function fadeIn(el, dur = 500) {
  return new Promise(r => {
    el.style.transition = `opacity ${dur}ms ease`;
    el.style.opacity = 1;
    setTimeout(r, dur);
  });
}
function fadeOut(el, dur = 500) {
  return new Promise(r => {
    el.style.transition = `opacity ${dur}ms ease`;
    el.style.opacity = 0;
    setTimeout(r, dur);
  });
}
function animEl(el, props, dur = 400) {
  return new Promise(r => {
    el.style.transition = `all ${dur}ms cubic-bezier(.2,0,.2,1)`;
    Object.assign(el.style, props);
    setTimeout(r, dur);
  });
}

/* ---- Data ---- */
function getMVPData() {
  try {
    // 1. Individual player data from ff_mvp_players
    const data = JSON.parse(localStorage.getItem(FF_MVP_KEY) || "{}");
    let players = Object.values(data).filter(p => p && p.name && p.name !== "—");
    if (players.length > 0) {
      players.sort((a, b) =>
        (b.kills || 0) !== (a.kills || 0) ? (b.kills || 0) - (a.kills || 0) : (a.bestTeamRank || 999) - (b.bestTeamRank || 999)
      );
      return players.slice(0, 5);
    }

    // 2. Fallback to team standings data if individual player entries are not in log
    const teamsData = JSON.parse(localStorage.getItem(FF_STORAGE_KEY) || "{}");
    const teams = Object.values(teamsData);
    if (teams.length > 0) {
      teams.sort((a, b) => (b.total || 0) - (a.total || 0) || (b.kills || 0) - (a.kills || 0));
      return teams.slice(0, 5).map((t, idx) => ({
        name: `PLAYER ${idx + 1}`,
        team: t.name || `TEAM ${idx + 1}`,
        kills: t.kills || 0,
        bestTeamRank: idx + 1
      }));
    }

    // 3. Fallback to latest stored overlay
    const store = JSON.parse(localStorage.getItem(FF_OVERLAYS_KEY) || "{}");
    const keys = Object.keys(store);
    if (keys.length > 0) {
      const latest = store[keys[keys.length - 1]];
      if (latest && latest.teams && latest.teams.length) {
        return latest.teams.slice(0, 5).map((t, idx) => ({
          name: `PLAYER ${idx + 1}`,
          team: t.n || `TEAM ${idx + 1}`,
          kills: t.k || 0,
          bestTeamRank: idx + 1
        }));
      }
    }
  } catch (e) { }

  // 4. Default fallback so 5 MVP cards are ALWAYS visible on screen
  return [
    { name: "PLAYER 1", team: "CHAMPION TEAM", kills: 12, bestTeamRank: 1 },
    { name: "PLAYER 2", team: "RUNNER UP", kills: 9, bestTeamRank: 2 },
    { name: "PLAYER 3", team: "THIRD PLACE", kills: 7, bestTeamRank: 3 },
    { name: "PLAYER 4", team: "FOURTH PLACE", kills: 5, bestTeamRank: 4 },
    { name: "PLAYER 5", team: "FIFTH PLACE", kills: 4, bestTeamRank: 5 }
  ];
}

function getChampionTeam() {
  try {
    const teamsData = JSON.parse(localStorage.getItem(FF_STORAGE_KEY) || "{}");
    const teams = Object.values(teamsData);
    if (teams.length) {
      teams.sort((a, b) => {
        if ((b.total || 0) !== (a.total || 0)) return (b.total || 0) - (a.total || 0);
        if ((b.booyah || 0) !== (a.booyah || 0)) return (b.booyah || 0) - (a.booyah || 0);
        if ((b.kills || 0) !== (a.kills || 0)) return (b.kills || 0) - (a.kills || 0);
        return 0;
      });
      const top = teams[0];
      if (top && top.name) return { n: top.name };
    }

    const store = JSON.parse(localStorage.getItem(FF_OVERLAYS_KEY) || "{}");
    const keys = Object.keys(store);
    if (!keys.length) return null;
    const latest = store[keys[keys.length - 1]];
    return latest && latest.teams && latest.teams[0] ? latest.teams[0] : null;
  } catch (e) { return null; }
}

function getPointsTableUrl() {
  const queryParams = new URLSearchParams(window.location.search);
  const session = queryParams.get("session");
  const d = queryParams.get("d");
  const params = new URLSearchParams({ embed: "1" });
  if (session) params.set("session", session);
  if (d) params.set("d", d);
  return `live.html?${params.toString()}`;
}

/** Check if total matches processed is a multiple of 6 (6, 12, 18...) */
function isMultipleOfSixMatches() {
  try {
    // Method 1: Check overlay count (each generate = match uploaded)
    const store = JSON.parse(localStorage.getItem(FF_OVERLAYS_KEY) || "{}") || {};
    const overlayCount = Object.keys(store).length;
    if (overlayCount >= 6 && overlayCount % 6 === 0) return true;

    // Method 2: Check total games across all teams
    const teamsData = JSON.parse(localStorage.getItem(FF_STORAGE_KEY) || "{}");
    const teams = Object.values(teamsData);
    if (!teams.length) return false;
    const maxGames = Math.max(...teams.map(t => t.games || 0));
    if (maxGames >= 6 && maxGames % 6 === 0) return true;

    return false;
  } catch (e) {
    return false;
  }
}

/** Load overlay data from session/query param (like live.html does) */
function loadShowFromSession() {
  try {
    const queryParams = new URLSearchParams(window.location.search);
    const session = queryParams.get("session");
    if (!session) return null;

    const store = JSON.parse(localStorage.getItem(FF_OVERLAYS_KEY) || "{}");
    if (store[session]) {
      const data = store[session];
      if (data.teams && data.teams.length) {
        ffChampionTeamName = data.teams[0].n || "CHAMPION";
      }
      return data;
    }

    // Try direct 'd' parameter (encoded payload)
    const d = queryParams.get("d");
    if (d) {
      try {
        const decoded = JSON.parse(decodeURIComponent(atob(d)));
        if (decoded.teams && decoded.teams.length) {
          ffChampionTeamName = decoded.teams[0].n || "CHAMPION";
        }
        return decoded;
      } catch (e) { }
    }
  } catch (e) { }
  return null;
}

/* ---- Boot Animation ---- */
async function runBoot() {
  const boot = document.getElementById("bootScreen");
  const scan = document.getElementById("bootScan");
  const bar = document.getElementById("bootBarFill");
  const lines = ["bl1", "bl2", "bl3", "bl4"].map(id => document.getElementById(id));

  boot.style.opacity = 1;
  boot.style.pointerEvents = "none";

  // scan line
  scan.style.opacity = 1;
  scan.style.transition = "top 1s linear";
  scan.style.top = "0%";
  await wait(50);
  scan.style.top = "100%";

  // boot lines appear
  for (let i = 0; i < lines.length; i++) {
    await wait(180);
    lines[i].style.transition = "opacity 0.3s";
    lines[i].style.opacity = 1;
  }

  // progress bar
  let prog = 0;
  const barInterval = setInterval(() => {
    prog = Math.min(100, prog + Math.random() * 12 + 3);
    bar.style.width = prog + "%";
    if (prog >= 100) clearInterval(barInterval);
  }, 60);
  await wait(800);

  await fadeOut(boot, 400);
  boot.style.display = "none";
}

/* ---- HUD Corners ---- */
function showHUD() {
  ["hc1", "hc2", "hc3", "hc4"].forEach(id => {
    document.getElementById(id).style.opacity = 1;
  });
}
function hideHUD() {
  ["hc1", "hc2", "hc3", "hc4"].forEach(id => {
    document.getElementById(id).style.opacity = 0;
  });
}

/* ---- Doors ---- */
async function openDoors() {
  const left = document.getElementById("doorLeft");
  const right = document.getElementById("doorRight");
  const seam = document.getElementById("doorSeam");

  seam.style.transition = "opacity 0.2s";
  seam.style.opacity = 1;
  await wait(300);
  left.style.transform = "translateX(-100%)";
  right.style.transform = "translateX(100%)";
  seam.style.opacity = 0;
  await wait(1600);
}

async function closeDoors() {
  const left = document.getElementById("doorLeft");
  const right = document.getElementById("doorRight");
  const seam = document.getElementById("doorSeam");

  left.style.transform = "translateX(0)";
  right.style.transform = "translateX(0)";
  await wait(900);
  seam.style.opacity = 1;
  await wait(700);
}

/* ---- Energy Sweep ---- */
async function runEnergySweep() {
  const wrap = document.getElementById("energySweep");
  const beam = document.getElementById("sweepBeam");

  wrap.style.opacity = 1;
  beam.style.transition = "transform 0.8s linear";
  beam.style.transform = "rotate(30deg) translateX(-100%)";
  await wait(50);
  beam.style.transform = "rotate(30deg) translateX(200%)";

  // spawn particles
  for (let i = 0; i < 20; i++) {
    const p = document.createElement("div");
    p.className = "sweep-particle";
    p.style.left = Math.random() * 100 + "%";
    p.style.top = Math.random() * 100 + "%";
    p.style.animationDelay = (Math.random() * 0.5) + "s";
    wrap.appendChild(p);
  }

  await wait(900);
  wrap.style.opacity = 0;
}

/* ---- Tournament Intro ---- */
async function runTournamentIntro() {
  const wrap = document.getElementById("tournamentIntro");
  const badge = document.getElementById("tiBadge");
  const div = document.getElementById("tiDivider");
  const title = document.getElementById("tiTitle");
  const sub = document.getElementById("tiSub");
  const logo = document.getElementById("tiLogo");

  wrap.style.opacity = 1;
  wrap.style.pointerEvents = "none";

  badge.style.transition = "opacity 0.5s, transform 0.5s";
  badge.style.opacity = 1; badge.style.transform = "translateY(0)";
  await wait(400);

  div.style.transition = "width 0.6s ease";
  div.style.width = "400px";
  await wait(500);

  title.style.transition = "opacity 0.6s, transform 0.6s";
  title.style.opacity = 1; title.style.transform = "scale(1)";
  await wait(500);

  sub.style.transition = "opacity 0.5s, transform 0.5s";
  sub.style.opacity = 1; sub.style.transform = "translateY(0)";
  await wait(400);

  logo.style.transition = "opacity 0.5s, transform 0.5s";
  logo.style.opacity = 1; logo.style.transform = "scale(1)";
  await wait(2000);

  await fadeOut(wrap, 500);
}

/* ---- MVP Reveal ---- */
function buildMVPCards(players) {
  const container = document.getElementById("mvpCardsContainer");
  if (!container) return;
  container.innerHTML = "";

  const rankLabels = ["#1", "#2", "#3", "#4", "#5"];
  const rankClasses = ["rank-1", "rank-2", "rank-3", "rank-4", "rank-5"];
  const playerImgs = [
    "../mvp_project_ravi_kumar_yadav-main/assets/1.png",
    "../mvp_project_ravi_kumar_yadav-main/assets/2.png",
    "../mvp_project_ravi_kumar_yadav-main/assets/3.png",
    "../mvp_project_ravi_kumar_yadav-main/assets/1.png",
    "../mvp_project_ravi_kumar_yadav-main/assets/2.png"
  ];
  const localImgs = ["assets/1.png", "assets/2.png", "assets/3.png", "assets/1.png", "assets/2.png"];

  let list = Array.isArray(players) && players.length ? players : getMVPData();
  if (!list || !list.length) {
    list = getMVPData();
  }

  // Sort strictly by highest number of kills of individual player (descending)
  list.sort((a, b) => (b.kills || 0) - (a.kills || 0) || (a.bestTeamRank || 999) - (b.bestTeamRank || 999));

  const data = list.slice(0, 5);

  data.forEach((p, i) => {
    const wrap = document.createElement("div");
    wrap.className = `mvp-card-wrap ${rankClasses[i] || "rank-5"}`;
    wrap.id = `showMvpCard${i}`;
    wrap.innerHTML = `
      <div class="rank-badge">${rankLabels[i]}</div>
      <div class="player-img-wrap">
        <img class="player-img" src="${playerImgs[i]}"
          onerror="this.src='${localImgs[i]}'" alt="player">
      </div>
      <div class="mvp-card">
        <div class="card-info">
          <div class="kills-line">KILLS: <span class="kills-val">${p.kills || 0}</span></div>
          <div class="ign-line">IGN: <span class="ign-val">${(p.name || "—").toUpperCase()}</span></div>
          <div class="team-line">TEAM NAME: <span class="team-val">${(p.team || "—").toUpperCase()}</span></div>
        </div>
      </div>`;
    container.appendChild(wrap);
  });
}

function runMVPReveal(players) {
  return new Promise(async resolve => {
    buildMVPCards(players);

    const wrap = document.getElementById("mvpReveal");
    const title = document.getElementById("mvpRevealTitle");
    const btn = document.getElementById("mvpNextBtn");

    if (!wrap || !title) {
      resolve();
      return;
    }

    let completed = false;
    const finish = () => {
      if (completed) return;
      completed = true;
      wrap.style.pointerEvents = "none";
      fadeOut(wrap, 500).then(resolve);
    };

    wrap.style.opacity = 1;
    wrap.style.pointerEvents = "all";

    title.style.transition = "opacity 0.6s, transform 0.6s";
    title.style.opacity = 1; title.style.transform = "translateY(0)";
    await wait(600);

    const cards = document.querySelectorAll(".mvp-card-wrap");
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      c.style.transition = "opacity 0.5s, transform 0.5s";
      c.style.opacity = 1; c.style.transform = "translateY(0) scale(1)";
      await wait(200);
    }

    if (btn) {
      btn.onclick = finish;
    }

    wrap.onclick = finish;
    setTimeout(finish, 3000);
  });
}

/* ---- Winner Reveal ---- */
function spawnWinnerParticles() {
  const container = document.getElementById("winnerParticles");
  container.innerHTML = "";
  for (let i = 0; i < 30; i++) {
    const p = document.createElement("div");
    p.className = "w-particle";
    p.style.left = Math.random() * 100 + "%";
    p.style.top = (50 + Math.random() * 50) + "%";
    p.style.width = p.style.height = (2 + Math.random() * 4) + "px";
    p.style.animationDelay = (Math.random() * 2) + "s";
    p.style.animationDuration = (1.5 + Math.random() * 1.5) + "s";
    container.appendChild(p);
  }
}

function runCameraShake() {
  const el = document.getElementById("winnerReveal");
  const keyframes = [
    { transform: "translate(0,0)" }, { transform: "translate(-5px,3px)" },
    { transform: "translate(5px,-3px)" }, { transform: "translate(-4px,-4px)" },
    { transform: "translate(4px,4px)" }, { transform: "translate(0,0)" }
  ];
  el.animate(keyframes, { duration: 400, iterations: 3 });
}

function runWinnerReveal(teamName) {
  return new Promise(async resolve => {
    const wrap = document.getElementById("winnerReveal");
    const trophy = document.getElementById("winnerTrophy");
    const label = document.getElementById("winnerLabel");
    const team = document.getElementById("winnerTeamName");
    const fire1 = document.getElementById("wFire1");
    const fire2 = document.getElementById("wFire2");

    const winnerName = teamName || ffChampionTeamName || "CHAMPION";
    if (label) label.textContent = "TABLE TOPPERS";
    team.textContent = winnerName;
    wrap.style.opacity = 1;
    wrap.style.pointerEvents = "none";

    spawnWinnerParticles();

    await wait(200);
    trophy.style.transition = "opacity 0.5s, transform 0.8s cubic-bezier(.2,0,.2,1.6)";
    trophy.style.opacity = 1; trophy.style.transform = "scale(1) rotate(0)";
    await wait(700);

    runCameraShake();

    fire1.style.transition = fire2.style.transition = "opacity 0.3s";
    fire1.style.opacity = 1; fire2.style.opacity = 1;
    await wait(300);

    label.style.transition = "opacity 0.5s";
    label.style.opacity = 1;
    await wait(400);

    team.style.transition = "opacity 0.5s, transform 0.5s";
    team.style.opacity = 1; team.style.transform = "translateY(0)";

    const fireCanvas = document.getElementById("winnerCanvas");
    runFireworks(fireCanvas);

    wrap.style.pointerEvents = "all";

    let done = false;
    const finish = async () => {
      if (done) return;
      done = true;
      clearTimeout(autoTimer);
      wrap.style.pointerEvents = "none";
      await fadeOut(wrap, 400);
      if (!ffPointsTableShown) {
        await runPointsTable();
      }
      resolve();
    };

    let autoTimer = setTimeout(finish, 5000);
    wrap.onclick = finish;
  });
}

/* ---- Celebration ---- */
function runFireworks(canvas) {
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  const colors = ["#39ff14", "#ffd700", "#fff", "#00ff88", "#ff6a00", "#ff0088"];
  let particles = [];

  function burst(x, y) {
    for (let i = 0; i < 80; i++) {
      const angle = (Math.PI * 2 / 60) * i;
      const speed = 2 + Math.random() * 5;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 1, decay: 0.015 + Math.random() * 0.01,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 1 + Math.random() * 3
      });
    }
  }

  let bursting = true;
  const burstInterval = setInterval(() => {
    if (!bursting) { clearInterval(burstInterval); return; }
    burst(Math.random() * canvas.width, Math.random() * canvas.height * 0.7);
  }, 600);

  function tick() {
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.08; p.life -= p.decay;
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color; ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    if (bursting || particles.length) requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  tick();
  return () => { bursting = false; };
}

function runCelebration(teamName, mvpPlayer) {
  return new Promise(async resolve => {
    const wrap = document.getElementById("celebration");
    const teamEl = document.getElementById("celebTeamName");
    const mvpEl = document.getElementById("celebMvpBadge");
    const canvas = document.getElementById("celebCanvas");
    const btn = document.getElementById("celebNextBtn");

    if (!wrap || !teamEl || !mvpEl || !canvas) {
      resolve();
      return;
    }

    let completed = false;
    const finish = async () => {
      if (completed) return;
      completed = true;
      const stopFire = runFireworks(canvas);
      stopFire();
      wrap.style.pointerEvents = "none";
      await fadeOut(wrap, 500);
      resolve();
      runPointsTable();
    };

    teamEl.textContent = (teamName || "CHAMPION").toUpperCase();
    if (mvpPlayer) mvpEl.textContent = `⭐ MVP: ${mvpPlayer.name || "—"} (${mvpPlayer.kills || 0} KILLS)`;

    wrap.style.opacity = 1;
    wrap.style.pointerEvents = "none";

    const stopFire = runFireworks(canvas);
    await wait(1000);
    wrap.style.pointerEvents = "all";

    if (btn) btn.onclick = finish;
    wrap.onclick = finish;
    setTimeout(finish, 10000);
  });
}

/* ---- Transition Wipe ---- */
async function runTransitionWipe() {
  const wrap = document.getElementById("transWipe");
  const beam = document.getElementById("wipeBeam");
  wrap.style.opacity = 1;
  beam.style.transition = "transform 0.8s linear";
  beam.style.transform = "rotate(15deg) translateX(200%)";
  await wait(900);
  wrap.style.opacity = 0;
  beam.style.transform = "rotate(15deg) translateX(-120%)";
}

/* ---- Points Table ---- */
async function runPointsTable() {
  if (ffPointsTableShown) return;
  ffPointsTableShown = true;

  const wrap = document.getElementById("pointsTableWrap");
  const frame = document.getElementById("pointsTableFrame");
  const header = document.getElementById("ptHeader");
  const footer = document.getElementById("ptFooter");

  if (!wrap) return;

  const tableUrl = getPointsTableUrl();
  if (frame) frame.src = tableUrl;
  wrap.style.opacity = 0;
  wrap.style.pointerEvents = "all";
  wrap.style.display = "flex";

  await runTransitionWipe();

  await fadeIn(wrap, 800);
  await wait(500);
  if (header) header.style.opacity = 1;
  await wait(300);
  if (footer) footer.style.opacity = 1;
}

/* ============================================================
   KEYBOARD & NAVIGATION CONTROLS
   Click handlers for visible stage buttons by simulating click
   on whichever "next" button is currently visible.
   ============================================================ */

function handleNextStage() {
  const pointsWrap = document.getElementById("pointsTableWrap");
  const celebration = document.getElementById("celebration");
  const winner = document.getElementById("winnerReveal");
  const mvp = document.getElementById("mvpReveal");
  const celebNext = document.getElementById("celebNextBtn");
  const tableBtn = document.getElementById("wTableBtn");
  const mvpBtn = document.getElementById("mvpNextBtn");

  if (celebNext && parseFloat(getComputedStyle(celebration).opacity || "0") > 0) {
    celebNext.click();
  } else if (tableBtn && parseFloat(getComputedStyle(winner).opacity || "0") > 0) {
    tableBtn.click();
  } else if (mvpBtn && parseFloat(getComputedStyle(mvp).opacity || "0") > 0) {
    mvpBtn.click();
  }
}

function handlePrevStage() {
  const pointsWrap = document.getElementById("pointsTableWrap");
  const celebration = document.getElementById("celebration");
  const winner = document.getElementById("winnerReveal");
  const mvp = document.getElementById("mvpReveal");

  if (pointsWrap && parseFloat(getComputedStyle(pointsWrap).opacity || "0") > 0) {
    fadeOut(pointsWrap, 400).then(() => runWinnerReveal(ffChampionTeamName));
    return;
  }

  if (celebration && parseFloat(getComputedStyle(celebration).opacity || "0") > 0) {
    fadeOut(celebration, 400).then(() => runWinnerReveal(ffChampionTeamName));
    return;
  }

  if (winner && parseFloat(getComputedStyle(winner).opacity || "0") > 0) {
    if (ffMatchSixMilestone) {
      fadeOut(winner, 400).then(() => runMVPReveal(ffMvpPlayers));
    }
    return;
  }

  if (mvp && parseFloat(getComputedStyle(mvp).opacity || "0") > 0) {
    fadeOut(mvp, 400);
    return;
  }
}

function setupKeyboardNavigation() {
  const nextNavBtn = document.getElementById("showNextNavBtn");
  const prevNavBtn = document.getElementById("showPrevNavBtn");
  const ffNextBtn = document.getElementById("ffShowNextBtn");
  const ffPrevBtn = document.getElementById("ffShowPrevBtn");

  if (nextNavBtn) nextNavBtn.onclick = handleNextStage;
  if (prevNavBtn) prevNavBtn.onclick = handlePrevStage;
  if (ffNextBtn) ffNextBtn.onclick = handleNextStage;
  if (ffPrevBtn) ffPrevBtn.onclick = handlePrevStage;

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "ArrowRight" || ev.key === "Enter") {
      ev.preventDefault();
      handleNextStage();
    } else if (ev.key === "ArrowLeft") {
      ev.preventDefault();
      handlePrevStage();
    }
  });
}

/* ============================================================
   MAIN SEQUENCE
   ============================================================ */

async function runShow() {
  ffPointsTableShown = false;

  // Required flow: intro -> MVP (only on 6-match milestone) -> champion -> points table
  ffMatchSixMilestone = isMultipleOfSixMatches();
  ffMvpPlayers = getMVPData();

  const champion = getChampionTeam();
  if (champion) ffChampionTeamName = champion.n;

  // Stage 1: Black screen (0.5s)
  await wait(500);

  // Stage 2: System Boot (1s)
  document.getElementById("fadeOverlay").style.opacity = 0;
  await runBoot();

  // Animated background fades in
  const bg = document.getElementById("animBg");
  bg.style.transition = "opacity 0.8s";
  bg.style.opacity = 1;
  showHUD();

  await openDoors();
  await runEnergySweep();

  // Stage 5: Tournament Intro (must stay first)
  await runTournamentIntro();

  // Stage 6: MVP Reveal — only when total match count is a multiple of 6
  if (ffMatchSixMilestone) {
    await runMVPReveal(ffMvpPlayers);
  }

  // Stage 7: Champion reveal
  await runWinnerReveal(ffChampionTeamName);

  // Stage 8: Points table
  await runPointsTable();
}

document.addEventListener("DOMContentLoaded", () => {
  // Try to load from session first
  loadShowFromSession();

  // Setup keyboard navigation
  setupKeyboardNavigation();

  // Run the show
  runShow();
});

