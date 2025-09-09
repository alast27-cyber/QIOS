const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ['websocket']
});

const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, 'public')));

// --- Global State ---
let connectedNodes = new Map();
let adminSockets = new Set();
let waitingPlayer = null;
let gameSessions = new Map(); // sessionId -> { ...game data... }

// --- Main Connection Handler ---
io.on('connection', (socket) => {
    console.log(`A user connected: ${socket.id}`);
    socket.on('register_admin', () => { /* ... */ });
    socket.on('register_node', () => {
        connectedNodes.set(socket.id, { id: socket.id, sessionId: null });
        socket.emit('log_message', { message: `Successfully registered with Back Office.` });
        io.to('admins').emit('log_message', { type: 'success', message: `Node Connected: ${socket.id.substring(0, 6)}... Total: ${connectedNodes.size}` });
    });

    // --- PVP GAME HANDLER ---
    socket.on('find_game', () => {
        if (waitingPlayer && waitingPlayer !== socket.id && connectedNodes.has(waitingPlayer)) {
            const player1 = waitingPlayer;
            const player2 = socket.id;
            const sessionId = `game_pvp_${Date.now()}`;
            
            const newSession = {
                player1, player2,
                fruit: { x: 15, y: 15 },
                scores: { [player1]: 0, [player2]: 0 },
                fruitEaten: false
            };
            gameSessions.set(sessionId, newSession);
            
            connectedNodes.get(player1).sessionId = sessionId;
            connectedNodes.get(player2).sessionId = sessionId;
            waitingPlayer = null;

            io.to(player1).emit('game_start', { partnerId: player2, scores: newSession.scores });
            io.to(player2).emit('game_start', { partnerId: player1, scores: newSession.scores });
            io.to(player1).to(player2).emit('new_fruit', newSession.fruit);
            io.to('admins').emit('log_message', { type: 'info', message: `PVP Game started: ${sessionId}` });

        } else {
            waitingPlayer = socket.id;
            socket.emit('log_message', { type: 'info', message: 'You are waiting for a partner...' });
        }
    });

    // --- NEW: PLAYER VS AI GAME HANDLER ---
    socket.on('find_ai_game', () => {
        const player1 = socket.id;
        const player2_ai = `guardian_ai_${Date.now()}`;
        const sessionId = `game_pva_${Date.now()}`;

        const newSession = {
            player1, player2: player2_ai,
            fruit: { x: 15, y: 15 },
            scores: { [player1]: 0, [player2_ai]: 0 },
            fruitEaten: false,
            isAiGame: true,
            aiSnake: [{x: 10, y: 10}],
            aiInterval: null
        };
        gameSessions.set(sessionId, newSession);
        connectedNodes.get(player1).sessionId = sessionId;

        io.to(player1).emit('game_start', { partnerId: player2_ai, scores: newSession.scores });
        io.to(player1).emit('new_fruit', newSession.fruit);
        io.to('admins').emit('log_message', { type: 'info', message: `PVA Game started: ${sessionId}` });
        
        // Start the AI's "brain" loop
        newSession.aiInterval = setInterval(() => aiBrain(sessionId), 150); // AI thinks at a human-like speed
    });

    socket.on('ate_food', (data) => {
        const node = connectedNodes.get(socket.id);
        if (!node || !node.sessionId) return;
        const session = gameSessions.get(node.sessionId);
        if (!session || session.fruitEaten) return;

        session.fruitEaten = true;
        session.scores[socket.id]++;

        const winnerId = socket.id;
        const loserId = (winnerId === session.player1) ? session.player2 : session.player1;

        io.to(winnerId).emit('victory', { scores: session.scores });
        // If the loser is a human player, send collapse. The AI handles itself.
        if (connectedNodes.has(loserId)) {
            io.to(loserId).emit('collapse', { scores: session.scores });
        }
        
        io.to('admins').emit('log_message', { type: 'info', message: `Node ${winnerId.substring(0,3)} measured fruit.` });

        setTimeout(() => {
            session.fruit = { x: Math.floor(Math.random() * 20), y: Math.floor(Math.random() * 20) };
            session.fruitEaten = false;
            io.to(winnerId).to(loserId).emit('new_fruit', session.fruit);
        }, 500);
    });
