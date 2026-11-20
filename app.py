import os, sqlite3
from datetime import date
from flask import Flask, jsonify, request, render_template, g
from flask_cors import CORS

app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)
DB = os.path.join(os.path.dirname(__file__), "campus.db")

TABLES = {
    "students": ["name", "email", "program", "year"],
    "courses": ["code", "title", "instructor", "units"],
    "enrollments": ["student_id", "course_id", "date"],
    "announcements": ["title", "body", "date"],
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
    CREATE TABLE IF NOT EXISTS courses(id INTEGER PRIMARY KEY, code TEXT, title TEXT, instructor TEXT, units INTEGER);
    CREATE TABLE IF NOT EXISTS enrollments(id INTEGER PRIMARY KEY, student_id INTEGER, course_id INTEGER, date TEXT);
    CREATE TABLE IF NOT EXISTS announcements(id INTEGER PRIMARY KEY, title TEXT, body TEXT, date TEXT);
    """)
    if not c.execute("SELECT 1 FROM students").fetchone():
        c.executemany("INSERT INTO students(name,email,program,year) VALUES(?,?,?,?)", [
            ("Aldrin Dañocup", "danocupaldrin@example.com", "BS Information Technology", 3),
            ("Maria Santos", "maria.santos@example.com", "BS Computer Science", 2)])
        c.executemany("INSERT INTO courses(code,title,instructor,units) VALUES(?,?,?,?)", [
            ("IT101", "Intro to Programming", "Prof. Reyes", 3),
            ("IT202", "Web Development", "Prof. Cruz", 3)])
        c.execute("INSERT INTO enrollments(student_id,course_id,date) VALUES(1,2,?)", (str(date.today()),))
        c.execute("INSERT INTO announcements(title,body,date) VALUES(?,?,?)",
                  ("Welcome to Campus Connect", "Enrollment for next term is now open.", str(date.today())))
    c.commit(); c.close()

@app.route("/")
def index():
    return render_template("index.html")

@app.get("/api")
@app.get("/api/health")
def health():
    return jsonify(status="ok", service="Campus Connect API")

@app.get("/api/stats")
def stats():
    return jsonify({t: db().execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in TABLES})

@app.get("/api/<table>")
def list_rows(table):
    if table not in TABLES: return jsonify(error="not found"), 404
    if table == "enrollments":
        rows = db().execute("""SELECT e.id, e.date, e.student_id, e.course_id, s.name AS student, c.code, c.title AS course
            FROM enrollments e JOIN students s ON s.id=e.student_id JOIN courses c ON c.id=e.course_id ORDER BY e.id DESC""")
    else:
        rows = db().execute(f"SELECT * FROM {table} ORDER BY id DESC")
    return jsonify([dict(r) for r in rows])

@app.post("/api/<table>")
def add_row(table):
    if table not in TABLES: return jsonify(error="not found"), 404
    data = request.get_json(force=True)
    cols = TABLES[table]
    if table in ("enrollments", "announcements") and not data.get("date"):
        data["date"] = str(date.today())
    cur = db().execute(f"INSERT INTO {table}({','.join(cols)}) VALUES({','.join('?'*len(cols))})",
                       [data.get(c) for c in cols])
    db().commit()
    return jsonify(id=cur.lastrowid), 201

@app.delete("/api/<table>/<int:rid>")
def del_row(table, rid):
    if table not in TABLES: return jsonify(error="not found"), 404
    db().execute(f"DELETE FROM {table} WHERE id=?", (rid,)); db().commit()
    return jsonify(deleted=rid)

init()
if __name__ == "__main__":
    print("API serving on port 5000")
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
