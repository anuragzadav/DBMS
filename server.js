import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./db.js";

dotenv.config();
const app = express();
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://172.18.135.209:5173",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  }),
);
app.use(express.json({ limit: "100kb" }));

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const identifier = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const validId = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

app.get(
  "/api/health",
  asyncHandler(async (_req, res) => {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: process.env.DB_NAME || "college_db" });
  }),
);

app.get(
  "/api/dashboard",
  asyncHandler(async (_req, res) => {
    const [[students]] = await pool.query(
      "SELECT COUNT(*) AS total FROM students",
    );
    const [[courses]] = await pool.query(
      "SELECT COUNT(*) AS total FROM courses",
    );
    const [[enrollments]] = await pool.query(
      "SELECT COUNT(*) AS total FROM enrollments",
    );
    const [recent] = await pool.query(
      "SELECT id, name, email, department FROM students ORDER BY id DESC LIMIT 5",
    );
    res.json({
      students: students.total,
      courses: courses.total,
      enrollments: enrollments.total,
      recent,
    });
  }),
);

// Students CRUD
app.get(
  "/api/students",
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query("SELECT * FROM students ORDER BY id DESC");
    res.json(rows);
  }),
);
app.post(
  "/api/students",
  asyncHandler(async (req, res) => {
    const { name, email, phone = "", department } = req.body;
    if (!name?.trim() || !email?.trim() || !department?.trim())
      return res
        .status(400)
        .json({ message: "Name, email and department are required." });
    const [result] = await pool.execute(
      "INSERT INTO students (name,email,phone,department) VALUES (?,?,?,?)",
      [name.trim(), email.trim(), phone.trim(), department.trim()],
    );
    res
      .status(201)
      .json({ id: result.insertId, message: "Student added successfully." });
  }),
);
app.put(
  "/api/students/:id",
  asyncHandler(async (req, res) => {
    const { name, email, phone = "", department } = req.body;
    if (
      !validId(req.params.id) ||
      !name?.trim() ||
      !email?.trim() ||
      !department?.trim()
    )
      return res
        .status(400)
        .json({
          message: "Valid ID, name, email and department are required.",
        });
    const [result] = await pool.execute(
      "UPDATE students SET name=?, email=?, phone=?, department=? WHERE id=?",
      [
        name.trim(),
        email.trim(),
        phone.trim(),
        department.trim(),
        Number(req.params.id),
      ],
    );
    if (!result.affectedRows)
      return res.status(404).json({ message: "Student not found." });
    res.json({ message: "Student updated successfully." });
  }),
);
app.delete(
  "/api/students/:id",
  asyncHandler(async (req, res) => {
    if (!validId(req.params.id))
      return res.status(400).json({ message: "Invalid student ID." });
    const [result] = await pool.execute("DELETE FROM students WHERE id=?", [
      Number(req.params.id),
    ]);
    if (!result.affectedRows)
      return res.status(404).json({ message: "Student not found." });
    res.json({ message: "Student deleted successfully." });
  }),
);

// Courses CRUD
app.get(
  "/api/courses",
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query("SELECT * FROM courses ORDER BY id DESC");
    res.json(rows);
  }),
);
app.post(
  "/api/courses",
  asyncHandler(async (req, res) => {
    const { course_name, course_code, credits = 3 } = req.body;
    if (
      !course_name?.trim() ||
      !course_code?.trim() ||
      !Number.isInteger(Number(credits)) ||
      Number(credits) < 1 ||
      Number(credits) > 10
    )
      return res
        .status(400)
        .json({ message: "Enter course name, code and credits (1–10)." });
    const [result] = await pool.execute(
      "INSERT INTO courses (course_name,course_code,credits) VALUES (?,?,?)",
      [course_name.trim(), course_code.trim().toUpperCase(), Number(credits)],
    );
    res
      .status(201)
      .json({ id: result.insertId, message: "Course added successfully." });
  }),
);
app.put(
  "/api/courses/:id",
  asyncHandler(async (req, res) => {
    const { course_name, course_code, credits } = req.body;
    if (
      !validId(req.params.id) ||
      !course_name?.trim() ||
      !course_code?.trim() ||
      !Number.isInteger(Number(credits)) ||
      Number(credits) < 1 ||
      Number(credits) > 10
    )
      return res.status(400).json({ message: "Enter valid course details." });
    const [result] = await pool.execute(
      "UPDATE courses SET course_name=?, course_code=?, credits=? WHERE id=?",
      [
        course_name.trim(),
        course_code.trim().toUpperCase(),
        Number(credits),
        Number(req.params.id),
      ],
    );
    if (!result.affectedRows)
      return res.status(404).json({ message: "Course not found." });
    res.json({ message: "Course updated successfully." });
  }),
);
app.delete(
  "/api/courses/:id",
  asyncHandler(async (req, res) => {
    if (!validId(req.params.id))
      return res.status(400).json({ message: "Invalid course ID." });
    const [result] = await pool.execute("DELETE FROM courses WHERE id=?", [
      Number(req.params.id),
    ]);
    if (!result.affectedRows)
      return res.status(404).json({ message: "Course not found." });
    res.json({ message: "Course deleted successfully." });
  }),
);

// Enrollments and JOIN
app.get(
  "/api/enrollments",
  asyncHandler(async (_req, res) => {
    const [rows] =
      await pool.query(`SELECT e.id, e.enrolled_on, s.name AS student_name, c.course_name, c.course_code
    FROM enrollments e JOIN students s ON e.student_id=s.id JOIN courses c ON e.course_id=c.id ORDER BY e.id DESC`);
    res.json(rows);
  }),
);
app.post(
  "/api/enrollments",
  asyncHandler(async (req, res) => {
    const { student_id, course_id, enrolled_on } = req.body;
    if (!validId(student_id) || !validId(course_id) || !enrolled_on)
      return res
        .status(400)
        .json({ message: "Choose a student, course and date." });
    const [result] = await pool.execute(
      "INSERT INTO enrollments (student_id,course_id,enrolled_on) VALUES (?,?,?)",
      [Number(student_id), Number(course_id), enrolled_on],
    );
    res
      .status(201)
      .json({ id: result.insertId, message: "Enrollment created." });
  }),
);
app.delete(
  "/api/enrollments/:id",
  asyncHandler(async (req, res) => {
    if (!validId(req.params.id))
      return res.status(400).json({ message: "Invalid enrollment ID." });
    const [result] = await pool.execute("DELETE FROM enrollments WHERE id=?", [
      Number(req.params.id),
    ]);
    if (!result.affectedRows)
      return res.status(404).json({ message: "Enrollment not found." });
    res.json({ message: "Enrollment deleted." });
  }),
);

// Query console: read-only SELECT statements only.
app.post(
  "/api/query",
  asyncHandler(async (req, res) => {
    const sql = String(req.body.sql || "").trim();
    if (!sql || sql.length > 2000)
      return res
        .status(400)
        .json({ message: "Enter a query up to 2000 characters." });
    const normalized = sql.replace(/;+\s*$/, "").trim();
    if (
      !/^SELECT\b/i.test(normalized) ||
      /;/.test(normalized) ||
      /--|\/\*|\*\/|#/.test(normalized) ||
      /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|CALL|INTO|OUTFILE|DUMPFILE)\b/i.test(
        normalized,
      )
    ) {
      return res
        .status(400)
        .json({
          message:
            "Only one read-only SELECT query is allowed here. Use dedicated sections for other operations.",
        });
    }
    const [rows, fields] = await pool.query(normalized);
    res.json({
      rows,
      columns: fields.map((f) => f.name),
      rowCount: rows.length,
    });
  }),
);

// DDL: table creation, adding a column and dropping a table in configured database.
app.post(
  "/api/ddl/create-table",
  asyncHandler(async (req, res) => {
    const { tableName, columnName, dataType } = req.body;
    const allowedTypes = [
      "VARCHAR(100)",
      "INT",
      "DATE",
      "TEXT",
      "DECIMAL(10,2)",
    ];
    if (
      !identifier.test(tableName || "") ||
      !identifier.test(columnName || "") ||
      !allowedTypes.includes(dataType)
    )
      return res
        .status(400)
        .json({
          message: "Invalid table/column name or unsupported data type.",
        });
    await pool.query(
      `CREATE TABLE \`${tableName}\` (\`id\` INT AUTO_INCREMENT PRIMARY KEY, \`${columnName}\` ${dataType})`,
    );
    res.json({ message: `Table ${tableName} created successfully.` });
  }),
);
app.post(
  "/api/ddl/add-column",
  asyncHandler(async (req, res) => {
    const { tableName, columnName, dataType } = req.body;
    const allowedTypes = [
      "VARCHAR(100)",
      "INT",
      "DATE",
      "TEXT",
      "DECIMAL(10,2)",
    ];
    if (
      !identifier.test(tableName || "") ||
      !identifier.test(columnName || "") ||
      !allowedTypes.includes(dataType)
    )
      return res
        .status(400)
        .json({
          message: "Invalid table/column name or unsupported data type.",
        });
    await pool.query(
      `ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${dataType}`,
    );
    res.json({ message: `Column ${columnName} added to ${tableName}.` });
  }),
);
app.delete(
  "/api/ddl/drop-table/:tableName",
  asyncHandler(async (req, res) => {
    const tableName = req.params.tableName;
    if (
      !identifier.test(tableName || "") ||
      ["students", "courses", "enrollments"].includes(tableName.toLowerCase())
    )
      return res
        .status(400)
        .json({ message: "Invalid name or protected core table." });
    const [rows] = await pool.query("SHOW TABLES");
    const existing = rows.some((row) => Object.values(row).includes(tableName));
    if (!existing)
      return res
        .status(404)
        .json({ message: "Table not found in the configured database." });
    await pool.query(`DROP TABLE \`${tableName}\``);
    res.json({ message: `Table ${tableName} dropped.` });
  }),
);
app.get(
  "/api/ddl/tables",
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query("SHOW TABLES");
    res.json(rows.map((row) => Object.values(row)[0]));
  }),
);

// DCL: explicit GRANT/REVOKE against a validated local MySQL account.
app.post(
  "/api/dcl",
  asyncHandler(async (req, res) => {
    const {
      action,
      privilege,
      username,
      host = "localhost",
      table = "*",
    } = req.body;
    const privileges = ["SELECT", "INSERT", "UPDATE", "DELETE"];
    if (
      !["GRANT", "REVOKE"].includes(action) ||
      !privileges.includes(privilege) ||
      !/^[A-Za-z0-9_]{1,32}$/.test(username || "") ||
      !["localhost", "127.0.0.1"].includes(host) ||
      !(table === "*" || identifier.test(table))
    ) {
      return res
        .status(400)
        .json({
          message:
            "Invalid DCL parameters. Allowed privileges: SELECT, INSERT, UPDATE, DELETE; host: localhost or 127.0.0.1.",
        });
    }
    const target =
      table === "*"
        ? `${process.env.DB_NAME || "college_db"}.*`
        : `${process.env.DB_NAME || "college_db"}.${table}`;
    const account = `'${username}'@'${host}'`;
    const sql =
      action === "GRANT"
        ? `GRANT ${privilege} ON ${target} TO ${account}`
        : `REVOKE ${privilege} ON ${target} FROM ${account}`;
    await pool.query(sql);
    res.json({
      message: `${action} ${privilege} ${action === "GRANT" ? "to" : "from"} ${account} on ${target} completed.`,
    });
  }),
);

app.use((err, _req, res, _next) => {
  console.error(err);
  const message =
    err.code === "ER_DUP_ENTRY"
      ? "A record with this unique value already exists."
      : err.code === "ER_NO_REFERENCED_ROW_2"
        ? "Selected student or course does not exist."
        : err.code === "ER_TABLE_EXISTS_ERROR"
          ? "That table already exists."
          : err.code === "ER_BAD_FIELD_ERROR"
            ? "Unknown column. Check your query and table structure."
            : err.code === "ER_NO_SUCH_TABLE"
              ? "Table does not exist."
              : err.code === "ER_ACCESS_DENIED_ERROR" ||
                  err.code === "ER_DBACCESS_DENIED_ERROR"
                ? "MySQL access denied. Check .env credentials and privileges."
                : err.sqlMessage || err.message || "Server error.";
  res.status(400).json({ message });
});

const port = Number(process.env.PORT || 5000);
app.listen(port, () =>
  console.log(`DBMS API running at http://localhost:${port}`),
);
