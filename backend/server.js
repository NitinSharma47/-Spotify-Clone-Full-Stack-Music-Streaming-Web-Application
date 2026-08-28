require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth.routes');
const songRoutes = require('./routes/song.routes');
const playlistRoutes = require('./routes/playlist.routes');
const userRoutes = require('./routes/user.routes');
const artistRoutes = require('./routes/artist.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// --- middleware ---
app.use(cors());
app.use(express.json());

// --- static assets ---
// Placeholder demo audio, served at /audio/<filename>.wav
app.use('/audio', express.static(path.join(__dirname, 'public/audio')));
// The frontend itself (single-server setup for easy local demos)
app.use(express.static(path.join(__dirname, '../frontend')));

// --- REST API ---
app.use('/api/auth', authRoutes);
app.use('/api/songs', songRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/users', userRoutes);
app.use('/api/artists', artistRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Fallback to index.html for any non-API route (simple SPA-style routing
// isn't used here since this is a multi-page app, but this keeps direct
// refreshes on the root working correctly)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Spotify Clone server running at http://localhost:${PORT}`);
});
