const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

let connectedNodes = new Map();
let adminSockets = new Set();
let systemStats = { traceability: 101, contradiction: 599, phase: 1 };

// --- ADVANCED PARSER ---
async function parseAndOrchestrate(programCode, requestingNodeId) {
    const lines = programCode.split('\n').map(line => line.trim().split('//')[0]).filter(line => line);
    const nodeList = Array.from(connectedNodes.keys());
    let particleLocations = new Map(); // Track which node owns which particle

    io.to('admins').emit('log_message', {type: 'info', message: `Orchestration started by ${requestingNodeId.substring(0,6)}...`});

    for (const line of lines) {
        const parts = line.split(/\s+/);
        const command = parts[0];

        if (command === 'particle') {
            const particleName = parts[1].replace(';', '');
            // Simple round-robin assignment for particles to nodes
            const assignedNodeId = nodeList[particleLocations.size % nodeList.length];
            particleLocations.set(particleName, assignedNodeId);
            io.to(assignedNodeId).emit('execute_command', { command: 'create_particle', target: particleName });
            await new Promise(r => setTimeout(r, 200)); // Network delay simulation
        }
        else if (command === 'hadamard') {
            const particleName = parts[1].replace(';', '');
            const nodeId = particleLocations.get(particleName);
            if (nodeId) {
                io.to(nodeId).emit('execute_command', { command: 'apply_hadamard', target: particleName });
                await new Promise(r => setTimeout(r, 200));
            }
        }
        else if (command === 'cnot') {
            const controlName = parts[1].replace(',', '');
            const targetName = parts[2].replace(';', '');
            const controlNodeId = particleLocations.get(controlName);
            const targetNodeId = particleLocations.get(targetName);

            if (controlNodeId && targetNodeId) {
                io.to('admins').emit('log_message', {type: 'info', message: `Orchestrating CNOT: ${controlName} -> ${targetName}`});
                // In a real system, nodes would communicate directly. Here, we simulate it.
                // For this simulation, we'll just log that it happened.
                io.to(controlNodeId).emit('log_message', { type: 'warn', message: `CNOT control initiated on ${controlName}.` });
                io.to(targetNodeId).emit('log_message', { type: 'warn', message: `CNOT target received on ${targetName}.` });
                await new Promise(r => setTimeout(r, 500));
            }
        }
    }
    io.to('admins').emit('log_message', {type: 'success', message: `Orchestration complete.`});
}


io.on('connection', (socket) => {
    // console.log(`A user connected: ${socket.id}`);
    
    socket.on('register_admin', () => {
        console.log(`Admin UI registered: ${socket.id}`);
        adminSockets.add(socket.id);
        socket.join('admins');
        socket.emit('log_message', { type: 'info', message: `Admin panel connected. Monitoring network.` });
        socket.emit('log_message', { type: 'info', message: `${connectedNodes.size} nodes currently online.` });
    });

    socket.on('register_node', () => {
        console.log(`Quantum Node registered: ${socket.id}`);
        connectedNodes.set(socket.id, { id: socket.id, particles: [] });
        socket.join('nodes');
        socket.emit('log_message', { message: `Registered with Back Office. Ready for commands.` });
        io.to('admins').emit('log_message', { type: 'success', message: `Node Connected: ${socket.id.substring(0, 6)}... Total nodes: ${connectedNodes.size}` });
    });

    socket.on('run_program', (data) => {
        console.log(`Received program from node ${socket.id}`);
        if (connectedNodes.size < 2) {
            io.to(socket.id).emit('log_message', { type: 'error', message: 'Error: At least 2 nodes must be connected.' });
            return;
        }
        // Use the new advanced parser
        parseAndOrchestrate(data.code, socket.id);
    });
    
    socket.on('pong', () => {});

    socket.on('disconnect', () => {
        // console.log(`User disconnected: ${socket.id}`);
        const wasNode = connectedNodes.has(socket.id);
        if (wasNode) {
            connectedNodes.delete(socket.id);
            io.to('admins').emit('log_message', { type: 'warn', message: `Node Disconnected: ${socket.id.substring(0, 6)}... Total nodes: ${connectedNodes.size}` });
        }
        if (adminSockets.has(socket.id)) {
            adminSockets.delete(socket.id);
        }
    });
});
    
setInterval(() => {
    systemStats.traceability += Math.random() * 2 - 1;
    systemStats.contradiction += Math.random() * 4 - 2;
    const updatePayload = { stats: systemStats, nodeCount: connectedNodes.size };
    io.to('admins').emit('system_update', updatePayload);
}, 2500);

setInterval(() => { io.emit('ping'); }, 20000);

server.listen(PORT, () => {
    console.log(`QIOS Back Office is running on http://localhost:${PORT}`);
});