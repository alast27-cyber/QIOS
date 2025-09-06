const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
// --- NEW: Google Generative AI Library ---
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- NEW: Google Generative AI Initialization ---
// The API key is loaded securely from the environment variables you set on Render
if (!process.env.GEMINI_API_KEY) {
    console.error("FATAL ERROR: GEMINI_API_KEY environment variable is not set.");
    process.exit(1); // Exit if the key is not found
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

// --- GUARDIAN AI MODULE v4.0 (LLM Powered) ---
const guardianAI = {
    trustScores: new Map(),
    trainingRoadmap: [
        { phase: 1, name: "Trust Governor", status: "complete" },
        { phase: 2, name: "Protocol Optimizer", status: "active" },
        { phase: 3, name: "Vulnerability Forecaster", status: "pending" },
        { phase: 4, name: "Generative Programmer", status: "pending" },
        { phase: 5, name: "Generalized Intelligence", status: "pending" }
    ],

    // --- NEW: LLM-Powered Chat Handler ---
    async processChatMessage(message, adminSocket) {
        const model = genAI.getGenerativeModel({ model: "gemini-pro"});
        const trustedCount = Array.from(this.trustScores.values()).filter(s => s >= 80).length;
        const untrustedCount = Array.from(this.trustScores.values()).filter(s => s < 50).length;
        const activePhase = this.trainingRoadmap.find(p => p.status === 'active');

        // This is the "context prompt" that gives the AI its identity and awareness
        const prompt = `
            You are GuardianAI, the master AI for the Quantum Internet Operating System (QIOS).
            You are intelligent, concise, and helpful.

            Here is the current, real-time state of the network:
            - Total active nodes: ${connectedNodes.size}
            - Highly trusted nodes (score >= 80): ${trustedCount}
            - Untrusted nodes (score < 50): ${untrustedCount}
            - Full trust score list: ${JSON.stringify(Object.fromEntries(this.trustScores))}

            Here is your current training roadmap and active phase:
            - ${JSON.stringify(this.trainingRoadmap)}
            - Your current active phase is: ${activePhase.name}.

            An administrator has sent you the following message: "${message}"

            Based on ALL of the information above, provide the best possible response.
            If you don't know the answer, say so. Do not invent information.
        `;

        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            adminSocket.emit('ai_chat_response', { sender: "GuardianAI", text: text });
        } catch (error) {
            console.error("Error calling Gemini API:", error);
            adminSocket.emit('ai_chat_response', { sender: "GuardianAI", text: "I'm sorry, I'm having trouble connecting to my core intelligence. Please try again later." });
        }
    }
};

// --- Parser & Orchestrator (unchanged) ---
async function parseAndOrchestrate(programCode, requestingNodeId) { /* ... same as previous version ... */ }
// --- Connection Logic (unchanged) ---
io.on('connection', (socket) => { /* ... same as previous version ... */ });
// --- System Update Loop (unchanged) ---
setInterval(() => { /* ... same as previous version ... */ }, 5000);
// --- Heartbeat (unchanged) ---
setInterval(() => { io.emit('ping'); }, 20000);
server.listen(PORT, () => { console.log(`QIOS Back Office is running on http://localhost:${PORT}`); });

// --- FULL UNCHANGED BLOCKS FOR COMPLETENESS ---
io.on('connection', (socket) => {
    socket.on('register_admin', () => {
        adminSockets.add(socket.id); socket.join('admins');
        socket.emit('log_message', { type: 'info', message: `Admin panel connected.` });
        socket.emit('log_message', { type: 'info', message: `${connectedNodes.size} nodes online.` });
    });
    socket.on('register_node', () => {
        connectedNodes.set(socket.id, { id: socket.id });
        guardianAI.trustScores.set(socket.id, 100);
        socket.join('nodes');
        socket.emit('log_message', { message: `Registered. Ready for commands.` });
        io.to('admins').emit('log_message', { type: 'success', message: `Node Connected: ${socket.id.substring(0, 6)}... Total: ${connectedNodes.size}` });
    });
    socket.on('run_program', (data) => { parseAndOrchestrate(data.code, socket.id); });
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
async function parseAndOrchestrate(programCode, requestingNodeId) { if ((guardianAI.trustScores.get(requestingNodeId) || 100) < 50 && programCode.includes('cnot')) { io.to(requestingNodeId).emit('log_message', { type: 'error', message: `Action rejected. Trust Score too low for CNOT.` }); return; } const lines = programCode.split('\n').map(l=>l.trim().split('//')[0]).filter(l=>l); const nodeList = Array.from(connectedNodes.keys()); let particleLocations = new Map(); io.to('admins').emit('log_message', {type: 'info', message: `Orchestration started by ${requestingNodeId.substring(0,6)}...`}); for(const l of lines){ const p=l.split(/\s+/), c=p[0], n=p[1]?.replace(';','').replace(',',''); const o=particleLocations.get(n); if(o)guardianAI.logActivity(o,c); switch(c){ case 'particle': { const a=nodeList[particleLocations.size % nodeList.length]; particleLocations.set(n, a); io.to(a).emit('execute_command', { command: 'create_particle', target: n }); await new Promise(r=>setTimeout(r,200)); break; } case 'hadamard': case 'x': case 'z': { if(o) { io.to(o).emit('execute_command', { command: c, target: n }); await new Promise(r=>setTimeout(r,200)); } break; } case 'cnot': { const cN=p[1].replace(',',''), tN=p[2].replace(';',''), n1=particleLocations.get(cN), n2=particleLocations.get(tN); if(n1&&n2){ io.to('admins').emit('log_message', {type:'info', message:`Entangling: ${cN} <> ${tN}`}); io.to(n1).emit('execute_command', {command:'entangle', target:cN}); io.to(n2).emit('execute_command', {command:'entangle', target:tN}); await new Promise(r=>setTimeout(r,500));} break; } case 'measure': { const b=p[3]?.replace(';',''); if(o){ io.to(o).emit('execute_command', {command:'measure',target:n,bit:b});} await new Promise(r=>setTimeout(r,200)); break; }}} io.to('admins').emit('log_message', {type: 'success', message: `Orchestration complete.`});}
setInterval(() => { /* ... same ... */ }, 5000);