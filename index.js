const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

// Serve the frontend
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>YouTube Audio Downloader</title>
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-100 text-gray-800">
      <div class="min-h-screen flex flex-col items-center justify-center px-4">
        <div class="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md">
          <h1 class="text-2xl font-bold mb-4 text-center">YouTube Audio Downloader</h1>
          <input id="urlInput" type="text" placeholder="Paste YouTube URL..." class="w-full p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          
          <div id="preview" class="mt-4 hidden">
            <img id="thumbnail" class="rounded-lg w-full mb-2" />
            <p id="title" class="text-center font-medium"></p>
          </div>

          <button id="downloadBtn" class="mt-4 w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition">
            Download Audio
          </button>
        </div>
      </div>

      <script>
        const urlInput = document.getElementById('urlInput');
        const thumbnail = document.getElementById('thumbnail');
        const title = document.getElementById('title');
        const preview = document.getElementById('preview');
        const downloadBtn = document.getElementById('downloadBtn');

        urlInput.addEventListener('input', async () => {
          const url = urlInput.value.trim();
          if (url === '') {
            preview.classList.add('hidden');
            return;
          }
          try {
            const res = await fetch(\`https://noembed.com/embed?url=\${encodeURIComponent(url)}\`);
            const data = await res.json();
            if (data.thumbnail_url) {
              thumbnail.src = data.thumbnail_url;
              title.textContent = data.title;
              preview.classList.remove('hidden');
            } else {
              preview.classList.add('hidden');
            }
          } catch {
            preview.classList.add('hidden');
          }
        });

        downloadBtn.addEventListener('click', () => {
          const url = urlInput.value.trim();
          if (!url) return alert('Please enter a YouTube URL');
          window.location.href = \`/download?url=\${encodeURIComponent(url)}\`;
        });
      </script>
    </body>
    </html>
  `);
});

// Download endpoint using spawn
app.get('/download', (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) return res.status(400).send('Video URL is required');

  res.setHeader('Content-Disposition', 'attachment; filename="audio.mp3"');

  const process = spawn('yt-dlp', ['-f', 'bestaudio', '-o', '-', videoUrl]);

  process.stdout.pipe(res);

  process.stderr.on('data', (data) => {
    console.error(data.toString());
  });

  process.on('error', (err) => {
    console.error('Download error:', err);
    res.status(500).send('Error downloading audio');
  });
});

// Start server
app.listen(port, () => {
  console.log(\`Server running at http://localhost:\${port}\`);
});
