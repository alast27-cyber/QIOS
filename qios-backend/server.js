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
let gameSessions = new Map();

// --- Main Connection Handler ---
io.on('connection', (socket) => {
    console.log(`A user connected: ${socket.id}`);

    // Admin Registration
    socket.on('register_admin', () => {
        adminSockets.add(socket.id);
        socket.join('admins');
        console.log(`Admin panel registered: ${socket.id}`);
        socket.emit('log_message', { type: 'info', message: `Admin panel connected. Monitoring network.` });
    });

    // Node Registration
    socket.on('register_node', () => {
        connectedNodes.set(socket.id, { id: socket.id, partnerId: null });
        socket.join('nodes');
        console.log(`Node registered: ${socket.id}`);
        socket.emit('log_message', { message: `Successfully registered with Back Office.` });
        io.to('admins').emit('log_message', { type: 'success', message: `Node Connected: ${socket.id.substring(0, 6)}... Total: ${connectedNodes.size}` });
    });
    
    // --- GAME EVENT HANDLERS ---
    socket.on('find_game', () => {
        if (waitingPlayer && waitingPlayer !== socket.id && connectedNodes.has(waitingPlayer)) {
            const player1 = waitingPlayer;
            const player2 = socket.id;
            const sessionId = `game_${player1.substring(0,3)}_${player2.substring(0,3)}`;
            gameSessions.set(sessionId, { player1, player2 });
            
            connectedNodes.get(player1).partnerId = player2;
            connectedNodes.get(player2).partnerId = player1;
            
            waitingPlayer = null;

            io.to(player1).emit('game_start', { partnerId: player2, sessionId });
            io.to(player2).emit('game_start', { partnerId: player1, sessionId });
            io.to('admins').emit('log_message', { type: 'info', message: `Game started: ${sessionId}` });

        } else {
            waitingPlayer = socket.id;
            socket.emit('log_message', { type: 'info', message: 'You are waiting for a partner...' });
        }
    });

    socket.on('ate_food', () => {
        const node = connectedNodes.get(socket.id);
        if (node && node.partnerId) {
            io.to(node.partnerId).emit('entangled_growth');
        }
    });

    // Heartbeat
    socket.on('pong', () => {});

    // Disconnect Logic
    socket.on('disconnect', () => {
        console.log(`A user disconnected: ${socket.id}`);
        const wasNode = connectedNodes.has(socket.id);
        if (wasNode) {
            if (waitingPlayer === socket.id) waitingPlayer = null;
            const node = connectedNodes.get(socket.id);
            if (node && node.partnerId) {
                io.to(node.partnerId).emit('log_message', { type: 'error', message: 'Your partner has disconnected. Game over.' });
                if (connectedNodes.has(node.partnerId)) connectedNodes.get(node.partnerId).partnerId = null;
            }
            connectedNodes.delete(socket.id);
            io.to('admins').emit('log_message', { type: 'warn', message: `Node Disconnected: ${socket.id.substring(0, 6)}... Total: ${connectedNodes.size}` });
        }
        adminSockets.delete(socket.id);
    });
});

// --- System Update Loop for Admin Panel ---
setInterval(() => {
    const updatePayload = { 
        nodeCount: connectedNodes.size
    };
    io.to('admins').emit('system_update', updatePayload);
}, 2000);

// --- Heartbeat Loop ---
setInterval(() => {
    io.emit('ping');
}, 20000);

// --- Server Start ---
server.listen(PORT, () => {
    console.log(`QIOS Back Office is running on http://localhost:${PORT}`);
});
