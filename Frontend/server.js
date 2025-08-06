const express = require('express');
const http = require('http');
const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 4000;

// Serve static files from the "public" directory
app.use(express.static('public'));

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});