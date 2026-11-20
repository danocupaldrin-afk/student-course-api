const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const TODAY = new Date().toLocaleDateString("en-US", {weekday:"long", year:"numeric", month:"long", day:"numeric"});
const DEFAULT_API = location.protocol.startsWith("http") && location.port === "5000" ? location.origin + "/api" : "http://127.0.0.1:5000/api";
let API = localStorage.getItem("cc_api") || DEFAULT_API;
let online = false, cache = {}, query = "";

async function call(path, opts = {}) {
  const r = await fetch(API + path, {headers: {"Content-Type": "application/json"}, ...opts});
  if (!r.ok) throw new Error(r.status);
  return r.json();
}
async function test() {
  try { await call("/health"); online = true; } catch { online = false; }
  $("#status").className = "status " + (online ? "online" : "offline");
  $("#status span").textContent = online ? "API online" : "API offline";
  return online;
}
async function load() {
  if (!online) return;
  for (const t of ["students","courses","enrollments","announcements"]) cache[t] = await call("/" + t);
}

const head = (title, sub, btn = "") => `<div class="page-head"><div><h2>${title}</h2><p>${sub}</p></div>${btn}</div>`;
const table = (cols, rows, del) => rows.length ? `<div class="card"><table><tr>${cols.map(c => `<th>${c[0]}</th>`).join("")}${del?"<th></th>":""}</tr>
  ${rows.map(r => `<tr>${cols.map(c => `<td>${esc(r[c[1]])}</td>`).join("")}${del?`<td><button class="btn danger" onclick="remove('${del}',${r.id})">Delete</button></td>`:""}</tr>`).join("")}</table></div>`
  : `<div class="card empty">No records yet.</div>`;

function offline() {
  return `<div class="card offline-card"><div class="ico">⌁</div><div>
    <h3>The Flask API is not reachable</h3>
    <p>Every record in this portal comes from SQLite through the REST API, so nothing is stored in the browser. Start the Python backend and test the connection again.</p>
    <code class="url">${esc(API)}</code>
    <ol><li>1. Run <code>run.bat</code> on Windows, or <code>python app.py</code> inside the Campus-Connect backend folder.</li>
    <li>2. Wait until the terminal shows the API serving on port 5000.</li>
    <li>3. Already deployed? Paste your live API URL in API settings.</li></ol>
    <div class="actions"><button class="btn primary" onclick="retest()">⟳ Test connection</button>
    <button class="btn ghost" onclick="go('settings')">⚙ API settings</button>
    <button class="btn ghost" onclick="go('backend')">🖥 Backend setup</button></div></div></div>`;
}

const pages = {
  dashboard() {
    const h = head("Dashboard", `Live counts from the Flask API and SQLite database. ${TODAY}`, `<button class="btn deep" onclick="form('enrollments')">＋ New enrollment</button>`);
    if (!online) return h + offline();
    const s = ["students","courses","enrollments","announcements"].map(t => `<div class="card stat"><div class="n">${cache[t].length}</div><div class="l" style="text-transform:capitalize">${t}</div></div>`).join("");
    return h + `<div class="stats">${s}</div><h3 style="margin-bottom:12px">Recent enrollments</h3>` + table([["Student","student"],["Course","course"],["Date","date"]], cache.enrollments.slice(0,5));
  },
  students() {
    if (!online) return head("Students","Manage student records") + offline();
    const q = query.toLowerCase();
    const rows = cache.students.filter(s => !q || [s.id, s.name, s.email].join(" ").toLowerCase().includes(q));
    return head("Students","Search by name, ID, or email", `<button class="btn deep" onclick="form('students')">＋ Add student</button>`) +
      table([["ID","id"],["Name","name"],["Email","email"],["Program","program"],["Year","year"]], rows, "students");
  },
  courses() {
    if (!online) return head("Courses","Manage course offerings") + offline();
    return head("Courses","Available course offerings", `<button class="btn deep" onclick="form('courses')">＋ Add course</button>`) +
      table([["Code","code"],["Title","title"],["Instructor","instructor"],["Units","units"]], cache.courses, "courses");
  },
  enrollments() {
    if (!online) return head("Enrollments","Student course enrollments") + offline();
    return head("Enrollments","Student course enrollments", `<button class="btn deep" onclick="form('enrollments')">＋ New enrollment</button>`) +
      table([["Student","student"],["Code","code"],["Course","course"],["Date","date"]], cache.enrollments, "enrollments");
  },
  announcements() {
    if (!online) return head("Announcements","Campus news") + offline();
    return head("Announcements","Campus news and updates", `<button class="btn deep" onclick="form('announcements')">＋ Post</button>`) +
      `<div class="card">${cache.announcements.map(a => `<div class="ann"><h4>${esc(a.title)} <button class="btn danger" onclick="remove('announcements',${a.id})">Delete</button></h4><small>${esc(a.date)}</small><p>${esc(a.body)}</p></div>`).join("") || '<div class="empty">No announcements.</div>'}</div>`;
  },
  profile() {
    const n = localStorage.getItem("cc_name") || "Aldrin Dañocup";
    return head("My Profile","Your account details") + `<div class="card" style="max-width:480px"><label>Display name</label><input id="pname" value="${esc(n)}"><div class="row" style="margin-top:18px"><button class="btn primary" onclick="saveName()">Save</button></div></div>`;
  },
  settings() {
    return head("API Settings","Point the portal at your Flask backend") + `<div class="card" style="max-width:560px"><label>API base URL</label><input id="api" value="${esc(API)}"><div class="actions"><button class="btn primary" onclick="saveApi()">Save &amp; test</button></div></div>`;
  },
  backend() {
    return head("Backend & Deployment","Run locally or deploy to Render") + `<div class="card"><p style="line-height:2"><b>Local:</b> <code>pip install -r requirements.txt</code> then <code>python app.py</code><br><b>Render:</b> Build <code>pip install -r requirements.txt</code> · Start <code>gunicorn app:app</code><br>Then paste the Render URL + <code>/api</code> into API Settings.</p></div>`;
  }
};

async function go(p) { location.hash = p; }
async function render() {
  const p = (location.hash || "#dashboard").slice(1);
  document.querySelectorAll("nav a").forEach(a => a.classList.toggle("active", a.dataset.page === p));
  if (online) await load().catch(() => {});
  $("#view").innerHTML = (pages[p] || pages.dashboard)();
}
async function retest() { await test(); await render(); }
async function saveApi() { API = $("#api").value.replace(/\/$/, ""); localStorage.setItem("cc_api", API); await retest(); }
function saveName() { const n = $("#pname").value; localStorage.setItem("cc_name", n); applyName(); }
function applyName() { const n = localStorage.getItem("cc_name") || "Aldrin Dañocup"; $("#sideName").textContent = $("#topName").textContent = n; }

const FIELDS = {
  students: [["name","Full name"],["email","Email"],["program","Program"],["year","Year","number"]],
  courses: [["code","Course code"],["title","Title"],["instructor","Instructor"],["units","Units","number"]],
  announcements: [["title","Title"],["body","Message"]],
};
function form(t) {
  if (!online) return alert("Start the API first.");
  let f;
  if (t === "enrollments") f = `<label>Student</label><select name="student_id">${cache.students.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select>
    <label>Course</label><select name="course_id">${cache.courses.map(c => `<option value="${c.id}">${esc(c.code)} – ${esc(c.title)}</option>`).join("")}</select>`;
  else f = FIELDS[t].map(([n,l,ty]) => `<label>${l}</label><input name="${n}" type="${ty||"text"}" required>`).join("");
  $("#modalBox").innerHTML = `<h3>Add ${t.replace(/s$/,"")}</h3>${f}<div class="row"><button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="submitForm('${t}')">Save</button></div>`;
  $("#modal").classList.add("open");
}
function closeModal() { $("#modal").classList.remove("open"); }
async function submitForm(t) {
  const data = {};
  $("#modalBox").querySelectorAll("[name]").forEach(e => data[e.name] = e.value);
  await call("/" + t, {method: "POST", body: JSON.stringify(data)});
  closeModal(); render();
}
async function remove(t, id) {
  if (!confirm("Delete this record?")) return;
  await call(`/${t}/${id}`, {method: "DELETE"}); render();
}

$("#search").addEventListener("input", e => { query = e.target.value; if (query && location.hash !== "#students") go("students"); else render(); });
$("#modal").addEventListener("click", e => { if (e.target.id === "modal") closeModal(); });
window.addEventListener("hashchange", render);
applyName();
test().then(render);
