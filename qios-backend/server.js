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

// --- Global State ---
let connectedNodes = new Map();
let adminSockets = new Set();

// --- Main Connection Handler ---
io.on('connection', (socket) => {
    console.log(`A user connected: ${socket.id}`);

    // Admin Registration
    socket.on('register_admin', () => {
        adminSockets.add(socket.id);
        socket.join('admins');
        console.log(`Admin panel registered: ${socket.id}`);
        socket.emit('log_message', { type: 'info', message: `Admin panel connected. Monitoring network.` });
    });

    // Node Registration
    socket.on('register_node', () => {
        connectedNodes.set(socket.id, { id: socket.id });
        socket.join('nodes');
        console.log(`Node registered: ${socket.id}`);
        socket.emit('log_message', { message: `Successfully registered with Back Office.` });
        io.to('admins').emit('log_message', { type: 'success', message: `Node Connected: ${socket.id.substring(0, 6)}... Total: ${connectedNodes.size}` });
    });

    // Heartbeat
    socket.on('pong', () => {});

    // Disconnect Logic
    socket.on('disconnect', () => {
        console.log(`A user disconnected: ${socket.id}`);
        if (connectedNodes.has(socket.id)) {
            connectedNodes.delete(socket.id);
            io.to('admins').emit('log_message', { type: 'warn', message: `Node Disconnected: ${socket.id.substring(0, 6)}... Total: ${connectedNodes.size}` });
        }
        adminSockets.delete(socket.id);
    });
});

// --- System Update Loop for Admin Panel ---
setInterval(() => {
    const updatePayload = { 
        nodeCount: connectedNodes.size
    };
    io.to('admins').emit('system_update', updatePayload);
}, 2000); // Update more frequently for responsiveness

// --- Heartbeat Loop ---
setInterval(() => {
    io.emit('ping');
}, 20000);

// --- Server Start ---
server.listen(PORT, () => {
    console.log(`QIOS Back Office is running on http://localhost:${PORT}`);
});
