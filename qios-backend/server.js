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
let waitingPlayer = null;
let gameSessions = new Map();

// --- Main Connection Handler ---
io.on('connection', (socket) => {
    console.log(`A user connected: ${socket.id}`);

    socket.on('register_admin', () => {
        adminSockets.add(socket.id);
        socket.join('admins');
        socket.emit('log_message', { type: 'info', message: `Admin panel connected.` });
    });

    socket.on('register_node', () => {
        connectedNodes.set(socket.id, { id: socket.id, sessionId: null });
        socket.emit('log_message', { message: `Successfully registered with Back Office.` });
        io.to('admins').emit('log_message', { type: 'success', message: `Node Connected: ${socket.id.substring(0, 6)}... Total: ${connectedNodes.size}` });
    });

    // --- PVP GAME HANDLER ---
    socket.on('find_game', () => {
        if (waitingPlayer && waitingPlayer !== socket.id && connectedNodes.has(waitingPlayer)) {
            const player1 = waitingPlayer;
            const player2 = socket.id;
            const sessionId = `game_pvp_${Date.now()}`;
            
            const newSession = {
                player1, player2,
                fruit: { x: 15, y: 15 },
                scores: { [player1]: 0, [player2]: 0 },
                fruitEaten: false
            };
            gameSessions.set(sessionId, newSession);
            
            connectedNodes.get(player1).sessionId = sessionId;
            connectedNodes.get(player2).sessionId = sessionId;
            waitingPlayer = null;

            io.to(player1).emit('game_start', { partnerId: player2, scores: newSession.scores });
            io.to(player2).emit('game_start', { partnerId: player1, scores: newSession.scores });
            io.to(player1).to(player2).emit('new_fruit', newSession.fruit);
            io.to('admins').emit('log_message', { type: 'info', message: `PVP Game started: ${sessionId}` });

        } else {
            waitingPlayer = socket.id;
            socket.emit('log_message', { type: 'info', message: 'You are waiting for a partner...' });
        }
    });

    // --- PLAYER VS AI GAME HANDLER ---
    socket.on('find_ai_game', () => {
        const player1 = socket.id;
        const player2_ai = `guardian_ai_${socket.id.substring(0,4)}`;
        const sessionId = `game_pva_${Date.now()}`;

        const newSession = {
            player1, player2: player2_ai,
            fruit: { x: 15, y: 15 },
            scores: { [player1]: 0, [player2_ai]: 0 },
            fruitEaten: false,
            isAiGame: true,
            aiSnake: [{x: 5, y: 5}],
            aiInterval: null
        };
        gameSessions.set(sessionId, newSession);
        connectedNodes.get(player1).sessionId = sessionId;

        io.to(player1).emit('game_start', { partnerId: player2_ai, scores: newSession.scores });
        io.to(player1).emit('new_fruit', newSession.fruit);
        io.to('admins').emit('log_message', { type: 'info', message: `PVA Game started: ${sessionId}` });
        
        newSession.aiInterval = setInterval(() => aiBrain(sessionId), 150);
    });

    socket.on('ate_food', (data) => {
        const node = connectedNodes.get(socket.id);
        if (!node || !node.sessionId) return;
        const session = gameSessions.get(node.sessionId);
        if (!session || session.fruitEaten) return;

        session.fruitEaten = true;
        session.scores[socket.id]++;

        const winnerId = socket.id;
        const loserId = (winnerId === session.player1) ? session.player2 : session.player1;

        io.to(winnerId).emit('victory', { scores: session.scores });
        if (connectedNodes.has(loserId)) {
            io.to(loserId).emit('collapse', { scores: session.scores });
        }
        
        io.to('admins').emit('log_message', { type: 'info', message: `Node ${winnerId.substring(0,3)} measured fruit.` });

        setTimeout(() => {
            if (gameSessions.has(node.sessionId)) {
                const currentSession = gameSessions.get(node.sessionId);
                currentSession.fruit = { x: Math.floor(Math.random() * 20), y: Math.floor(Math.random() * 20) };
                currentSession.fruitEaten = false;
                io.to(currentSession.player1).to(currentSession.player2).emit('new_fruit', currentSession.fruit);
            }
        }, 500);
    });
    
    socket.on('game_over', () => {
        const node = connectedNodes.get(socket.id);
        if (!node || !node.sessionId) return;
        
        const session = gameSessions.get(node.sessionId);
        if (!session) return;

        const winnerId = (socket.id === session.player1) ? session.player2 : session.player1;
        if (connectedNodes.has(winnerId)) {
             io.to(winnerId).emit('log_message', { type: 'success', message: 'You win! Your opponent collided.' });
        }
        
        if (session.isAiGame) clearInterval(session.aiInterval);
        
        if(connectedNodes.has(session.player1)) connectedNodes.get(session.player1).sessionId = null;
        if(connectedNodes.has(session.player2)) connectedNodes.get(session.player2).sessionId = null;
        gameSessions.delete(node.sessionId);
        io.to('admins').emit('log_message', { type: 'warn', message: `Game over: ${node.sessionId}` });
    });

    socket.on('pong', () => {});

    socket.on('disconnect', () => {
        const wasNode = connectedNodes.has(socket.id);
        if(wasNode) {
            if (waitingPlayer === socket.id) waitingPlayer = null;
            const node = connectedNodes.get(socket.id);
            if (node && node.sessionId) {
                const session = gameSessions.get(node.sessionId);
                if (session) {
                    if (session.isAiGame) {
                        clearInterval(session.aiInterval);
                    } else {
                        const partnerId = (socket.id === session.player1) ? session.player2 : session.player1;
                        if(connectedNodes.has(partnerId)) {
                            io.to(partnerId).emit('log_message', { type: 'error', message: 'Your partner has disconnected. Game over.' });
                            connectedNodes.get(partnerId).sessionId = null;
                        }
                    }
                    gameSessions.delete(node.sessionId);
                }
            }
            connectedNodes.delete(socket.id);
            io.to('admins').emit('log_message', { type: 'warn', message: `Node Disconnected: ${socket.id.substring(0, 6)}... Total: ${connectedNodes.size}` });
        }
    });
});

// --- AI "Brain" Logic ---
function aiBrain(sessionId) {
    const session = gameSessions.get(sessionId);
    if (!session || !session.isAiGame || isNaN(session.fruit.x)) return;

    let head = {...session.aiSnake[0]};
    let dx = session.fruit.x - head.x;
    let dy = session.fruit.y - head.y;
    
    let moveDirection;
    if (Math.abs(dx) > Math.abs(dy)) {
        moveDirection = dx > 0 ? 'right' : 'left';
    } else {
        moveDirection = dy > 0 ? 'down' : 'up';
    }
    
    switch (moveDirection) {
        case 'right': head.x++; break; case 'left': head.x--; break;
        case 'up': head.y--; break; case 'down': head.y++; break;
    }
    session.aiSnake.unshift(head);

    if (head.x === session.fruit.x && head.y === session.fruit.y) {
        if (!session.fruitEaten) {
            session.fruitEaten = true;
            session.scores[session.player2]++;
            io.to(session.player1).emit('collapse', { scores: session.scores });
            io.to('admins').emit('log_message', { type: 'info', message: `AI measured fruit in game ${sessionId}.` });

            setTimeout(() => {
                if (gameSessions.has(sessionId)) {
                    const currentSession = gameSessions.get(sessionId);
                    currentSession.fruit = { x: Math.floor(Math.random() * 20), y: Math.floor(Math.random() * 20) };
                    currentSession.fruitEaten = false;
                    io.to(currentSession.player1).emit('new_fruit', currentSession.fruit);
                }
            }, 500);
        }
    } else {
        session.aiSnake.pop();
    }
}

// --- System Loops & Server Start ---
setInterval(() => {
    const updatePayload = { 
        nodeCount: connectedNodes.size 
        // We can add more stats here later
    };
    io.to('admins').emit('system_update', updatePayload);
}, 2000);

setInterval(() => {
    io.emit('ping');
}, 20000);

server.listen(PORT, () => {
    console.log(`QIOS Back Office is running.`);
});
