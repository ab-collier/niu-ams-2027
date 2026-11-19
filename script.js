const DATA_URL = "data/presentations.csv";
let presentations = [];

const list = document.getElementById("presentationList");
const searchInput = document.getElementById("search");
const dateFilter = document.getElementById("dateFilter");
const formatFilter = document.getElementById("formatFilter");
const resultCount = document.getElementById("resultCount");
const emptyState = document.getElementById("emptyState");

function parseDate(value) {
  const parts = value.trim().split("/");
  if (parts.length !== 3) return new Date(value);
  return new Date(Number(parts[2]), Number(parts[0]) - 1, Number(parts[1]));
}
function dateKey(value) {
  const d = parseDate(value);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function parseTimeMinutes(value) {
  const match = String(value || "").match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const period = match[3].toUpperCase();
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}
function prettyDate(value, options = { weekday:"long", month:"long", day:"numeric", year:"numeric" }) {
  return parseDate(value).toLocaleDateString("en-US", options);
}
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[ch]);
}
function populateDates() {
  const unique = [...new Map(presentations.map(p => [dateKey(p.date), p.date])).entries()]
    .sort((a,b) => a[0].localeCompare(b[0]));
  unique.forEach(([key, raw]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = prettyDate(raw, {month:"long", day:"numeric"});
    dateFilter.appendChild(option);
  });
}
function render() {
  const term = searchInput.value.trim().toLowerCase();
  const chosenDate = dateFilter.value;
  const chosenFormat = formatFilter.value;
  const filtered = presentations.filter(p => {
    const haystack = [p.title,p.presenter,p.role,p.location,p.format].join(" ").toLowerCase();
    return (!term || haystack.includes(term))
      && (!chosenDate || dateKey(p.date) === chosenDate)
      && (!chosenFormat || p.format.toLowerCase() === chosenFormat.toLowerCase());
  });
  filtered.sort((a,b) => dateKey(a.date).localeCompare(dateKey(b.date))
    || parseTimeMinutes(a.time_mst) - parseTimeMinutes(b.time_mst)
    || a.title.localeCompare(b.title));
  resultCount.textContent = `${filtered.length} ${filtered.length === 1 ? "presentation" : "presentations"} found`;
  list.innerHTML = filtered.map(p => {
    const isPoster = p.format.toLowerCase() === "poster";
    const roleMarkup = p.role ? ` <span class="role">• ${escapeHTML(p.role)}</span>` : "";
    const safeLink = /^https?:\/\//i.test(p.confexLink) ? p.confexLink : "";
    const hasDropdown = p.abstract || safeLink;
    const dropdownMarkup = hasDropdown ? `
      <details class="card-dropdown">
        <summary>Abstract &amp; Confex Link</summary>
        <div class="card-dropdown-body">
          ${p.abstract ? `<p class="abstract">${escapeHTML(p.abstract)}</p>` : ""}
          ${safeLink ? `<a class="confex-link" href="${escapeHTML(safeLink)}" target="_blank" rel="noopener noreferrer">View on AMS Confex ↗</a>` : ""}
        </div>
      </details>` : "";
    return `<div class="card-item">
      <article class="card">
        <div class="when">
          <div class="day">${escapeHTML(prettyDate(p.date, {weekday:"long"}))}</div>
          <div class="date">${escapeHTML(prettyDate(p.date, {month:"short", day:"numeric"}))}</div>
          <div class="time">${escapeHTML(p.time_mst)} MST</div>
        </div>
        <div class="details">
          <div class="tags"><span class="tag ${isPoster ? "poster" : ""}">${escapeHTML(p.format)}</span></div>
          <h2 class="title">${escapeHTML(p.title)}</h2>
          <p class="presenter">${escapeHTML(p.presenter)}${roleMarkup}</p>
          <p class="location">${escapeHTML(p.location || "Location TBD")}</p>
        </div>
      </article>${dropdownMarkup}
    </div>`;
  }).join("");
  emptyState.hidden = filtered.length !== 0;
}
async function loadSchedule() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`Could not load schedule (${response.status})`);
    const buffer = await response.arrayBuffer();
    let csvText;
    try {
      csvText = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      csvText = new TextDecoder("windows-1252").decode(buffer);
    }
    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.trim().toLowerCase()
    });
    if (parsed.errors.length) console.warn("CSV parsing warnings:", parsed.errors);
    presentations = parsed.data.map(row => ({
      date: (row.date || "").trim(),
      time_mst: (row.time_mst || "").trim(),
      title: (row.title || "").trim(),
      presenter: (row.presenter || "").trim(),
      role: (row.role || "").trim(),
      format: (row.format || "").trim(),
      location: (row.location || "").trim(),
      confexLink: (row["confex link"] || row.confex_link || "").trim(),
      abstract: (row.abstract || "").trim()
    })).filter(p => p.title && p.date);
    populateDates();
    render();
  } catch (error) {
    list.innerHTML = `<p class="empty-state">The schedule could not be loaded. Make sure <code>data/presentations.csv</code> is in the repository and that the site is being viewed through GitHub Pages.</p>`;
    resultCount.textContent = "Schedule unavailable";
    console.error(error);
  }
}
searchInput.addEventListener("input", render);
dateFilter.addEventListener("change", render);
formatFilter.addEventListener("change", render);
document.getElementById("clearFilters").addEventListener("click", () => {
  searchInput.value = "";
  dateFilter.value = "";
  formatFilter.value = "";
  render();
});
loadSchedule();
