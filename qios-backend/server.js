const express = require('express');
const http =require('http');
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

let connectedNodes = new Map();
let adminSockets = new Set();
let systemStats = { traceability: 101, contradiction: 599, phase: 1 };

// --- GUARDIAN AI MODULE v2.0 (Reputation-Based Trust) ---
const guardianAI = {
    activityLog: new Map(),
    trustScores: new Map(), // <--- NEW: Trust Score map
    
    // Constants
    MEASURE_THRESHOLD: 5,
    TIME_WINDOW_MS: 5000,
    TRUST_THRESHOLD_CNOT: 50, // Must have a score of at least 50 to perform CNOT
    
    // Scoring Modifiers
    SCORE_ON_CONNECT: 100,
    SCORE_PENALTY_SPAM: -75,
    SCORE_REWARD_SUCCESS: +5,
    SCORE_PASSIVE_REGEN: +0.5,

    logActivity(nodeId, command) {
        if (command !== 'measure') return;
        if (!this.activityLog.has(nodeId)) this.activityLog.set(nodeId, []);

        const now = Date.now();
        const nodeTimestamps = this.activityLog.get(nodeId);
        nodeTimestamps.push(now);

        const recentTimestamps = nodeTimestamps.filter(ts => now - ts < this.TIME_WINDOW_MS);
        this.activityLog.set(nodeId, recentTimestamps);

        if (recentTimestamps.length >= this.MEASURE_THRESHOLD) {
            this.updateTrust(nodeId, this.SCORE_PENALTY_SPAM, "Measurement spam detected");
            this.activityLog.set(nodeId, []); // Reset after triggering
        }
    },

    updateTrust(nodeId, amount, reason) {
        let currentScore = this.trustScores.get(nodeId) || this.SCORE_ON_CONNECT;
        currentScore += amount;
        currentScore = Math.max(0, Math.min(100, currentScore)); // Clamp score between 0 and 100
        this.trustScores.set(nodeId, currentScore);

        const alertMessage = `GuardianAI: Trust for ${nodeId.substring(0,6)}... updated by ${amount}. New Score: ${currentScore}. Reason: ${reason}`;
        console.log(alertMessage);
        io.to('admins').emit('log_message', { type: 'warn', message: alertMessage });
    },
    
    passiveRegeneration() {
        for (const [nodeId, score] of this.trustScores.entries()) {
            if (score < 100) {
                this.updateTrust(nodeId, this.SCORE_PASSIVE_REGEN, "Passive regeneration");
            }
        }
    }
};

// --- ADVANCED PARSER & ORCHESTRATOR v2.0 ---
async function parseAndOrchestrate(programCode, requestingNodeId) {
    // Check if the node is trusted enough for sensitive operations
    if (programCode.includes('cnot') && (guardianAI.trustScores.get(requestingNodeId) || 100) < guardianAI.TRUST_THRESHOLD_CNOT) {
        io.to(requestingNodeId).emit('log_message', { type: 'error', message: `Action rejected. Trust Score is too low for CNOT operations.` });
        return;
    }

    const lines = programCode.split('\n').map(line => line.trim().split('//')[0]).filter(line => line);
    const nodeList = Array.from(connectedNodes.keys());
    let particleLocations = new Map();

    io.to('admins').emit('log_message', {type: 'info', message: `Orchestration started by ${requestingNodeId.substring(0,6)}...`});

    for (const line of lines) {
        const parts = line.split(/\s+/);
        const command = parts[0];
        const particleName = parts[1]?.replace(';', '').replace(',', '');
        
        const ownerNodeId = particleLocations.get(particleName);
        if(ownerNodeId) guardianAI.logActivity(ownerNodeId, command);

        // ... (rest of the switch case is identical to the previous version)
        switch(command) {
            case 'particle': { const a=nodeList[particleLocations.size % nodeList.length]; particleLocations.set(particleName,a); io.to(a).emit('execute_command', { command: 'create_particle', target: particleName }); await new Promise(r=>setTimeout(r,200)); break; }
            case 'hadamard': case 'x': case 'z': { if (ownerNodeId) { io.to(ownerNodeId).emit('execute_command', { command: command, target: particleName }); await new Promise(r=>setTimeout(r,200)); } break; }
            case 'cnot': { const c=parts[1].replace(',',''), t=parts[2].replace(';',''), n1=particleLocations.get(c), n2=particleLocations.get(t); if (n1&&n2) { io.to('admins').emit('log_message', {type:'info', message:`Entangling: ${c} <> ${t}`}); io.to(n1).emit('execute_command', {command:'entangle',target:c}); io.to(n2).emit('execute_command', {command:'entangle',target:t}); await new Promise(r=>setTimeout(r,500));} break; }
            case 'measure': { const b=parts[3].replace(';',''); if (ownerNodeId) { io.to(ownerNodeId).emit('execute_command', {command:'measure',target:particleName,bit:b}); } await new Promise(r=>setTimeout(r,200)); break; }
        }
    }
    
    // Reward the node for successful completion
    guardianAI.updateTrust(requestingNodeId, guardianAI.SCORE_REWARD_SUCCESS, "Successful program execution");
    io.to('admins').emit('log_message', {type: 'success', message: `Orchestration complete.`});
}

// --- Connection and Server Logic ---
io.on('connection', (socket) => {
    socket.on('register_admin', () => {
        adminSockets.add(socket.id); socket.join('admins');
        socket.emit('log_message', { type: 'info', message: `Admin panel connected.` });
        socket.emit('log_message', { type: 'info', message: `${connectedNodes.size} nodes online.` });
    });
    socket.on('register_node', () => {
        connectedNodes.set(socket.id, { id: socket.id });
        guardianAI.trustScores.set(socket.id, guardianAI.SCORE_ON_CONNECT); // Set initial trust score
        socket.join('nodes');
        socket.emit('log_message', { message: `Registered. Ready for commands.` });
        io.to('admins').emit('log_message', { type: 'success', message: `Node Connected: ${socket.id.substring(0, 6)}... Total: ${connectedNodes.size}` });
    });
    socket.on('run_program', (data) => { parseAndOrchestrate(data.code, socket.id); });
    socket.on('pong', () => {});
    socket.on('disconnect', () => {
        const wasNode = connectedNodes.has(socket.id);
        if (wasNode) {
            guardianAI.trustScores.delete(socket.id); // Clean up trust score
            connectedNodes.delete(socket.id);
            io.to('admins').emit('log_message', { type: 'warn', message: `Node Disconnected: ${socket.id.substring(0, 6)}... Total: ${connectedNodes.size}` });
        }
        adminSockets.delete(socket.id);
    });
});
    
// System update loop
setInterval(() => {
    guardianAI.passiveRegeneration(); // Regenerate trust scores slowly
    const updatePayload = { 
        stats: systemStats, 
        nodeCount: connectedNodes.size,
        trustScores: Object.fromEntries(guardianAI.trustScores) // Send all trust scores
    };
    io.to('admins').emit('system_update', updatePayload);
    // Send individual trust scores to each node
    for (const [nodeId, score] of guardianAI.trustScores.entries()) {
        io.to(nodeId).emit('trust_update', { score: score });
    }
}, 5000); // Slower, more meaningful updates

setInterval(() => { io.emit('ping'); }, 20000);
server.listen(PORT, () => { console.log(`QIOS Back Office is running on http://localhost:${PORT}`); });