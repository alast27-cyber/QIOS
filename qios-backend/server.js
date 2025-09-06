const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

if (!process.env.GEMINI_API_KEY) { console.error("FATAL ERROR: GEMINI_API_KEY is not set."); process.exit(1); }
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] }, transports: ['websocket'] });
const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, 'public')));

let connectedNodes = new Map();
let adminSockets = new Set();

// --- NEW: Game State ---
let waitingPlayer = null;
let gameSessions = new Map(); // sessionId -> { player1: id, player2: id }

// --- Guardian AI v4.2 (Unchanged but included for completeness) ---
const guardianAI = { /* ... same as previous version ... */ };
async function parseAndOrchestrate(programCode, requestingNodeId) { /* ... same as previous version ... */ }

io.on('connection', (socket) => {
    socket.on('register_admin', () => { /* ... same ... */ });
    socket.on('register_node', () => {
        connectedNodes.set(socket.id, { id: socket.id });
        guardianAI.trustScores.set(socket.id, 100);
        socket.join('nodes');
        socket.emit('log_message', { message: `Registered. Ready for commands.` });
        io.to('admins').emit('log_message', { type: 'success', message: `Node Connected: ${socket.id.substring(0, 6)}... Total: ${connectedNodes.size}` });
    });
    socket.on('run_program', (data) => { parseAndOrchestrate(data.code, socket.id); });
    socket.on('ai_chat_message', (data) => { /* ... same ... */ });
    socket.on('pong', () => {});

    // --- NEW: Game Event Handlers ---
    socket.on('find_game', () => {
        if (waitingPlayer && waitingPlayer !== socket.id) {
            const player1 = waitingPlayer;
            const player2 = socket.id;
            const sessionId = `game_${player1.substring(0,3)}_${player2.substring(0,3)}`;
            gameSessions.set(sessionId, { player1, player2 });
            
            // Link players to each other
            connectedNodes.get(player1).partnerId = player2;
            connectedNodes.get(player2).partnerId = player1;
            
            waitingPlayer = null; // Clear the waiting spot

            // Notify both players that a game has started
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
            // Send the entanglement command to the partner
            io.to(node.partnerId).emit('entangled_growth');
        }
    });

    socket.on('disconnect', () => {
        const wasNode = connectedNodes.has(socket.id);
        if (wasNode) {
            // Handle game cleanup if a player disconnects
            if (waitingPlayer === socket.id) waitingPlayer = null;
            const node = connectedNodes.get(socket.id);
            if (node && node.partnerId) {
                io.to(node.partnerId).emit('log_message', { type: 'error', message: 'Your partner has disconnected. Game over.' });
            }
            // (More robust session cleanup would go here)
            
            guardianAI.trustScores.delete(socket.id);
            connectedNodes.delete(socket.id);
            io.to('admins').emit('log_message', { type: 'warn', message: `Node Disconnected: ${socket.id.substring(0, 6)}... Total: ${connectedNodes.size}` });
        }
        adminSockets.delete(socket.id);
    });
});

// --- System Loops (Unchanged) ---
setInterval(() => { /* ... same system_update ... */ }, 5000);
setInterval(() => { io.emit('ping'); }, 20000);
server.listen(PORT, () => { console.log(`QIOS Back Office is running on http://localhost:${PORT}`); });

// --- PASTE UNCHANGED BLOCKS FOR COMPLETENESS ---
guardianAI.processChatMessage = async function(message, adminSocket) { /* ... */ };
async function parseAndOrchestrate(programCode, requestingNodeId) { /* ... */ };
// (Full content of these functions from the previous final version)
