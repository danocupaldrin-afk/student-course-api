const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const API = "/api";  // same origin as the Flask app, so it works locally and on Render
let ok = true, D = {stats: {}, students: [], courses: [], enrollments: [], announcements: []};

async function call(path, opts = {}) {
  const r = await fetch(API + path, {headers: {"Content-Type": "application/json"}, ...opts});
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Request failed");
  return j;
}
function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2600); }
async function load() {
  try {
    const [stats, students, courses, enrollments, announcements] = await Promise.all(
      ["stats","students","courses","enrollments","announcements"].map(p => call("/" + p)));
    D = {stats, students, courses, enrollments, announcements};
    ok = true;
  } catch { ok = false; }
}

const head = (t, s, b = "") => `<div class="head"><div><h1>${t}</h1><p>${s}</p></div>${b}</div>`;
const empty = (a, b) => `<div class="empty"><b>${a}</b>${b}</div>`;
const tbl = (cols, rows, del) => !rows.length ? empty("No records yet", "Add one to see it here.") :
  `<table><tr>${cols.map(c => `<th>${c[0].toUpperCase()}</th>`).join("")}${del ? "<th></th>" : ""}</tr>${rows.map(r =>
  `<tr>${cols.map(c => `<td>${c[2] ? `<span class="pill">${esc(r[c[1]])}</span>` : esc(r[c[1]])}</td>`).join("")}${del ? `<td><button class="btn del" onclick="del('${del}',${r.id})">Delete</button></td>` : ""}</tr>`).join("")}</table>`;
const annList = list => list.map(a => `<div class="ann"><strong>${esc(a.title)}</strong><p>${esc(a.body)}</p><small>${esc(a.author)} · ${esc(a.date)}</small></div>`).join("") || empty("Nothing posted", "");

const enrollCols = [["Student","student"],["Course","course"],["Date","date"],["Status","status",1]];
const pages = {
  dashboard() {
    const s = D.stats;
    const card = (l, n, d) => `<div class="card stat"><span>${l}</span><b>${n ?? 0}</b><small>${d}</small></div>`;
    return head("Dashboard", "Integrated Student Enrollment and Information System", `<button class="btn" onclick="refresh()">Refresh</button>`) +
      (ok ? "" : `<div class="card" style="margin-bottom:18px;color:#b91c1c">The API is not reachable right now. Press Refresh to try again.</div>`) +
      `<div class="stats">${card("Total students", s.students, "Registered student records")}${card("Total courses", s.courses, "Courses in the catalog")}${card("Total enrollments", s.enrollments, "All enrollment records")}${card("Available courses", s.available, "Courses with open slots")}</div>
      <div class="grid"><div class="card"><div class="row-h"><h3>Recent enrollment activity</h3><a class="link" href="#enrollment">View all →</a></div>
        <p class="sub">Latest records returned by GET /api/enrollments</p>
        ${D.enrollments.length ? tbl(enrollCols, D.enrollments.slice(0, 5)) : empty("No enrollment records yet", "Enroll a student in a course and the record will appear here.")}</div>
      <div class="card"><div class="row-h"><h3>Announcements</h3><a class="link" href="#announcements">Manage →</a></div>
        ${annList(D.announcements.slice(0, 1))}<button class="btn pri wide" onclick="form('announcements')">Post announcement</button></div></div>
      <div class="actions"><button class="tile a" onclick="form('students')">Add student <span>＋</span></button><button class="tile b" onclick="form('enrollments')">Quick enroll student <span>＋</span></button></div>`;
  },
  students() {
    return head("Students", "Registered student records", `<button class="btn pri" onclick="form('students')">Add student</button>`) +
      `<div class="card">${tbl([["ID","id"],["Name","name"],["Email","email"],["Program","program"],["Year","year"]], D.students, "students")}</div>`;
  },
  courses() {
    const rows = D.courses.map(c => ({...c, slots: `${c.enrolled}/${c.capacity}`}));
    return head("Courses", "Courses in the catalog", `<button class="btn pri" onclick="form('courses')">Add course</button>`) +
      `<div class="card">${tbl([["Code","code"],["Title","title"],["Instructor","instructor"],["Units","units"],["Enrolled","slots"]], rows, "courses")}</div>`;
  },
  enrollment() {
    return head("Enrollment", "All enrollment records", `<button class="btn pri" onclick="form('enrollments')">Enroll student</button>`) +
      `<div class="card">${tbl(enrollCols, D.enrollments, "enrollments")}</div>`;
  },
  announcements() {
    return head("Announcements", "News for the campus", `<button class="btn pri" onclick="form('announcements')">Post announcement</button>`) +
      `<div class="card">${annList(D.announcements)}</div>`;
  }
};

async function render() {
  const p = (location.hash || "#dashboard").slice(1);
  document.querySelectorAll("nav a").forEach(a => a.classList.toggle("active", a.dataset.page === p));
  $("#view").innerHTML = (pages[p] || pages.dashboard)();
}
async function refresh() { await load(); render(); }

const F = {
  students: [["name","Full name"],["email","Email"],["program","Program"],["year","Year","number"]],
  courses: [["code","Course code"],["title","Title"],["instructor","Instructor"],["units","Units","number"],["capacity","Capacity","number"]],
  announcements: [["title","Title"],["body","Message"]],
};
function form(t) {
  let f;
  if (t === "enrollments") {
    if (!D.students.length) return toast("Add a student first.");
    f = `<label>Student</label><select name="student_id">${D.students.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select>
         <label>Course</label><select name="course_id">${D.courses.map(c => `<option value="${c.id}">${esc(c.code)} – ${esc(c.title)}</option>`).join("")}</select>`;
  } else f = F[t].map(([n,l,ty]) => `<label>${l}</label><input name="${n}" type="${ty||"text"}" required>`).join("");
  const title = {students:"Add student",courses:"Add course",enrollments:"Enroll student",announcements:"Post announcement"}[t];
  $("#modalBox").innerHTML = `<h3>${title}</h3>${f}<div class="r"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn pri" onclick="save('${t}')">Save</button></div>`;
  $("#modal").classList.add("open");
}
const closeModal = () => $("#modal").classList.remove("open");
async function save(t) {
  const data = {};
  $("#modalBox").querySelectorAll("[name]").forEach(e => data[e.name] = e.value);
  try { await call("/" + t, {method: "POST", body: JSON.stringify(data)}); closeModal(); toast("Saved"); refresh(); }
  catch (e) { toast(e.message); }
}
async function del(t, id) {
  if (!confirm("Delete this record?")) return;
  await call(`/${t}/${id}`, {method: "DELETE"}); refresh();
}
$("#modal").addEventListener("click", e => { if (e.target.id === "modal") closeModal(); });
window.addEventListener("hashchange", render);
refresh();
