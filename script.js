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
    if (teamCount > 12) {
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

    const nameMatch = line.match(/TeamName:\s(.+?)\sRank/i);
    const killMatch = line.match(/KillScore:\s(\d+)/i);
    const rankMatch = line.match(/RankScore:\s(\d+)/i);
    const totalMatch = line.match(/TotalScore:\s(\d+)/i);

    if (!nameMatch || !killMatch || !rankMatch || !totalMatch) return;

    const name = nameMatch[1].trim().toUpperCase();

    // 🚫 Ignore NEW teams beyond 18, but DO NOT STOP
    if (!teamsData[name] && Object.keys(teamsData).length >= 18) {
      return;
    }

    if (!teamsData[name]) {
      teamsData[name] = {
        name,
        booyah: 0,
        games: 0,
        kills: 0,
        pos: 0,
        total: 0
      };
    }

    const kills = +killMatch[1];
    const pos = +rankMatch[1];
    const total = +totalMatch[1];

    teamsData[name].games += 1;
    teamsData[name].kills += kills;
    teamsData[name].pos += pos;
    teamsData[name].total += total;

    if (pos === 12 && !booyahGiven) {
      teamsData[name].booyah += 1;
      booyahGiven = true;
    }
  });

  localStorage.setItem(STORAGE_KEY, JSON.stringify(teamsData));
}



/* ==============================
   STANDINGS PAGE
============================== */
document.addEventListener("DOMContentLoaded", () => {

  const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (!data) return;

  const teams = Object.values(data).sort((a, b) => {

  // 1️⃣ TOTAL POINTS (highest first)
  if (b.total !== a.total) {
    return b.total - a.total;
  }

  // 2️⃣ BOOYAH COUNT (official FF tiebreaker)
  if ((b.booyah || 0) !== (a.booyah || 0)) {
    return (b.booyah || 0) - (a.booyah || 0);
  }

  // 3️⃣ ELIMINATIONS (kills)
  if (b.kills !== a.kills) {
    return b.kills - a.kills;
  }

  return 0;
});


  /* =====================
     NORMAL (standings.html)
  ===================== */
  const table = document.getElementById("tableBody");
  if (table) {
    table.innerHTML = "";
    teams.slice(0, 12).forEach((t, i) => {
      table.innerHTML += `
        <div class="row">
          <div class="rank">${i + 1}</div>
          <div class="team">${t.name}</div>
          <div class="cell">${t.booyah || 0}</div>
          <div class="cell">${t.games}</div>
          <div class="cell">${t.pos}</div>
          <div class="cell">${t.kills}</div>
          <div class="cell">${t.total}</div>
        </div>
      `;
    });
  }

  /* =====================
     HORIZONTAL (bg.html)
  ===================== */
  const left = document.getElementById("leftTable");
  const right = document.getElementById("rightTable");

  if (left && right) {
    left.innerHTML = "";
    right.innerHTML = "";

    const maxTeams = 18;
const safeTeams = teams.slice(0, maxTeams);

const leftCount = Math.ceil(safeTeams.length / 2);
const leftTeams = safeTeams.slice(0, leftCount);
const rightTeams = safeTeams.slice(leftCount);

    const render = (list, container, offset) => {
      list.forEach((t, i) => {
        container.innerHTML += `
          <div class="row">
            <div class="rank">${offset + i + 1}</div>
            <div class="team">${t.name}</div>
            <div class="cell">${t.booyah || 0}</div>
            <div class="cell">${t.games}</div>
            <div class="cell">${t.pos}</div>
            <div class="cell">${t.kills}</div>
            <div class="cell">${t.total}</div>
          </div>
        `;
      });
    };

    render(leftTeams, left, 0);
    render(rightTeams, right, leftTeams.length);
  }


  /* DOWNLOAD BUTTON */
  const downloadBtn = document.getElementById("downloadBtn");
  if (downloadBtn) {
    downloadBtn.onclick = downloadImage;
  }

  /* UPLOAD MORE BUTTON */
  const uploadMoreBtn = document.getElementById("uploadMoreBtn");
  if (uploadMoreBtn) {
    uploadMoreBtn.onclick = () => {
      window.location.href = "index.html";
    };
  }

  /* RESET BUTTON */
  const resetBtn = document.getElementById("resetBtn");
  if (resetBtn) {
    resetBtn.onclick = resetStandings;
  }
});

/* ==============================
   DOWNLOAD IMAGE
============================== */
function downloadImage() {
  const poster = document.querySelector(".poster");
  const elementsToHide = document.querySelectorAll(".no-export");

  // Hide buttons
  elementsToHide.forEach(el => el.style.display = "none");

  // 🔥 STEP 1: Replace inputs with text
  const inputs = poster.querySelectorAll("input");
  const inputReplacements = [];

  inputs.forEach(input => {
    const span = document.createElement("span");

    span.innerText = (input.value || "").toUpperCase(); // FORCE UPPERCASE
    span.className = input.className;

    // copy font styles (important)
    const style = window.getComputedStyle(input);
    span.style.fontSize = style.fontSize;
    span.style.fontWeight = style.fontWeight;
    span.style.textAlign = style.textAlign;
    span.style.width = style.width;
    span.style.display = "inline-block";

    inputReplacements.push({
      parent: input.parentNode,
      input: input,
      span: span
    });

    input.parentNode.replaceChild(span, input);
  });

  // 🔥 STEP 2: Capture image
  html2canvas(poster, { scale: 2 }).then(canvas => {
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "ff-standings.png";
    link.click();

    // 🔁 STEP 3: Restore inputs back
    inputReplacements.forEach(item => {
      item.parent.replaceChild(item.input, item.span);
    });

    // Show buttons again
    elementsToHide.forEach(el => el.style.display = "flex");
  });
}



/* ==============================
   RESET STANDINGS
============================== */
function resetStandings() {
  const confirmReset = confirm("Are you sure you want to reset all standings?");
  if (!confirmReset) return;

  localStorage.removeItem(STORAGE_KEY);
  window.location.href = "index.html";
}
