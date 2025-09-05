const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

let connectedNodes = new Map();
let adminSockets = new Set();
let systemStats = { traceability: 101, contradiction: 599, phase: 1 };

// --- GUARDIAN AI MODULE ---
const guardianAI = {
    activityLog: new Map(),
    MEASURE_THRESHOLD: 5,
    TIME_WINDOW_MS: 5000,
    
    logActivity(nodeId, command) {
        if (command !== 'measure') return;

        if (!this.activityLog.has(nodeId)) {
            this.activityLog.set(nodeId, []);
        }

        const now = Date.now();
        const nodeTimestamps = this.activityLog.get(nodeId);
        nodeTimestamps.push(now);

        // Keep the log within the time window
        const recentTimestamps = nodeTimestamps.filter(ts => now - ts < this.TIME_WINDOW_MS);
        this.activityLog.set(nodeId, recentTimestamps);

        if (recentTimestamps.length >= this.MEASURE_THRESHOLD) {
            this.triggerAlert(nodeId);
            this.activityLog.set(nodeId, []); // Reset after triggering
        }
    },
    
    triggerAlert(nodeId) {
        const alertMessage = `GuardianAI Alert: Measurement spam detected from Node ${nodeId.substring(0,6)}...`;
        console.log(alertMessage);
        io.to('admins').emit('log_message', { type: 'warn', message: alertMessage });
        // In the future, this could trigger a quarantine
    }
};

// --- ADVANCED PARSER & ORCHESTRATOR ---
async function parseAndOrchestrate(programCode, requestingNodeId) {
    const lines = programCode.split('\n').map(line => line.trim().split('//')[0]).filter(line => line);
    const nodeList = Array.from(connectedNodes.keys());
    let particleLocations = new Map();

    io.to('admins').emit('log_message', {type: 'info', message: `Orchestration started by ${requestingNodeId.substring(0,6)}...`});

    for (const line of lines) {
        const parts = line.split(/\s+/);
        const command = parts[0];
        const particleName = parts[1]?.replace(';', '').replace(',', '');
        
        // AI Monitoring Hook
        const ownerNodeId = particleLocations.get(particleName);
        if(ownerNodeId) guardianAI.logActivity(ownerNodeId, command);

        if (command === 'particle') {
            const assignedNodeId = nodeList[particleLocations.size % nodeList.length];
            particleLocations.set(particleName, assignedNodeId);
            io.to(assignedNodeId).emit('execute_command', { command: 'create_particle', target: particleName });
            await new Promise(r => setTimeout(r, 200));
        }
        else if (command === 'hadamard') {
            if (ownerNodeId) {
                io.to(ownerNodeId).emit('execute_command', { command: 'apply_hadamard', target: particleName });
                await new Promise(r => setTimeout(r, 200));
            }
        }
        else if (command === 'cnot') {
            const controlName = parts[1].replace(',', '');
            const targetName = parts[2].replace(';', '');
            const controlNodeId = particleLocations.get(controlName);
            const targetNodeId = particleLocations.get(targetName);

            if (controlNodeId && targetNodeId) {
                io.to('admins').emit('log_message', {type: 'info', message: `Orchestrating Entanglement: ${controlName} <> ${targetName}`});
                
                // Send specific entanglement commands to the nodes
                io.to(controlNodeId).emit('execute_command', { command: 'entangle', target: controlName, partnerId: targetNodeId });
                io.to(targetNodeId).emit('execute_command', { command: 'entangle', target: targetName, partnerId: controlNodeId });

                await new Promise(r => setTimeout(r, 500));
            }
        }
    }
    io.to('admins').emit('log_message', {type: 'success', message: `Orchestration complete.`});
}


io.on('connection', (socket) => {
    socket.on('register_admin', () => {
        console.log(`Admin UI registered: ${socket.id}`);
        adminSockets.add(socket.id);
        socket.join('admins');
        socket.emit('log_message', { type: 'info', message: `Admin panel connected. Monitoring network.` });
        socket.emit('log_message', { type: 'info', message: `${connectedNodes.size} nodes currently online.` });
    });

    socket.on('register_node', () => {
        console.log(`Quantum Node registered: ${socket.id}`);
        connectedNodes.set(socket.id, { id: socket.id });
        socket.join('nodes');
        socket.emit('log_message', { message: `Registered. Ready for commands.` });
        io.to('admins').emit('log_message', { type: 'success', message: `Node Connected: ${socket.id.substring(0, 6)}... Total: ${connectedNodes.size}` });
    });

    socket.on('run_program', (data) => {
        console.log(`Received program from node ${socket.id}`);
        if (connectedNodes.size < 2) {
            io.to(socket.id).emit('log_message', { type: 'error', message: 'Error: At least 2 nodes required.' });
            return;
        }
        parseAndOrchestrate(data.code, socket.id);
    });

    socket.on('pong', () => {});

    socket.on('disconnect', () => {
        const wasNode = connectedNodes.has(socket.id);
        if (wasNode) {
            connectedNodes.delete(socket.id);
            io.to('admins').emit('log_message', { type: 'warn', message: `Node Disconnected: ${socket.id.substring(0, 6)}... Total: ${connectedNodes.size}` });
        }
        adminSockets.delete(socket.id);
    });
});
    
setInterval(() => {
    systemStats.traceability += Math.random() * 2 - 1;
    systemStats.contradiction += Math.random() * 4 - 2;
    const updatePayload = { stats: systemStats, nodeCount: connectedNodes.size };
    io.to('admins').emit('system_update', updatePayload);
}, 2500);

setInterval(() => {
    io.emit('ping');
}, 20000);

server.listen(PORT, () => {
    console.log(`QIOS Back Office is running on http://localhost:${PORT}`);
});