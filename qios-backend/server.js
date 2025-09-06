const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

if (!process.env.GEMINI_API_KEY) {
    console.error("FATAL ERROR: GEMINI_API_KEY environment variable is not set.");
    process.exit(1);
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ['websocket']
});

const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, 'public')));

let connectedNodes = new Map();
let adminSockets = new Set();
let systemStats = { traceability: 101, contradiction: 599, phase: 1 };

// --- NEW: Game State ---
let waitingPlayer = null;
let gameSessions = new Map();

// --- GUARDIAN AI MODULE (Complete and Correct) ---
const guardianAI = {
    trustScores: new Map(),
    trainingRoadmap: [
        { phase: 1, name: "Trust Governor", status: "complete" },
        { phase: 2, name: "Protocol Optimizer", status: "active" },
        { phase: 3, name: "Vulnerability Forecaster", status: "pending" },
        { phase: 4, name: "Generative Programmer", status: "pending" },
        { phase: 5, name: "Generalized Intelligence", status: "pending" }
    ],
    async processChatMessage(message, adminSocket) {
        const model = genAI.getGenerativeModel({ model: "gemini-pro"});
        const trustedCount = Array.from(this.trustScores.values()).filter(s => s >= 80).length;
        const untrustedCount = Array.from(this.trustScores.values()).filter(s => s < 50).length;
        const activePhase = this.trainingRoadmap.find(p => p.status === 'active');
        const prompt = `You are GuardianAI, the master AI for QIOS... Current state: ${connectedNodes.size} nodes, ${trustedCount} trusted, ${untrustedCount} untrusted. Active phase: ${activePhase.name}. User message: "${message}". Provide a concise response.`;
        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            adminSocket.emit('ai_chat_response', { sender: "GuardianAI", text: text });
        } catch (error) {
            console.error("Error calling Gemini API:", error);
            adminSocket.emit('ai_chat_response', { sender: "GuardianAI", text: "Error connecting to core intelligence." });
        }
    }
};

// --- Main Connection Logic ---
io.on('connection', (socket) => {
    // Admin Registration
    socket.on('register_admin', () => {
        adminSockets.add(socket.id);
        socket.join('admins');
        socket.emit('log_message', { type: 'info', message: `Admin panel connected.` });
    });

    // Node Registration
    socket.on('register_node', () => {
        connectedNodes.set(socket.id, { id: socket.id, partnerId: null });
        guardianAI.trustScores.set(socket.id, 100);
        socket.join('nodes');
        socket.emit('log_message', { message: `Registered. Ready for commands or games.` });
        io.to('admins').emit('log_message', { type: 'success', message: `Node Connected: ${socket.id.substring(0, 6)}... Total: ${connectedNodes.size}` });
    });

    // AI Chat Handler
    socket.on('ai_chat_message', (data) => {
        socket.emit('ai_chat_response', { sender: "You", text: data.message });
        guardianAI.processChatMessage(data.message, socket);
    });
    
    // Heartbeat
    socket.on('pong', () => {});

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

    // Disconnect Logic
    socket.on('disconnect', () => {
        const wasNode = connectedNodes.has(socket.id);
        if (wasNode) {
            if (waitingPlayer === socket.id) waitingPlayer = null;
            const node = connectedNodes.get(socket.id);
            if (node && node.partnerId) {
                io.to(node.partnerId).emit('log_message', { type: 'error', message: 'Your partner has disconnected. Game over.' });
                if(connectedNodes.has(node.partnerId)) connectedNodes.get(node.partnerId).partnerId = null;
            }
            
            guardianAI.trustScores.delete(socket.id);
            connectedNodes.delete(socket.id);
            io.to('admins').emit('log_message', { type: 'warn', message: `Node Disconnected: ${socket.id.substring(0, 6)}... Total: ${connectedNodes.size}` });
        }
        adminSockets.delete(socket.id);
    });
});

// --- System Update Loop (for Admin Panel) ---
setInterval(() => {
    const updatePayload = { 
        stats: systemStats, 
        nodeCount: connectedNodes.size,
        trustScores: Object.fromEntries(guardianAI.trustScores),
        roadmap: guardianAI.trainingRoadmap,
        gameSessions: Array.from(gameSessions.keys()) // Send active game session IDs
    };
    io.to('admins').emit('system_update', updatePayload);
}, 5000);

// --- Heartbeat Loop ---
setInterval(() => {
    io.emit('ping');
}, 20000);

// --- Server Start ---
server.listen(PORT, () => {
    console.log(`QIOS Back Office is running on http://localhost:${PORT}`);
});
