const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const XLSX = require("xlsx");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

let teams = {};
let questions = [];
let finalsQualified = [];
let quizStarted = false;

const MAX_TEAMS = 100;
const FINALISTS = 25;

io.on("connection", socket => {

  socket.on("join", token => {
    if (Object.keys(teams).length >= MAX_TEAMS) return;

    teams[socket.id] = {
      name: token.name || "Unknown Team",
      token: token.id,
      score: 0,
      warnings: 0,
      dq: false
    };
    io.emit("leaderboard", teams);
  });

  socket.on("warn", () => {
    const t = teams[socket.id];
    if (!t || t.dq) return;
    t.warnings++;
    if (t.warnings >= 2) t.dq = true;
    io.emit("leaderboard", teams);
  });

  socket.on("answer", ok => {
    const t = teams[socket.id];
    if (!t || t.dq) return;
    if (ok) t.score += 10;
    io.emit("leaderboard", teams);
  });

});

app.post("/upload", upload.single("file"), (req, res) => {
  const wb = XLSX.read(req.file.buffer);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  questions = XLSX.utils.sheet_to_json(sheet);
  res.send({ status: "Questions uploaded", count: questions.length });
});

app.get("/questions", (req, res) => {
  res.json(questions);
});

app.get("/finalists", (req, res) => {
  const sorted = Object.values(teams)
    .filter(t => !t.dq)
    .sort((a,b)=>b.score-a.score)
    .slice(0, FINALISTS);
  finalsQualified = sorted;
  res.json(sorted);
});

server.listen(3000, () => console.log("MEDHA Quiz Running"));
