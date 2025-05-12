const express = require('express');
const fs = require('fs');
const path = require('path');
const sanitize = require('sanitize-filename');
const contentDisposition = require('content-disposition');
const YTDlpWrap = require('yt-dlp-wrap').default;

const app = express();
const PORT = process.env.PORT || 3000;

let currentProgress = 'starting';
const ytDlpPath = './bin/yt-dlp'; // Make sure bin/yt-dlp exists and is executable
const ytDlpWrap = new YTDlpWrap(ytDlpPath);

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

  // Get filename
  ytDlpWrap.execPromise(['--get-filename', '-o', '%(title)s.%(ext)s', url])
    .then(rawFilename => {
      const filename = sanitize(rawFilename.trim());
      const args = ['-o', '-', url];

      if (type === 'audio') {
        args.unshift('-f', 'bestaudio');
      } else {
        args.unshift('-f', 'best');
      }

      args.push('--progress-template', 'downloaded:%(progress._percent_str)s');

      res.setHeader('Content-Disposition', contentDisposition(filename));
      res.setHeader('Content-Type', 'application/octet-stream');
      res.flushHeaders();

      const downloader = ytDlpWrap.exec(args);

      downloader.stdout.pipe(res);

      downloader.stderr.on('data', chunk => {
        const match = chunk.toString().match(/downloaded:([0-9.]+%)/);
        if (match) {
          currentProgress = match[1];
        }
      });

      downloader.on('close', () => {
        currentProgress = 'done';
      });
    })
    .catch(err => {
      console.error(err);
      res.status(500).send('Download failed');
    });
});

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
