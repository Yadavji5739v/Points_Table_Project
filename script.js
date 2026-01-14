function proceed() {
  const fileInput = document.getElementById("logFile");
  if (!fileInput.files.length) {
    alert("Please upload a log file");
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    localStorage.setItem("ff_log", e.target.result);
    window.location.href = "standings.html";
  };
  reader.readAsText(fileInput.files[0]);
}

document.addEventListener("DOMContentLoaded", () => {
  const logData = localStorage.getItem("ff_log");
  if (!logData) return;

  parseLog(logData);
});

function parseLog(text) {
  const lines = text.split("\n");
  let teams = [];

  lines.forEach(line => {
    if (!line.startsWith("TeamName:")) return;

    teams.push({
      name: line.match(/TeamName:\s(.+?)\sRank:/)[1],
      kills: +line.match(/KillScore:\s(\d+)/)[1],
      pos: +line.match(/RankScore:\s(\d+)/)[1],
      total: +line.match(/TotalScore:\s(\d+)/)[1],
      games: 1
    });
  });

  teams.sort((a, b) => b.total - a.total);
  renderTable(teams.slice(0, 12));
}

function renderTable(teams) {
  const table = document.getElementById("tableBody");
  table.innerHTML = "";

  teams.forEach((t, i) => {
    table.innerHTML += `
      <div class="row">
        <div class="rank">${i + 1}</div>
        <div class="team">${t.name}</div>
        <div class="cell">-</div>
        <div class="cell">${t.games}</div>
        <div class="cell">${t.pos}</div>
        <div class="cell">${t.kills}</div>
        <div class="cell">${t.total}</div>
      </div>
    `;
  });

  // Add download button functionality
  const downloadBtn = document.getElementById("downloadBtn");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", downloadImage);
  }
}

function downloadImage() {
  const poster = document.querySelector(".poster");
  html2canvas(poster).then(canvas => {
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "standings.png";
    link.click();
  });
}
