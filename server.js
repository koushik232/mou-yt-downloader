const express = require('express');
const sanitize = require('sanitize-filename');
const contentDisposition = require('content-disposition');
const YTDlpWrap = require('yt-dlp-wrap').default;
const path = require('path');
const fs = require('fs');
const { PassThrough } = require('stream');

const app = express();
const PORT = process.env.PORT || 3000;

const ytDlpWrap = new YTDlpWrap();

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

app.post('/download', async (req, res) => {
  const { url, type } = req.body;
  if (!url) return res.status(400).send('No URL provided');

  try {
    // Step 1: Get video title
    let filename = 'video';
    const meta = await ytDlpWrap.execPromise([
      url,
      '--get-title'
    ]);
    filename = sanitize(meta.trim()) || 'video';

    // Step 2: Prepare download args
    const args = [
      url,
      '-o', '-',
      '--progress-template', 'downloaded:%(progress._percent_str)s'
    ];

    if (type === 'audio') {
      args.unshift('-f', 'bestaudio');
    } else {
      args.unshift('-f', 'best');
    }

    // Step 3: Set response headers
    res.setHeader('Content-Disposition', contentDisposition(`${filename}.${type === 'audio' ? 'mp3' : 'mp4'}`));
    res.setHeader('Content-Type', 'application/octet-stream');
    res.flushHeaders();

    // Step 4: Stream to client
    const downloader = ytDlpWrap.exec(args);

    downloader.stderr.on('data', (chunk) => {
      const line = chunk.toString();
      const match = line.match(/downloaded:([0-9.]+%)/);
      if (match) {
        currentProgress = match[1];
      }
    });

    downloader.stdout.pipe(res);

    downloader.on('close', () => {
      currentProgress = 'done';
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('Download failed.');
  }
});

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
