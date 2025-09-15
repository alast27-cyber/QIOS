// server.js for QIOS backend (Node.js + Express + Socket.IO)

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const port = process.env.PORT || 10000;

// Serve static files (HTML, JS, CSS) from 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Simple health check route
app.get('/health', (req, res) => res.send('OK'));

// Create HTTP server and bind Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Set this to your frontend domain(s) in production!
    methods: ['GET', 'POST']
  }
});

// --- Socket.IO logic for CHIPS Browser (Quantum Snake and Admin Panel) ---

let waitingPlayer = null;

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Node log example
  socket.emit('log_message', 'Welcome to the QIOS Back Office!');

  // --- PVP Matchmaking ---
  socket.on('find_game', () => {
    if (waitingPlayer && waitingPlayer !== socket) {
      // Match found
      socket.partner = waitingPlayer;
      waitingPlayer.partner = socket;
      socket.emit('game_start', { partnerId: waitingPlayer.id });
      waitingPlayer.emit('game_start', { partnerId: socket.id });
      waitingPlayer = null;
    } else {
      // Wait for another player
      waitingPlayer = socket;
    }
  });

  // --- PVA (AI) Matchmaking ---
  socket.on('find_ai_game', () => {
    socket.emit('ai_game_start');
    // You can implement AI logic here!
  });

  // --- Game Updates ---
  socket.on('player_update', (data) => {
    if (socket.partner) {
      socket.partner.emit('opponent_update', {
        snake: data.snake,
        fruit: data.fruit,
        score: data.score
      });
    }
  });

  socket.on('ate_fruit', (data) => {
    // Broadcast new fruit to both players (or AI logic)
    io.to(socket.id).emit('new_fruit', { fruit: randomFruit() });
    if (socket.partner) socket.partner.emit('new_fruit', { fruit: randomFruit() });
  });

  socket.on('score_update', (data) => {
    if (socket.partner) {
      socket.partner.emit('score_update', {
        myScore: data.opponentScore,
        opponentScore: data.myScore
      });
    }
  });

  socket.on('game_over', () => {
    if (socket.partner) {
      socket.partner.emit('game_over', { reason: 'Opponent lost' });
      socket.partner.partner = null;
      socket.partner = null;
    }
  });

  // --- Keepalive ---
  socket.on('ping', () => {
    socket.emit('pong');
  });

  // --- Cleanup ---
  socket.on('disconnect', () => {
    if (waitingPlayer === socket) {
      waitingPlayer = null;
    }
    if (socket.partner) {
      socket.partner.emit('game_over', { reason: 'Opponent disconnected' });
      socket.partner.partner = null;
    }
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Example random fruit generator for the snake game
function randomFruit() {
  const gridSize = 20;
  return {
    x: Math.floor(Math.random() * gridSize),
    y: Math.floor(Math.random() * gridSize)
  };
}

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port} (or your Render public URL)`);
});
