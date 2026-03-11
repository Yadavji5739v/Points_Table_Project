const STORAGE_KEY = "ff_teams_data";

/* ==============================
   UPLOAD PAGE (index.html)
============================== */
function proceed() {
  const fileInput = document.getElementById("logFile");

  if (!fileInput.files.length) {
    alert("Please upload a log file");
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    processLogAndStore(e.target.result);

    const teamsData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    const teamCount = Object.keys(teamsData).length;

    // 🔥 ROUTING LOGIC
    if (teamCount > 13) {
      window.location.href = "bg.html";
    } else {
      window.location.href = "standings.html";
    }
  };

  reader.readAsText(fileInput.files[0]);
}

/* ==============================
   PROCESS LOG + MERGE DATA
   + AUTO BOOYAH
============================== */
function processLogAndStore(text) {
  const lines = text.split("\n");
  let teamsData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};

  let booyahGiven = false;

  lines.forEach(line => {
    if (!line.startsWith("TeamName:")) return;

    const nameMatch  = line.match(/TeamName:\s(.+?)\sRank/i);
    const killMatch  = line.match(/KillScore:\s(\d+)/i);
    const rankMatch  = line.match(/RankScore:\s(\d+)/i);
    const totalMatch = line.match(/TotalScore:\s(\d+)/i);

    if (!nameMatch || !killMatch || !rankMatch || !totalMatch) return;

    const name = nameMatch[1].trim().toUpperCase();

    if (!teamsData[name]) {
      teamsData[name] = { name, booyah: 0, games: 0, kills: 0, pos: 0, total: 0 };
    }

    const kills = +killMatch[1];
    const pos   = +rankMatch[1];
    const total = +totalMatch[1];

    teamsData[name].games += 1;
    teamsData[name].kills += kills;
    teamsData[name].pos   += pos;
    teamsData[name].total += total;

    if (pos === 12 && !booyahGiven) {
      teamsData[name].booyah += 1;
      booyahGiven = true;
    }
  });

  localStorage.setItem(STORAGE_KEY, JSON.stringify(teamsData));
}

/* ==============================
   BUILD ONE ROW  ← shared helper
   Columns: RANK | TEAM NAME | MATCHES | BOOYAH | RANK PTS | KILL PTS | TOTAL
============================== */
function buildRow(rank, t) {
  return `
    <div class="row">
      <div class="rank-cell"><div class="rank-badge">${rank}</div></div>
      <div class="team-cell">${t.name}</div>
      <div class="orange-cell">${t.games   || 0}</div>
      <div class="white-cell">${t.booyah  || 0}</div>
      <div class="orange-cell">${t.pos     || 0}</div>
      <div class="white-cell">${t.kills   || 0}</div>
      <div class="orange-cell">${t.total   || 0}</div>
    </div>
  `;
}

/* ==============================
   STANDINGS PAGE
============================== */
document.addEventListener("DOMContentLoaded", () => {

  const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (!data || Object.keys(data).length === 0) {
    alert("No data found. Please upload a file first.");
    return;
  }

const teams = Object.values(data)
  .sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if ((b.booyah||0) !== (a.booyah||0)) return (b.booyah||0) - (a.booyah||0);
    if (b.kills !== a.kills) return b.kills - a.kills;
    return 0;
  })
  .slice(0, 18);   // 🔥 LIMIT TO 18 TEAMS

  /* ── NORMAL (standings.html) ── */
  const table = document.getElementById("tableBody");
  if (table) {
    table.innerHTML = "";
    teams.slice(0, 13).forEach((t, i) => {
      table.innerHTML += buildRow(i + 1, t);
    });
  }

  /* ── HORIZONTAL (bg.html) ── */
  const left  = document.getElementById("leftTable");
  const right = document.getElementById("rightTable");

  if (left && right) {
    left.innerHTML  = "";
    right.innerHTML = "";

    const leftCount  = Math.ceil(teams.length / 2);
    const leftTeams  = teams.slice(0, leftCount);
    const rightTeams = teams.slice(leftCount);

    leftTeams.forEach( (t, i) => { left.innerHTML  += buildRow(i + 1,              t); });
    rightTeams.forEach((t, i) => { right.innerHTML += buildRow(i + 1 + leftCount,  t); });
  }

  /* ── BUTTONS ── */
  const downloadBtn  = document.getElementById("downloadBtn");
  const uploadMoreBtn = document.getElementById("uploadMoreBtn");
  const resetBtn     = document.getElementById("resetBtn");

  if (downloadBtn)   downloadBtn.onclick  = downloadImage;
  if (uploadMoreBtn) uploadMoreBtn.onclick = () => { window.location.href = "index.html"; };
  if (resetBtn)      resetBtn.onclick     = resetStandings;
});

/* ==============================
   DOWNLOAD IMAGE
============================== */
function downloadImage() {
  const poster          = document.querySelector(".poster");
  const elementsToHide  = document.querySelectorAll(".no-export");

  elementsToHide.forEach(el => el.style.display = "none");

  // Replace inputs with spans so html2canvas renders text correctly
  const inputs = poster.querySelectorAll("input");
  const inputReplacements = [];

  inputs.forEach(input => {
    const span      = document.createElement("span");
    span.innerText  = (input.value || "").toUpperCase();
    span.className  = input.className;

    const style         = window.getComputedStyle(input);
    span.style.fontSize   = style.fontSize;
    span.style.fontWeight = style.fontWeight;
    span.style.textAlign  = style.textAlign;
    span.style.width      = style.width;
    span.style.display    = "inline-block";

    inputReplacements.push({ parent: input.parentNode, input, span });
    input.parentNode.replaceChild(span, input);
  });

  html2canvas(poster, { scale: 2 }).then(canvas => {
    const link    = document.createElement("a");
    link.href     = canvas.toDataURL("image/png");
    link.download = "ff-standings.png";
    link.click();

    // Restore inputs
    inputReplacements.forEach(item => item.parent.replaceChild(item.input, item.span));
    elementsToHide.forEach(el => el.style.display = "flex");
  });
}

/* ==============================
   RESET STANDINGS
============================== */
function resetStandings() {
  if (!confirm("Are you sure you want to reset all standings?")) return;
  localStorage.removeItem(STORAGE_KEY);
  window.location.href = "index.html";
}
