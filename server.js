
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

let teams = {};      // socket.id -> team
let questions = [];  // loaded from excel

const MAX_TEAMS = 100;
const POINTS = 10;

io.on("connection", socket => {

  socket.on("join", ({ name, token }) => {
    if (!name || !token) return;
    if (Object.keys(teams).length >= MAX_TEAMS) return;

    // block rejoin from same device token
    const exists = Object.values(teams).find(t => t.token === token);
    if (exists) {
      socket.emit("blocked", "Reattempt not allowed from same device");
      return;
    }

    teams[socket.id] = {
      name,
      token,
      score: 0,
      dq: false
    };

    io.emit("leaderboard", teams);
  });

  socket.on("answer", ({ correct }) => {
    const t = teams[socket.id];
    if (!t || t.dq) return;
    if (correct) t.score += POINTS;
    io.emit("leaderboard", teams);
  });

  socket.on("dq", () => {
    const t = teams[socket.id];
    if (!t) return;
    t.dq = true;
    io.emit("leaderboard", teams);
  });

  socket.on("disconnect", () => {
    // do NOT delete team -> preserve leaderboard on refresh
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
server.listen(PORT, () => console.log("MEDHA Quiz Running on", PORT));
