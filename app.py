import os, sqlite3
from datetime import date
from flask import Flask, jsonify, request, render_template, g
from flask_cors import CORS

app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)
DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "campus_v2.db")

COLS = {
    "students": ["name", "email", "program", "year"],
    "courses": ["code", "title", "instructor", "units", "capacity"],
    "enrollments": ["student_id", "course_id", "date", "status"],
    "announcements": ["title", "body", "author", "date"],
}

def db():
    if "db" not in g:
        g.db = sqlite3.connect(DB)
        g.db.row_factory = sqlite3.Row
    return g.db

@app.teardown_appcontext
def close(_):
    d = g.pop("db", None)
    if d: d.close()

def init():
    c = sqlite3.connect(DB)
    c.executescript("""
    CREATE TABLE IF NOT EXISTS students(id INTEGER PRIMARY KEY, name TEXT, email TEXT, program TEXT, year INTEGER);
    CREATE TABLE IF NOT EXISTS courses(id INTEGER PRIMARY KEY, code TEXT, title TEXT, instructor TEXT, units INTEGER, capacity INTEGER);
    CREATE TABLE IF NOT EXISTS enrollments(id INTEGER PRIMARY KEY, student_id INTEGER, course_id INTEGER, date TEXT, status TEXT);
    CREATE TABLE IF NOT EXISTS announcements(id INTEGER PRIMARY KEY, title TEXT, body TEXT, author TEXT, date TEXT);
    """)
    if not c.execute("SELECT 1 FROM courses").fetchone():
        c.executemany("INSERT INTO courses(code,title,instructor,units,capacity) VALUES(?,?,?,?,?)", [
            ("IT101", "Introduction to Programming", "Prof. Reyes", 3, 40),
            ("IT202", "Web Development", "Prof. Cruz", 3, 35),
            ("IT303", "Database Systems", "Prof. Santos", 3, 30)])
        c.execute("INSERT INTO announcements(title,body,author,date) VALUES(?,?,?,?)",
                  ("Welcome to Campus Connect", "Enrollment for the new term is now open.", "Administrator", str(date.today())))
    c.commit(); c.close()

@app.route("/")
def index():
    return render_template("index.html")

@app.get("/api")
@app.get("/api/health")
def health():
    return jsonify(status="ok")

@app.get("/api/stats")
def stats():
    d = db()
    n = lambda q: d.execute(q).fetchone()[0]
    return jsonify(students=n("SELECT COUNT(*) FROM students"), courses=n("SELECT COUNT(*) FROM courses"),
        enrollments=n("SELECT COUNT(*) FROM enrollments"),
        available=n("""SELECT COUNT(*) FROM courses c WHERE c.capacity >
            (SELECT COUNT(*) FROM enrollments e WHERE e.course_id=c.id)"""))

@app.get("/api/<table>")
def list_rows(table):
    if table not in COLS: return jsonify(error="not found"), 404
    q = {
      "enrollments": """SELECT e.id,e.date,e.status,s.name AS student,c.code,c.title AS course FROM enrollments e
          JOIN students s ON s.id=e.student_id JOIN courses c ON c.id=e.course_id ORDER BY e.id DESC""",
      "courses": """SELECT c.*, (SELECT COUNT(*) FROM enrollments e WHERE e.course_id=c.id) AS enrolled FROM courses c ORDER BY c.id""",
    }.get(table, f"SELECT * FROM {table} ORDER BY id DESC")
    return jsonify([dict(r) for r in db().execute(q)])

@app.post("/api/<table>")
def add_row(table):
    if table not in COLS: return jsonify(error="not found"), 404
    data = request.get_json(force=True)
    data.setdefault("date", str(date.today()))
    if table == "enrollments":
        data["status"] = "Enrolled"
        sid, cid = data.get("student_id"), data.get("course_id")
        if db().execute("SELECT 1 FROM enrollments WHERE student_id=? AND course_id=?", (sid, cid)).fetchone():
            return jsonify(error="Student is already enrolled in this course."), 409
        c = db().execute("SELECT capacity,(SELECT COUNT(*) FROM enrollments WHERE course_id=?) n FROM courses WHERE id=?", (cid, cid)).fetchone()
        if not c or c["n"] >= c["capacity"]:
            return jsonify(error="This course has no open slots."), 409
    if table == "announcements": data.setdefault("author", "Administrator")
    if table == "courses": data.setdefault("capacity", 30)
    cols = COLS[table]
    cur = db().execute(f"INSERT INTO {table}({','.join(cols)}) VALUES({','.join('?'*len(cols))})", [data.get(c) for c in cols])
    db().commit()
    return jsonify(id=cur.lastrowid), 201

@app.delete("/api/<table>/<int:rid>")
def del_row(table, rid):
    if table not in COLS: return jsonify(error="not found"), 404
    if table in ("students", "courses"):
        db().execute(f"DELETE FROM enrollments WHERE {table[:-1]}_id=?", (rid,))
    db().execute(f"DELETE FROM {table} WHERE id=?", (rid,)); db().commit()
    return jsonify(deleted=rid)

init()
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
