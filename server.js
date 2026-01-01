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

let teams = {};        // token -> team object
let socketToToken = {}; // socket.id -> token
let questions = [];

const POINTS = 10;

io.on("connection", socket => {

  socket.on("join", ({ name, token }) => {
    if (!name || !token) return;

    // Block reattempt from same device
    if (teams[token]) {
      socket.emit("blocked", "Reattempt not allowed");
      return;
    }

    teams[token] = {
      name,
      score: 0,
      dq: false
    };

    socketToToken[socket.id] = token;
    io.emit("leaderboard", teams);
  });

  socket.on("answer", ({ correct }) => {
    const token = socketToToken[socket.id];
    if (!token) return;

    const team = teams[token];
    if (!team || team.dq) return;

    if (correct === true) {
      team.score += POINTS;
      console.log("Score updated:", team.name, team.score);
    }

    io.emit("leaderboard", teams);
  });

  socket.on("dq", () => {
    const token = socketToToken[socket.id];
    if (!token) return;

    teams[token].dq = true;
    io.emit("leaderboard", teams);
  });

  socket.on("disconnect", () => {
    delete socketToToken[socket.id];
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
