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

// --- GUARDIAN AI MODULE v3.1 (with Improved Chat) ---
const guardianAI = {
    activityLog: new Map(),
    trustScores: new Map(),
    
    MEASURE_THRESHOLD: 5, TIME_WINDOW_MS: 5000,
    TRUST_THRESHOLD_CNOT: 50, SCORE_ON_CONNECT: 100,
    SCORE_PENALTY_SPAM: -75, SCORE_REWARD_SUCCESS: +5,
    SCORE_PASSIVE_REGEN: +0.5,

    trainingRoadmap: [
        { phase: 1, name: "Trust Governor", status: "complete", description: "Monitor network and govern node trust scores." },
        { phase: 2, name: "Protocol Optimizer", status: "active", description: "Analyze program efficiency and suggest protocol optimizations." },
        { phase: 3, name: "Vulnerability Forecaster", status: "pending", description: "Predict novel attack vectors through simulation." },
        { phase: 4, name: "Generative Programmer", status: "pending", description: "Autonomously write and deploy new quantum programs." },
        { phase: 5, name: "Generalized Intelligence", status: "pending", description: "Achieve strategic, multi-domain problem-solving." }
    ],

    logActivity(nodeId, command) {
        if (this.quarantinedNodes && this.quarantinedNodes.has(nodeId)) return; // Added check for safety
        if (command !== 'measure') return;
        if (!this.activityLog.has(nodeId)) this.activityLog.set(nodeId, []);
        const now = Date.now();
        const nodeTimestamps = this.activityLog.get(nodeId);
        nodeTimestamps.push(now);
        const recentTimestamps = nodeTimestamps.filter(ts => now - ts < this.TIME_WINDOW_MS);
        this.activityLog.set(nodeId, recentTimestamps);
        if (recentTimestamps.length >= this.MEASURE_THRESHOLD) {
            this.updateTrust(nodeId, this.SCORE_PENALTY_SPAM, "Measurement spam detected");
            this.activityLog.set(nodeId, []);
        }
    },

    updateTrust(nodeId, amount, reason) {
        let currentScore = this.trustScores.get(nodeId) || this.SCORE_ON_CONNECT;
        currentScore += amount;
        currentScore = Math.max(0, Math.min(100, currentScore));
        this.trustScores.set(nodeId, currentScore);
        const alertMessage = `GuardianAI: Trust for ${nodeId.substring(0,6)}... updated by ${amount > 0 ? '+' : ''}${amount}. Score: ${currentScore.toFixed(1)}. Reason: ${reason}`;
        io.to('admins').emit('log_message', { type: 'warn', message: alertMessage });
    },
    
    passiveRegeneration() {
        for (const nodeId of this.trustScores.keys()) {
            if (this.trustScores.get(nodeId) < 100) {
                this.trustScores.set(nodeId, Math.min(100, this.trustScores.get(nodeId) + this.SCORE_PASSIVE_REGEN));
            }
        }
    },

    // --- NEW & IMPROVED CHAT PARSER ---
    processChatMessage(message, adminSocket) {
        let response = "I'm sorry, I don't understand. Try asking for 'status', 'roadmap', or 'check trust <node_id>'.";
        const msg = message.toLowerCase();

        if (msg.includes('check trust')) {
            const parts = message.split(' ');
            const nodeIdToFind = parts.length > 2 ? parts[2] : null;
            let found = false;
            if (nodeIdToFind) {
                for (const nodeId of this.trustScores.keys()) {
                    if (nodeId.startsWith(nodeIdToFind)) {
                        const score = this.trustScores.get(nodeId);
                        response = `Trust score for node ${nodeId.substring(0,6)}... is ${score.toFixed(1)}.`;
                        found = true;
                        break;
                    }
                }
                if (!found) response = `Node with ID starting '${nodeIdToFind}' not found.`;
            } else {
                 response = `Please provide a node ID. Usage: check trust <node_id>`;
            }
        } else if (msg.includes('status')) {
            const trustedCount = Array.from(this.trustScores.values()).filter(s => s >= 80).length;
            const untrustedCount = Array.from(this.trustScores.values()).filter(s => s < 50).length;
            response = `Network status: OK. Monitoring ${connectedNodes.size} nodes. ${trustedCount} are trusted, ${untrustedCount} are untrusted.`;
        } else if (msg.includes('roadmap')) {
            const activePhase = this.trainingRoadmap.find(p => p.status === 'active');
            response = `I am in Training Phase ${activePhase.phase}: ${activePhase.name}. My current directive is to ${activePhase.description}`;
        }
        
        adminSocket.emit('ai_chat_response', { sender: "GuardianAI", text: response });
    }
};

async function parseAndOrchestrate(programCode, requestingNodeId) {
    if ((guardianAI.trustScores.get(requestingNodeId) || 100) < guardianAI.TRUST_THRESHOLD_CNOT && programCode.includes('cnot')) {
        io.to(requestingNodeId).emit('log_message', { type: 'error', message: `Action rejected. Trust Score too low for CNOT.` });
        return;
    }

    const lines = programCode.split('\n').map(l=>l.trim().split('//')[0]).filter(l=>l);
    const nodeList = Array.from(connectedNodes.keys());
    let particleLocations = new Map();

    io.to('admins').emit('log_message', {type: 'info', message: `Orchestration started by ${requestingNodeId.substring(0,6)}...`});

    for(const l of lines){
        const p=l.split(/\s+/), c=p[0], n=p[1]?.replace(';','').replace(',','');
        const o=particleLocations.get(n);
        if(o) guardianAI.logActivity(o,c);

        switch(c){
            case 'particle': { const a=nodeList[particleLocations.size % nodeList.length]; particleLocations.set(n, a); io.to(a).emit('execute_command', { command: 'create_particle', target: n }); await new Promise(r=>setTimeout(r,200)); break; }
            case 'hadamard': case 'x': case 'z': { if(o) { io.to(o).emit('execute_command', { command: c, target: n }); await new Promise(r=>setTimeout(r,200)); } break; }
            case 'cnot': { const cN=p[1].replace(',',''), tN=p[2].replace(';',''), n1=particleLocations.get(cN), n2=particleLocations.get(tN); if(n1&&n2){ io.to('admins').emit('log_message', {type:'info', message:`Entangling: ${cN} <> ${tN}`}); io.to(n1).emit('execute_command', {command:'entangle', target:cN}); io.to(n2).emit('execute_command', {command:'entangle', target:tN}); await new Promise(r=>setTimeout(r,500));} break; }
            case 'measure': { const b=p[3]?.replace(';',''); if(o){ io.to(o).emit('execute_command', {command:'measure',target:n,bit:b});} await new Promise(r=>setTimeout(r,200)); break; }
        }
    }
    guardianAI.updateTrust(requestingNodeId, guardianAI.SCORE_REWARD_SUCCESS, "Successful program execution");
    io.to('admins').emit('log_message', {type: 'success', message: `Orchestration complete.`});
}

io.on('connection', (socket) => {
    socket.on('register_admin', () => {
        adminSockets.add(socket.id); socket.join('admins');
        socket.emit('log_message', { type: 'info', message: `Admin panel connected.` });
        socket.emit('log_message', { type: 'info', message: `${connectedNodes.size} nodes online.` });
    });

    socket.on('register_node', () => {
        connectedNodes.set(socket.id, { id: socket.id });
        guardianAI.trustScores.set(socket.id, guardianAI.SCORE_ON_CONNECT);
        socket.join('nodes');
        socket.emit('log_message', { message: `Registered. Ready for commands.` });
        io.to('admins').emit('log_message', { type: 'success', message: `Node Connected: ${socket.id.substring(0, 6)}... Total: ${connectedNodes.size}` });
    });

    socket.on('run_program', (data) => {
        parseAndOrchestrate(data.code, socket.id);
    });

    socket.on('ai_chat_message', (data) => {
        socket.emit('ai_chat_response', { sender: "You", text: data.message });
        guardianAI.processChatMessage(data.message, socket);
    });

    socket.on('pong', () => {});

    socket.on('disconnect', () => {
        const wasNode = connectedNodes.has(socket.id);
        if (wasNode) {
            guardianAI.trustScores.delete(socket.id);
            connectedNodes.delete(socket.id);
            io.to('admins').emit('log_message', { type: 'warn', message: `Node Disconnected: ${socket.id.substring(0, 6)}... Total: ${connectedNodes.size}` });
        }
        adminSockets.delete(socket.id);
    });
});
    
setInterval(() => {
    guardianAI.passiveRegeneration();
    const updatePayload = { 
        stats: systemStats, 
        nodeCount: connectedNodes.size,
        trustScores: Object.fromEntries(guardianAI.trustScores),
        roadmap: guardianAI.trainingRoadmap
    };
    io.to('admins').emit('system_update', updatePayload);
    for (const [nodeId, score] of guardianAI.trustScores.entries()) {
        io.to(nodeId).emit('trust_update', { score: score });
    }
}, 5000);

setInterval(() => {
    io.emit('ping');
}, 20000);

server.listen(PORT, () => {
    console.log(`QIOS Back Office is running on http://localhost:${PORT}`);
});