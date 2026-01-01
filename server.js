const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const XLSX = require("xlsx");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

let teams = {}; 
let socketToToken = {}; 
let questions = [];

const POINTS = 10;

io.on("connection", socket => {
  // Fix: Links the new page socket to the existing team session
  socket.on("rejoin", (token) => {
    if (teams[token]) {
      socketToToken[socket.id] = token;
      console.log(`Team ${teams[token].name} rejoined.`);
    }
  });

  socket.on("join", ({ name, token }) => {
    if (!name || !token) return;
    if (teams[token]) return socket.emit("blocked");

    teams[token] = { name, score: 0, dq: false };
    socketToToken[socket.id] = token;
    io.emit("leaderboard", teams);
  });

  socket.on("answer", ({ correct }) => {
    const token = socketToToken[socket.id];
    if (!token || !teams[token] || teams[token].dq) return;

    if (correct) teams[token].score += POINTS;
    io.emit("leaderboard", teams);
  });

  socket.on("dq", () => {
    const token = socketToToken[socket.id];
    if (token && teams[token]) {
      teams[token].dq = true;
      io.emit("leaderboard", teams);
    }
  });

  socket.on("disconnect", () => {
    delete socketToToken[socket.id];
  });
});

app.post("/upload", upload.single("file"), (req, res) => {
  try {
    const wb = XLSX.read(req.file.buffer);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    questions = XLSX.utils.sheet_to_json(sheet);
    res.json({ status: "Success", count: questions.length });
  } catch (e) {
    res.status(500).json({ status: "Error reading Excel" });
  }
});

app.get("/questions", (req, res) => res.json(questions));

// Serve HTML files properly
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public/index.html")));
app.get("/quiz", (req, res) => res.sendFile(path.join(__dirname, "public/quiz.html")));
app.get("/leaderboard", (req, res) => res.sendFile(path.join(__dirname, "public/leaderboard.html")));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("MEDHA Quiz Running on port " + PORT));