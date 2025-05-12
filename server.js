const express = require('express');
const { spawn } = require('child_process');
const sanitize = require('sanitize-filename');
const contentDisposition = require('content-disposition');
const app = express();
const PORT = process.env.PORT || 3000;

let currentProgress = 'starting';

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.get('/progress', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const interval = setInterval(() => {
    res.write(`data: ${currentProgress}\n\n`);
  }, 500);

  req.on('close', () => clearInterval(interval));
});

app.post('/download', (req, res) => {
  const { url, type } = req.body;
  if (!url) return res.status(400).send('No URL provided');

  const encodedUrl = encodeURIComponent(url);
  const proxyUrl = `https://yt-downkoader.pages.dev/?url=${encodedUrl}`;

  let filename = 'video';

  const meta = spawn('./bin/yt-dlp', ['--get-filename', '-o', '%(title)s.%(ext)s', proxyUrl]);

  meta.stdout.on('data', data => {
    filename = sanitize(data.toString().trim()) || 'video';
  });

  meta.on('close', () => {
    const args = ['-o', '-', proxyUrl];

    if (type === 'audio') {
      args.unshift('-f', 'bestaudio');
    } else {
      args.unshift('-f', 'best');
    }

    args.push('--progress-template', 'downloaded:%(progress._percent_str)s');

    const downloader = spawn('./bin/yt-dlp', args);
    res.setHeader('Content-Disposition', contentDisposition(filename));
    res.setHeader('Content-Type', 'application/octet-stream');
    res.flushHeaders();

    downloader.stdout.pipe(res);

    downloader.stderr.on('data', chunk => {
      const line = chunk.toString();
      const match = line.match(/downloaded:([0-9.]+%)/);
      if (match) {
        currentProgress = match[1];
      }
    });

    downloader.on('close', () => {
      currentProgress = 'done';
    });
  });
});

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
