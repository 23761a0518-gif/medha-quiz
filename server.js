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

let teams = {}; // token -> team
let socketMap = {}; // socket.id -> token
let questions = [];

const POINTS = 10;

io.on("connection", socket => {

  socket.on("join", ({ name, token }) => {
    if (!name || !token) return;

    // block reattempt from same device
    if (teams[token]) {
      socket.emit("blocked", "Reattempt not allowed");
      return;
    }

    teams[token] = {
      name,
      score: 0,
      dq: false
    };

    socketMap[socket.id] = token;
    io.emit("leaderboard", teams);
  });

  socket.on("answer", data => {
  const t = teams[socket.id];
  if (!t || t.dq) return;

  // SUPPORT BOTH formats (safety)
  const correct =
    typeof data === "boolean"
      ? data
      : data && data.correct === true;

  if (correct) {
    t.score += 10;
    console.log("Score added to", t.name, "=", t.score);
  }

  io.emit("leaderboard", teams);
});


  socket.on("dq", () => {
    const token = socketMap[socket.id];
    if (!token) return;
    teams[token].dq = true;
    io.emit("leaderboard", teams);
  });

  socket.on("disconnect", () => {
    delete socketMap[socket.id];
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("MEDHA Quiz Running"));
