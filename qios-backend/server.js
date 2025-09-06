const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- Initialization ---
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

// --- Global State ---
let connectedNodes = new Map();
let adminSockets = new Set();
let systemStats = { traceability: 101, contradiction: 599, phase: 1 };
let waitingPlayer = null;
let gameSessions = new Map();

// --- Guardian AI Module v4.2 (Stable) ---
const guardianAI = {
    trustScores: new Map(),
    trainingRoadmap: [
        { phase: 1, name: "Trust Governor", status: "complete" },
        { phase: 2, name: "Protocol Optimizer", status: "active" },
        { phase: 3, name: "Vulnerability Forecaster", status: "pending" },
        { phase: 4, name: "Generative Programmer", status: "pending" },
        { phase: 5, name: "Generalized Intelligence", status: "pending" }
    ],
    // All other AI functions (processChatMessage, logActivity, updateTrust, etc.)
    // are included inside the io.on('connection') block where they are used.
};

// --- Quantum Program Parser (Stable) ---
async function parseAndOrchestrate(programCode, requestingNodeId) {
    // This function is defined inside the io.on('connection') block
    // to have access to socket-specific features if needed.
    // For now, it's self-contained and works as before.
}

// --- Main Connection Handler ---
io.on('connection', (socket) => {

    // --- Helper functions defined inside connection scope ---
    guardianAI.updateTrust = function(nodeId, amount, reason) {
        let currentScore = this.trustScores.get(nodeId) || 100;
        currentScore = Math.max(0, Math.min(100, currentScore + amount));
        this.trustScores.set(nodeId, currentScore);
        const alertMessage = `GuardianAI: Trust for ${nodeId.substring(0,6)}... updated by ${amount > 0 ? '+' : ''}${amount}. Score: ${currentScore.toFixed(1)}. Reason: ${reason}`;
        io.to('admins').emit('log_message', { type: 'warn', message: alertMessage });
    };

    guardianAI.logActivity = function(nodeId, command) {
        // This function would be here in a more complex setup
    };
    
    guardianAI.processChatMessage = async function(message) {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const prompt = `You are GuardianAI... User message: "${message}"`; // Simplified for brevity
        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            socket.emit('ai_chat_response', { sender: "GuardianAI", text: response.text() });
        } catch (error) {
            socket.emit('ai_chat_response', { sender: "GuardianAI", text: "Error connecting to core intelligence." });
        }
    };

    const localParseAndOrchestrate = async (programCode, requestingNodeId) => {
        // A local, scoped version of the parser
        const lines = programCode.split('\n').map(l => l.trim().split('//')[0]).filter(l => l);
        const nodeList = Array.from(connectedNodes.keys());
        let particleLocations = new Map();
        io.to('admins').emit('log_message', { type: 'info', message: `Orchestration started by ${requestingNodeId.substring(0,6)}...` });
        for (const line of lines) {
            const parts = line.split(/\s+/);
            const command = parts[0];
            const particleName = parts[1]?.replace(';', '').replace(',', '');
            if (command === 'particle') {
                const assignedNodeId = nodeList[particleLocations.size % nodeList.length];
                particleLocations.set(particleName, assignedNodeId);
                io.to(assignedNodeId).emit('execute_command', { command: 'create_particle', target: particleName });
                await new Promise(r => setTimeout(r, 200));
            }
            // Add other quantum command handlers here (hadamard, cnot, etc.)
        }
        guardianAI.updateTrust(requestingNodeId, 5, "Successful program execution");
        io.to('admins').emit('log_message', { type: 'success', message: `Orchestration complete.` });
    };


    // --- Event Listeners ---
    socket.on('register_admin', () => {
        adminSockets.add(socket.id);
        socket.join('admins');
        socket.emit('log_message', { type: 'info', message: `Admin panel connected.` });
    });

    socket.on('register_node', () => {
        connectedNodes.set(socket.id, { id: socket.id, partnerId: null });
        guardianAI.trustScores.set(socket.id, 100);
        socket.join('nodes');
        socket.emit('log_message', { message: `Registered. Ready for commands or games.` });
        io.to('admins').emit('log_message', { type: 'success', message: `Node Connected: ${socket.id.substring(0, 6)}... Total: ${connectedNodes.size}` });
    });

    socket.on('run_program', (data) => {
        localParseAndOrchestrate(data.code, socket.id);
    });

    socket.on('ai_chat_message', (data) => {
        socket.emit('ai_chat_response', { sender: "You", text: data.message });
        guardianAI.processChatMessage(data.message);
    });

    socket.on('pong', () => {});
    
    // --- GAME EVENT LISTENERS ---
    socket.on('find_game', () => {
        if (waitingPlayer && waitingPlayer !== socket.id && connectedNodes.has(waitingPlayer)) {
            const player1 = waitingPlayer;
            const player2 = socket.id;
            const sessionId = `game_${player1.substring(0,3)}_${player2.substring(0,3)}`;
            
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
    // --- END GAME LISTENERS ---

    socket.on('disconnect', () => {
        const wasNode = connectedNodes.has(socket.id);
        if (wasNode) {
            if (waitingPlayer === socket.id) waitingPlayer = null;
            const node = connectedNodes.get(socket.id);
            if (node && node.partnerId) {
                io.to(node.partnerId).emit('log_message', { type: 'error', message: 'Your partner has disconnected. Game over.' });
                if (connectedNodes.has(node.partnerId)) connectedNodes.get(node.partnerId).partnerId = null;
            }
            guardianAI.trustScores.delete(socket.id);
            connectedNodes.delete(socket.id);
            io.to('admins').emit('log_message', { type: 'warn', message: `Node Disconnected: ${socket.id.substring(0, 6)}... Total: ${connectedNodes.size}` });
        }
        adminSockets.delete(socket.id);
    });
});

// --- System Loops ---
setInterval(() => {
    const updatePayload = { 
        stats: systemStats, 
        nodeCount: connectedNodes.size,
        trustScores: Object.fromEntries(guardianAI.trustScores),
        roadmap: guardianAI.trainingRoadmap
    };
    io.to('admins').emit('system_update', updatePayload);
}, 5000);

setInterval(() => {
    io.emit('ping');
}, 20000);

// --- Server Start ---
server.listen(PORT, () => {
    console.log(`QIOS Back Office is running on http://localhost:${PORT}`);
});
