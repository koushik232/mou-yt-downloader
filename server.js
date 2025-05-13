const express = require('express');
const ytdlp = require('youtube-dl-exec');
const sanitize = require('sanitize-filename');
const contentDisposition = require('content-disposition');
const app = express();
const PORT = process.env.PORT || 3000;

let ffmpegPath;
try {
  ffmpegPath = require('ffmpeg-static');
  process.env.FFMPEG_PATH = ffmpegPath;
  console.log('Using ffmpeg-static');
} catch (e) {
  console.warn('ffmpeg-static not available. Using system ffmpeg if available.');
}

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

  let filename = 'video.mp4';
  const format = type === 'audio' ? 'bestaudio' : 'best';

  try {
    const meta = await ytdlp(url, {
      dumpSingleJson: true
    });
    if (meta && meta.title) {
      const ext = type === 'audio' ? 'mp3' : (meta.ext || 'mp4');
      filename = sanitize(`${meta.title}.${ext}`);
    }
  } catch (err) {
    console.error('Error fetching metadata:', err);
  }

  res.setHeader('Content-Disposition', contentDisposition(filename));
  res.setHeader('Content-Type', 'application/octet-stream');
  res.flushHeaders();

  const proc = ytdlp.raw(url, {
    format,
    output: '-',
    ...(ffmpegPath && { ffmpegLocation: ffmpegPath }),
    ...(type === 'audio' && {
      extractAudio: true,
      audioFormat: 'mp3',
      audioQuality: '0'
    }),
    'progress-template': 'downloaded:%(progress._percent_str)s'
  });

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

  proc.on('error', (err) => {
    console.error('Download error:', err);
    res.status(500).send('Download failed.');
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
