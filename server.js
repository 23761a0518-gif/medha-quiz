const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const XLSX = require("xlsx");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static("public"));
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

let teams = {}; 
let socketToToken = {}; 
let questions = [];

// This function removes the circular Timer object so Socket.io doesn't crash
function getCleanTeams() {
    let clean = {};
    for (let token in teams) {
        clean[token] = {
            name: teams[token].name,
            score: teams[token].score,
            dq: teams[token].dq,
            currentQ: teams[token].currentQ,
            completed: teams[token].completed
        };
    }
    return clean;
}

io.on("connection", socket => {
    socket.on("register_monitor", () => {
        socket.join("monitors");
        socket.emit("leaderboard", getCleanTeams());
    });

    socket.on("rejoin", (token) => {
        if (teams[token]) {
            socketToToken[socket.id] = token;
            if (teams[token].dqTimer) {
                clearTimeout(teams[token].dqTimer);
                teams[token].dqTimer = null;
            }
            socket.emit("sync_state", { 
                currentQ: teams[token].currentQ, 
                dq: teams[token].dq,
                completed: teams[token].completed,
                totalQ: questions.length
            });
        }
    });

    socket.on("join", ({ name, token }) => {
        if (!/^\d{1,3}$/.test(name)) return;
        const isTaken = Object.values(teams).some(t => t.name === name);
        if (isTaken) return socket.emit("error_msg", "This Team ID is already registered!");

        teams[token] = { name, score: 0, dq: false, currentQ: 0, completed: false, dqTimer: null };
        socketToToken[socket.id] = token;
        io.to("monitors").emit("leaderboard", getCleanTeams());
        socket.emit("join_success", { totalQ: questions.length });
    });

    socket.on("answer", ({ correct }) => {
        const token = socketToToken[socket.id];
        const team = teams[token];
        if (!team || team.dq || team.completed) return;

        if (correct) team.score += 10;
        team.currentQ++; 
        if(team.currentQ >= questions.length) team.completed = true;
        io.to("monitors").emit("leaderboard", getCleanTeams());
    });

    socket.on("dq_signal", () => {
        const token = socketToToken[socket.id];
        if (token && teams[token]) {
            teams[token].dq = true;
            socket.emit("force_dq"); 
            io.to("monitors").emit("leaderboard", getCleanTeams());
        }
    });

    socket.on("qualify_team", (token) => {
        if (teams[token]) {
            teams[token].dq = false;
            io.to("monitors").emit("leaderboard", getCleanTeams());
            io.emit("restored", token); 
        }
    });

    socket.on("reset_all_data", () => {
        teams = {};
        socketToToken = {};
        io.emit("force_logout");
        io.to("monitors").emit("leaderboard", {});
    });

    socket.on("disconnect", () => {
        const token = socketToToken[socket.id];
        const team = teams[token];
        if (token && team && !team.completed && !team.dq) {
            team.dqTimer = setTimeout(() => {
                team.dq = true;
                io.to("monitors").emit("leaderboard", getCleanTeams());
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
server.listen(PORT, '0.0.0.0', () => console.log(`Server Running on ${PORT}`));