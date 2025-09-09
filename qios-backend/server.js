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
let gameSessions = new Map(); // sessionId -> { player1: id, player2: id, fruit: {x, y}, scores: {p1, p2}, fruitEaten: false }

// --- Main Connection Handler ---
io.on('connection', (socket) => {
    console.log(`A user connected: ${socket.id}`);

    socket.on('register_admin', () => { /* ... unchanged ... */ });
    socket.on('register_node', () => {
        connectedNodes.set(socket.id, { id: socket.id, sessionId: null });
        socket.join('nodes');
        socket.emit('log_message', { message: `Successfully registered with Back Office.` });
        io.to('admins').emit('log_message', { type: 'success', message: `Node Connected: ${socket.id.substring(0, 6)}... Total: ${connectedNodes.size}` });
    });

    // --- GAME EVENT HANDLERS v2.0 ---
    socket.on('find_game', () => {
        if (waitingPlayer && waitingPlayer !== socket.id && connectedNodes.has(waitingPlayer)) {
            const player1 = waitingPlayer;
            const player2 = socket.id;
            const sessionId = `game_${Date.now()}`;
            
            const newSession = {
                player1,
                player2,
                fruit: { x: 15, y: 15 }, // Initial fruit position
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
            io.to('admins').emit('log_message', { type: 'info', message: `Game started: ${sessionId}` });

        } else {
            waitingPlayer = socket.id;
            socket.emit('log_message', { type: 'info', message: 'You are waiting for a partner...' });
        }
    });

    socket.on('ate_food', (data) => {
        const node = connectedNodes.get(socket.id);
        if (!node || !node.sessionId) return;

        const session = gameSessions.get(node.sessionId);
        if (!session || session.fruitEaten) return; // Ignore if fruit already eaten in this tick

        // First player to eat wins the race!
        session.fruitEaten = true;
        session.scores[socket.id]++;

        const winnerId = socket.id;
        const loserId = (winnerId === session.player1) ? session.player2 : session.player1;

        // Notify winner and loser
        io.to(winnerId).emit('victory', { scores: session.scores });
        io.to(loserId).emit('collapse', { scores: session.scores });
        io.to('admins').emit('log_message', { type: 'info', message: `Node ${winnerId.substring(0,3)} measured the fruit.` });

        // Generate a new fruit after a short delay
        setTimeout(() => {
            session.fruit = {
                x: Math.floor(Math.random() * 20),
                y: Math.floor(Math.random() * 20)
            };
            session.fruitEaten = false;
            io.to(winnerId).to(loserId).emit('new_fruit', session.fruit);
        }, 500); // 0.5 second delay before new fruit appears
    });

    socket.on('game_over', () => {
        const node = connectedNodes.get(socket.id);
        if (!node || !node.sessionId) return;
        
        const session = gameSessions.get(node.sessionId);
        if (!session) return;

        const winnerId = (socket.id === session.player1) ? session.player2 : session.player1;
        io.to(winnerId).emit('log_message', { type: 'success', message: 'You win! Your opponent collided.' });
        
        // Clean up session
        if(connectedNodes.has(session.player1)) connectedNodes.get(session.player1).sessionId = null;
        if(connectedNodes.has(session.player2)) connectedNodes.get(session.player2).sessionId = null;
        gameSessions.delete(node.sessionId);
        io.to('admins').emit('log_message', { type: 'warn', message: `Game over: ${node.sessionId}` });
    });

    socket.on('pong', () => {});

    socket.on('disconnect', () => {
        const wasNode = connectedNodes.has(socket.id);
        if (wasNode) {
            if (waitingPlayer === socket.id) waitingPlayer = null;
            const node = connectedNodes.get(socket.id);
            if (node && node.sessionId) {
                const session = gameSessions.get(node.sessionId);
                if (session) {
                    const partnerId = (socket.id === session.player1) ? session.player2 : session.player1;
                    io.to(partnerId).emit('log_message', { type: 'error', message: 'Your partner has disconnected. Game over.' });
                    if(connectedNodes.has(partnerId)) connectedNodes.get(partnerId).sessionId = null;
                    gameSessions.delete(node.sessionId);
                }
            }
            connectedNodes.delete(socket.id);
            io.to('admins').emit('log_message', { type: 'warn', message: `Node Disconnected: ${socket.id.substring(0, 6)}... Total: ${connectedNodes.size}` });
        }
        adminSockets.delete(socket.id);
    });
});

// --- System Loops & Server Start (Unchanged) ---
setInterval(() => { const updatePayload = { nodeCount: connectedNodes.size }; io.to('admins').emit('system_update', updatePayload); }, 2000);
setInterval(() => { io.emit('ping'); }, 20000);
server.listen(PORT, () => { console.log(`QIOS Back Office is running on http://localhost:${PORT}`); });
