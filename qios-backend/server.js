const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 10000;

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Default route - serve admin.html for /admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});


