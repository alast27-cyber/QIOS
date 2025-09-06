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

let connectedNodes = new Map();
let adminSockets = new Set();
let systemStats = { traceability: 101, contradiction: 599, phase: 1 };

// --- GUARDIAN AI MODULE v3.0 (with Chat & Training Roadmap) ---
const guardianAI = {
    activityLog: new Map(),
    trustScores: new Map(),
    
    MEASURE_THRESHOLD: 5, TIME_WINDOW_MS: 5000,
    TRUST_THRESHOLD_CNOT: 50, SCORE_ON_CONNECT: 100,
    SCORE_PENALTY_SPAM: -75, SCORE_REWARD_SUCCESS: +5,
    SCORE_PASSIVE_REGEN: +0.5,

    // --- NEW: AI Training Roadmap ---
    trainingRoadmap: [
        { phase: 1, name: "Trust Governor", status: "complete", description: "Monitor network and govern node trust scores." },
        { phase: 2, name: "Protocol Optimizer", status: "active", description: "Analyze program efficiency and suggest protocol optimizations." },
        { phase: 3, name: "Vulnerability Forecaster", status: "pending", description: "Predict novel attack vectors through simulation." },
        { phase: 4, name: "Generative Programmer", status: "pending", description: "Autonomously write and deploy new quantum programs." },
        { phase: 5, name: "Generalized Intelligence", status: "pending", description: "Achieve strategic, multi-domain problem-solving." }
    ],

    logActivity(nodeId, command) { /* ... same as before ... */ },
    updateTrust(nodeId, amount, reason) { /* ... same as before ... */ },
    passiveRegeneration() { /* ... same as before ... */ },

    // --- NEW: AI Chat Handler ---
    processChatMessage(message, adminSocket) {
        const responsePrefix = "GuardianAI > ";
        let response = "I'm sorry, I don't understand that command. Try 'status', 'roadmap', or 'check trust <node_id>'.";

        if (message.toLowerCase().startsWith('check trust')) {
            const nodeId = message.split(' ')[2];
            const score = this.trustScores.get(nodeId) || "not found";
            response = `Trust score for node ${nodeId.substring(0,6)}... is ${score}.`;
        } else if (message.toLowerCase() === 'status') {
            const trustedCount = Array.from(this.trustScores.values()).filter(s => s > 80).length;
            response = `Network status is nominal. Monitoring ${connectedNodes.size} nodes. ${trustedCount} nodes are highly trusted.`;
        } else if (message.toLowerCase() === 'roadmap') {
            const activePhase = this.trainingRoadmap.find(p => p.status === 'active');
            response = `I am currently in Training Phase ${activePhase.phase}: ${activePhase.name}. My goal is to ${activePhase.description}`;
        }
        
        // Send the response back to the specific admin who asked
        adminSocket.emit('ai_chat_response', { sender: "GuardianAI", text: response });
    }
};
// Re-paste the unchanged logActivity and updateTrust functions here for completeness
guardianAI.logActivity = function(nodeId, command) { if (command !== 'measure') return; if (!this.activityLog.has(nodeId)) this.activityLog.set(nodeId, []); const now = Date.now(); const nodeTimestamps = this.activityLog.get(nodeId); nodeTimestamps.push(now); const recentTimestamps = nodeTimestamps.filter(ts => now - ts < this.TIME_WINDOW_MS); this.activityLog.set(nodeId, recentTimestamps); if (recentTimestamps.length >= this.MEASURE_THRESHOLD) { this.updateTrust(nodeId, this.SCORE_PENALTY_SPAM, "Measurement spam detected"); this.activityLog.set(nodeId, []); }};
guardianAI.updateTrust = function(nodeId, amount, reason) { let currentScore = this.trustScores.get(nodeId) || this.SCORE_ON_CONNECT; currentScore += amount; currentScore = Math.max(0, Math.min(100, currentScore)); this.trustScores.set(nodeId, currentScore); const alertMessage = `GuardianAI: Trust for ${nodeId.substring(0,6)}... updated by ${amount}. Score: ${currentScore}. Reason: ${reason}`; io.to('admins').emit('log_message', { type: 'warn', message: alertMessage }); };
guardianAI.passiveRegeneration = function() { for (const [nodeId, score] of this.trustScores.entries()) { if (score < 100) { this.updateTrust(nodeId, this.SCORE_PASSIVE_REGEN, "Passive regeneration"); }}};

// --- Parser & Orchestrator (unchanged from previous version) ---
async function parseAndOrchestrate(programCode, requestingNodeId) { /* ... same as before ... */ }

// --- Connection and Server Logic ---
io.on('connection', (socket) => {
    // ... 'register_admin', 'register_node', 'run_program' are the same ...
    
    // --- NEW: AI Chat Message Listener ---
    socket.on('ai_chat_message', (data) => {
        // Log the admin's message and process it
        socket.emit('ai_chat_response', { sender: "You", text: data.message });
        guardianAI.processChatMessage(data.message, socket);
    });

    // ... 'pong', 'disconnect' are the same ...
});

// System update loop (now sends the roadmap too)
setInterval(() => {
    guardianAI.passiveRegeneration();
    const updatePayload = { 
        stats: systemStats, 
        nodeCount: connectedNodes.size,
        trustScores: Object.fromEntries(guardianAI.trustScores),
        roadmap: guardianAI.trainingRoadmap // <-- NEW
    };
    io.to('admins').emit('system_update', updatePayload);
    // ... (rest is the same) ...
}, 5000);

// --- All other code (setInterval, listen, full io.on('connection') block) is the same ---
// Re-paste the full parseAndOrchestrate and io.on('connection') blocks here for completeness
async function parseAndOrchestrate(programCode, requestingNodeId) { if (guardianAI.trustScores.get(requestingNodeId) < guardianAI.TRUST_THRESHOLD_CNOT && programCode.includes('cnot')) { io.to(requestingNodeId).emit('log_message', { type: 'error', message: `Action rejected. Trust Score too low for CNOT.` }); return; } const lines = programCode.split('\n').map(l=>l.trim().split('//')[0]).filter(l=>l); const nodeList = Array.from(connectedNodes.keys()); let particleLocations = new Map(); io.to('admins').emit('log_message', {type: 'info', message: `Orchestration started by ${requestingNodeId.substring(0,6)}...`}); for(const l of lines){ const p=l.split(/\s+/), c=p[0], n=p[1]?.replace(';','').replace(',',''); const o=particleLocations.get(n); if(o)guardianAI.logActivity(o,c); switch(c){ case 'particle': { const a=nodeList[particleLocations.size % nodeList.length]; particleLocations.set(n, a); io.to(a).emit('execute_command', { command: 'create_particle', target: n }); await new Promise(r=>setTimeout(r,200)); break; } case 'hadamard': case 'x': case 'z': { if(o) { io.to(o).emit('execute_command', { command: c, target: n }); await new Promise(r=>setTimeout(r,200)); } break; } case 'cnot': { const cN=p[1].replace(',',''), tN=p[2].replace(';',''), n1=particleLocations.get(cN), n2=particleLocations.get(tN); if(n1&&n2){ io.to('admins').emit('log_message', {type:'info', message:`Entangling: ${cN} <> ${tN}`}); io.to(n1).emit('execute_command', {command:'entangle', target:cN}); io.to(n2).emit('execute_command', {command:'entangle', target:tN}); await new Promise(r=>setTimeout(r,500));} break; } case 'measure': { const b=p[3].replace(';',''); if(o){ io.to(o).emit('execute_command', {command:'measure',target:n,bit:b});} await new Promise(r=>setTimeout(r,200)); break; }}} guardianAI.updateTrust(requestingNodeId, guardianAI.SCORE_REWARD_SUCCESS, "Successful program execution"); io.to('admins').emit('log_message', {type: 'success', message: `Orchestration complete.`});}
io.on('connection', (socket) => { socket.on('register_admin', () => { adminSockets.add(socket.id); socket.join('admins'); socket.emit('log_message', { type: 'info', message: `Admin panel connected.` }); socket.emit('log_message', { type: 'info', message: `${connectedNodes.size} nodes online.` }); }); socket.on('register_node', () => { connectedNodes.set(socket.id, { id: socket.id }); guardianAI.trustScores.set(socket.id, guardianAI.SCORE_ON_CONNECT); socket.join('nodes'); socket.emit('log_message', { message: `Registered. Ready for commands.` }); io.to('admins').emit('log_message', { type: 'success', message: `Node Connected: ${socket.id.substring(0, 6)}... Total: ${connectedNodes.size}` }); }); socket.on('run_program', (data) => { parseAndOrchestrate(data.code, socket.id); }); socket.on('ai_chat_message', (data) => { socket.emit('ai_chat_response', { sender: "You", text: data.message }); guardianAI.processChatMessage(data.message, socket); }); socket.on('pong', () => {}); socket.on('disconnect', () => { const wasNode = connectedNodes.has(socket.id); if (wasNode) { guardianAI.trustScores.delete(socket.id); connectedNodes.delete(socket.id); io.to('admins').emit('log_message', { type: 'warn', message: `Node Disconnected: ${socket.id.substring(0, 6)}... Total: ${connectedNodes.size}` }); } adminSockets.delete(socket.id); }); });
setInterval(() => { io.emit('ping'); }, 20000);
server.listen(PORT, () => { console.log(`QIOS Back Office is running on http://localhost:${PORT}`); });