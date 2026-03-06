const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 3000;

const MIME = {
    '.html': 'text/html',
    '.css':  'text/css',
    '.js':   'application/javascript',
    '.json': 'application/json',
    '.png':  'image/png',
    '.ico':  'image/x-icon',
};

http.createServer((req, res) => {
    const url      = req.url === '/' ? '/index.html' : req.url;
    const filePath = path.join(__dirname, url);
    const ext      = path.extname(filePath);

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found');
        } else {
            res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
            res.end(data);
        }
    });
}).listen(PORT, () => {
    console.log(`Listening on http://localhost:${PORT}`);
});
