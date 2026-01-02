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

io.on("connection", socket => {
    socket.on("rejoin", (token) => {
        if (teams[token]) {
            socketToToken[socket.id] = token;
            
            // Clear any pending DQ timer because they successfully rejoined
            if (teams[token].dqTimer) {
                clearTimeout(teams[token].dqTimer);
                teams[token].dqTimer = null;
            }

            socket.emit("sync_state", { 
                currentQ: teams[token].currentQ, 
                dq: teams[token].dq,
                completed: teams[token].completed
            });
        }
    });

    socket.on("join", ({ name, token }) => {
        if (!/^\d{3}$/.test(name)) return;
        if (teams[token]) return socket.emit("blocked");
        
        teams[token] = { 
            name, 
            score: 0, 
            dq: false, 
            currentQ: 0, 
            completed: false,
            dqTimer: null 
        };
        socketToToken[socket.id] = token;
        io.emit("leaderboard", teams);
    });

    socket.on("answer", ({ correct }) => {
        const token = socketToToken[socket.id];
        const team = teams[token];
        if (!team || team.dq || team.completed) return;

        if (correct) team.score += 10;
        team.currentQ++; 
        
        if(team.currentQ >= questions.length) team.completed = true;
        io.emit("leaderboard", teams);
    });

    socket.on("dq_signal", () => {
        const token = socketToToken[socket.id];
        if (token && teams[token]) {
            teams[token].dq = true;
            io.emit("leaderboard", teams);
        }
    });

    socket.on("qualify_team", (token) => {
        if (teams[token]) {
            teams[token].dq = false;
            io.emit("leaderboard", teams);
            io.emit("restored", token); 
        }
    });

    socket.on("disconnect", () => {
        const token = socketToToken[socket.id];
        const team = teams[token];

        if (token && team && !team.completed && !team.dq) {
            // GRACE PERIOD: Wait 5 seconds before DQing. 
            // This allows for page transitions (index -> quiz)
            team.dqTimer = setTimeout(() => {
                team.dq = true;
                io.emit("leaderboard", teams);
                team.dqTimer = null;
            }, 5000); 
        }
        delete socketToToken[socket.id];
    });
});

app.post("/upload", upload.single("file"), (req, res) => {
    try {
        const wb = XLSX.read(req.file.buffer);
        questions = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        res.json({ count: questions.length });
    } catch(e) { res.status(500).send(); }
});

app.get("/questions", (req, res) => res.json(questions));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`LAKSHYA 2K26 Fixed Server Running` Sun));