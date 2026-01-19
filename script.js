const STORAGE_KEY = "ff_teams_data";

/* ==============================
   UPLOAD PAGE (index.html)
============================== */
function proceed() {
  const fileInput = document.getElementById("logFile");

  if (!fileInput || !fileInput.files.length) {
    alert("Please upload a log file");
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    processLogAndStore(e.target.result);
    window.location.href = "standings.html";
  };

  reader.readAsText(fileInput.files[0]);
}

/* ==============================
   PROCESS LOG + MERGE DATA
============================== */
function processLogAndStore(text) {
  const lines = text.split("\n");
  let teamsData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};

  lines.forEach(line => {
    if (!line.startsWith("TeamName:")) return;

    const name = line.match(/TeamName:\s(.+?)\sRank:/)[1].trim();
    const kills = +line.match(/KillScore:\s(\d+)/)[1];
    const pos = +line.match(/RankScore:\s(\d+)/)[1];
    const total = +line.match(/TotalScore:\s(\d+)/)[1];

    if (!teamsData[name]) {
      teamsData[name] = {
        name,
        booyah: 0,   // ✅ default booyah
        games: 0,
        kills: 0,
        pos: 0,
        total: 0
      };
    }

    teamsData[name].games += 1;
    teamsData[name].kills += kills;
    teamsData[name].pos += pos;
    teamsData[name].total += total;
  });

  localStorage.setItem(STORAGE_KEY, JSON.stringify(teamsData));
}

/* ==============================
   STANDINGS PAGE
============================== */
document.addEventListener("DOMContentLoaded", () => {
  const table = document.getElementById("tableBody");

  // Not on standings page
  if (!table) return;

  const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (!data) return;

  const teams = Object.values(data);

  // Sort by TOTAL points
teams.sort((a, b) => {
  // 1️⃣ Total points
  if (b.total !== a.total) {
    return b.total - a.total;
  }

  // 2️⃣ Elims / Kills
  if (b.kills !== a.kills) {
    return b.kills - a.kills;
  }

  // 3️⃣ (Optional) Alphabetical order
  return a.name.localeCompare(b.name);
});


  table.innerHTML = "";

  teams.slice(0, 12).forEach((t, i) => {
    table.innerHTML += `
      <div class="row">
        <div class="rank">${i + 1}</div>
        <div class="team">${t.name}</div>

        <!-- BOOYAH INPUT -->
        <div class="cell">
          <input 
            type="number" 
            min="0" 
            value="${t.booyah || 0}"
            class="booyah-input"
            data-team="${t.name}"
          />
        </div>

        <div class="cell">${t.games}</div>
        <div class="cell">${t.pos}</div>
        <div class="cell">${t.kills}</div>
        <div class="cell">${t.total}</div>
      </div>
    `;
  });

  /* ==============================
     🔥 BOOYAH INPUT HANDLER (NEW)
  ============================== */
  document.querySelectorAll(".booyah-input").forEach(input => {
    input.addEventListener("input", e => {
      const teamName = e.target.dataset.team;
      const value = parseInt(e.target.value) || 0;

      let storedData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
      if (storedData[teamName]) {
        storedData[teamName].booyah = value;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(storedData));
      }
    });
  });

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

  html2canvas(poster).then(canvas => {
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "ff-standings.png";
    link.click();

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
