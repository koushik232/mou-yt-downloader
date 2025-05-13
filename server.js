const express = require('express');
const ytdlp = require('yt-dlp-exec');
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

app.post('/download', async (req, res) => {
  const { url, type } = req.body;
  if (!url) return res.status(400).send('No URL provided');

  // Prepare the proxy URL for yt-dlp to fetch from.
  const proxyUrl = `https://yt-downkoader.pages.dev/?url=${encodeURIComponent(url)}`;
  let filename = 'video.mp4';

  // Fetch the filename using yt-dlp-exec.
  try {
    const meta = await ytdlp(proxyUrl, {
      getFilename: true,
      output: '%(title)s.%(ext)s'
    });
    filename = sanitize(meta.trim());
  } catch (err) {
    console.error('Filename fetch error:', err);
  }

  // Build arguments for the download process.
  const args = [
    '-o', '-',            // Output to stdout.
    proxyUrl,
    '-f', type === 'audio' ? 'bestaudio' : 'best',
    '--progress-template', 'downloaded:%(progress._percent_str)s'
  ];

  try {
    // Start the download process.
    const proc = ytdlp.raw(args);

    res.setHeader('Content-Disposition', contentDisposition(filename));
    res.setHeader('Content-Type', 'application/octet-stream');
    res.flushHeaders();

    proc.stdout.pipe(res);

    proc.stderr.on('data', chunk => {
      const line = chunk.toString();
      const match = line.match(/downloaded:([0-9.]+%)/);
      if (match) {
        currentProgress = match[1];
      }
    });

    proc.on('close', () => {
      currentProgress = 'done';
    });
  } catch (err) {
    console.error('Download process error:', err);
    res.status(500).send('Download failed');
  }
});

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
