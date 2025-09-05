const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all connections for simplicity
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Serve the static HTML files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// --- Back Office State ---
let connectedNodes = new Map();
let adminSockets = new Set();
let systemStats = {
    traceability: 101,
    contradiction: 599,
    phase: 1
};

// --- Main Server Logic ---
io.on('connection', (socket) => {
    console.log(`A user connected: ${socket.id}`);

    // --- Admin Registration ---
    socket.on('register_admin', () => {
        console.log(`Admin UI registered: ${socket.id}`);
        adminSockets.add(socket.id);
        socket.join('admins');
        socket.emit('log_message', { type: 'info', message: `Admin panel connected. Monitoring network.` });
        socket.emit('log_message', { type: 'info', message: `${connectedNodes.size} nodes currently online.` });
    });

    // --- Node Registration ---
    socket.on('register_node', () => {
        console.log(`Quantum Node registered: ${socket.id}`);
        connectedNodes.set(socket.id, { id: socket.id, particles: [] });
        socket.join('nodes');
        socket.emit('log_message', { message: `Registered with Back Office. Ready for commands.` });
        io.to('admins').emit('log_message', { type: 'success', message: `Node Connected: ${socket.id.substring(0, 6)}... Total nodes: ${connectedNodes.size}` });
    });

    // --- Program Execution Logic ---
    socket.on('run_program', (data) => {
        console.log(`Received program from node ${socket.id}`);
        const nodeList = Array.from(connectedNodes.keys());

        if (nodeList.length < 2) {
            const errorMsg = 'Error: At least 2 nodes must be connected to run this protocol.';
            console.log(errorMsg);
            io.to(socket.id).emit('log_message', { type: 'error', message: errorMsg });
            return;
        }

        const aliceNodeId = socket.id;
        const bobNodeId = nodeList.find(id => id !== aliceNodeId);

        io.to('admins').emit('log_message', {type: 'info', message: `Orchestrating entanglement between ${aliceNodeId.substring(0,6)}... and ${bobNodeId.substring(0,6)}...`});
        io.to(aliceNodeId).emit('log_message', { type: 'warn', message: 'Orchestrator: Creating particle alice_q1 on your node.' });
        io.to(bobNodeId).emit('log_message', { type: 'warn', message: 'Orchestrator: Creating particle bob_q1 on your node.' });
        
        setTimeout(() => {
             io.to(aliceNodeId).emit('execute_command', { command: 'apply_hadamard', target: 'alice_q1'});
             io.to(aliceNodeId).emit('log_message', { type: 'warn', message: 'Orchestrator: Applying Hadamard to alice_q1.' });
        }, 1000);
        
         setTimeout(() => {
            io.to(aliceNodeId).emit('log_message', { type: 'warn', message: 'Orchestrator: Initiating CNOT between your alice_q1 and bob_q1...' });
            io.to(bobNodeId).emit('log_message', { type: 'warn', message: 'Orchestrator: Receiving CNOT from another node...' });
            io.to('admins').emit('log_message', {type: 'success', message: `Entanglement protocol successful.`});
        }, 2000);
    });
    
    // --- NEW: HEARTBEAT PONG LISTENER ---
    // Listens for the client's heartbeat response.
    socket.on('pong', () => {
        // This confirms the client is still alive. We don't need to do anything here,
        // but it's useful for debugging or tracking latency in the future.
        // console.log(`Received pong from ${socket.id}`);
    });

    // --- Disconnection Logic ---
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
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
    
// --- Continuous Simulation Loop for Admin Panel ---
setInterval(() => {
    systemStats.traceability += Math.random() * 2 - 1;
    systemStats.contradiction += Math.random() * 4 - 2;
    const updatePayload = { stats: systemStats, nodeCount: connectedNodes.size };
    io.to('admins').emit('system_update', updatePayload);
}, 2500);

// --- NEW: HEARTBEAT PING SENDER ---
// This keeps all client connections alive.
setInterval(() => {
    io.emit('ping');
}, 20000); // Every 20 seconds

server.listen(PORT, () => {
    console.log(`QIOS Back Office is running on http://localhost:${PORT}`);
});