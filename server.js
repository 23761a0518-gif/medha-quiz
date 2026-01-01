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

const MAX_TEAMS = 100;

io.on("connection", socket => {

  socket.on("join", data => {
    if (Object.keys(teams).length >= MAX_TEAMS) return;

    teams[socket.id] = {
      name: data.name,
      device: data.device,
      score: 0,
      warnings: 0,
      dq: false
    };

    io.emit("leaderboard", teams);
  });

  socket.on("answer", isCorrect => {
    const t = teams[socket.id];
    if (!t || t.dq) return;

    if (isCorrect) {
      t.score += 10;
    }
    io.emit("leaderboard", teams);
  });

  socket.on("warn", () => {
    const t = teams[socket.id];
    if (!t || t.dq) return;

    t.warnings++;
    if (t.warnings >= 2) {
      t.dq = true;
    }
    io.emit("leaderboard", teams);
  });

  socket.on("disconnect", () => {
    // DO NOT delete team → leaderboard must persist
  });
});

app.post("/upload", upload.single("file"), (req, res) => {
  const wb = XLSX.read(req.file.buffer);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  questions = XLSX.utils.sheet_to_json(sheet);
  res.json({ status: "Questions uploaded", count: questions.length });
});

app.get("/questions", (req, res) => {
  res.json(questions);
});

server.listen(3000, () => {
  console.log("MEDHA Quiz Running");
});
