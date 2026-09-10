const https = require('https');
const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

// Start Next.js dev server
const nextDev = spawn('pnpm', ['run', 'dev'], {
  shell: true,
  stdio: 'inherit'
});

// Wait a bit for Next.js to start
setTimeout(() => {
  const options = {
    pfx: fs.readFileSync(path.join(__dirname, '..', '.certs', 'localhost.pfx')),
    passphrase: 'mylesnet'
  };

  https.createServer(options, (req, res) => {
    // Proxy requests to Next.js on port 3001
    const proxyReq = require('http').request({
      hostname: 'localhost',
      port: 3001,
      path: req.url,
      method: req.method,
      headers: req.headers
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('Proxy error:', err);
      res.writeHead(500);
      res.end('Proxy error');
    });

    req.pipe(proxyReq);
  }).listen(3000, () => {
    console.log('HTTPS server running on https://localhost:3000');
    console.log('Proxying to Next.js on http://localhost:3001');
  });
}, 3000);

// Handle cleanup
process.on('SIGINT', () => {
  nextDev.kill();
  process.exit();
});