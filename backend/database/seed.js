/**
 * Seeds the database with artists, albums, and songs from songsData.js.
 * Each song is assigned a placeholder audio file based on its genre
 * (see scripts/generate_demo_audio.py for how those were generated).
 *
 * Usage:
 *   node database/seed.js            (skips if songs already exist)
 *   node database/seed.js --force    (wipes catalog tables and reseeds)
 */
require('dotenv').config();
const pool = require('../config/db');
const songs = require('./songsData');

// Maps each catalog genre to a pool of placeholder audio files.
// Songs rotate through their genre's pool so playback isn't identical
// track-to-track within a genre.
const GENRE_AUDIO_MAP = {
  Bollywood: ['bollywood_1.wav', 'bollywood_2.wav', 'ballad_1.wav'],
  Punjabi: ['bollywood_2.wav', 'edm_1.wav', 'pop_bright_1.wav'],
  Pop: ['pop_bright_1.wav', 'pop_bright_2.wav', 'ballad_2.wav'],
  Rock: ['rock_1.wav'],
  'Hip-Hop': ['hiphop_1.wav'],
  'R&B': ['ballad_2.wav', 'hiphop_1.wav'],
  EDM: ['edm_1.wav', 'edm_2.wav'],
  'K-Pop': ['kpop_1.wav', 'pop_bright_2.wav'],
  Classical: ['classical_1.wav', 'ballad_1.wav'],
  Country: ['ballad_1.wav', 'pop_bright_1.wav'],
  Latin: ['latin_1.wav', 'edm_2.wav'],
};

const genreCounters = {};
function pickAudioFile(genre) {
  const pool = GENRE_AUDIO_MAP[genre] || ['pop_bright_1.wav'];
  const count = genreCounters[genre] || 0;
  genreCounters[genre] = count + 1;
  return pool[count % pool.length];
}

const artistCache = new Map();
const albumCache = new Map();

async function findOrCreateArtist(name) {
  if (artistCache.has(name)) return artistCache.get(name);
  const [rows] = await pool.query('SELECT id FROM artists WHERE name = ?', [name]);
  let id;
  if (rows.length) {
    id = rows[0].id;
  } else {
    const [result] = await pool.query('INSERT INTO artists (name) VALUES (?)', [name]);
    id = result.insertId;
  }
  artistCache.set(name, id);
  return id;
}

async function findOrCreateAlbum(title, artistId, year) {
  const key = `${title}::${artistId}`;
  if (albumCache.has(key)) return albumCache.get(key);
  const [rows] = await pool.query('SELECT id FROM albums WHERE title = ? AND artist_id = ?', [title, artistId]);
  let id;
  if (rows.length) {
    id = rows[0].id;
  } else {
    const [result] = await pool.query(
      'INSERT INTO albums (title, artist_id, release_year) VALUES (?, ?, ?)',
      [title, artistId, year]
    );
    id = result.insertId;
  }
  albumCache.set(key, id);
  return id;
}

async function seed() {
  const forceFlag = process.argv.includes('--force');

  const [existing] = await pool.query('SELECT COUNT(*) AS count FROM songs');
  if (existing[0].count > 0 && !forceFlag) {
    console.log(`Database already has ${existing[0].count} songs. Run "node database/seed.js --force" to wipe and reseed.`);
    process.exit(0);
  }

  if (forceFlag) {
    console.log('Force flag detected — clearing existing catalog data...');
    await pool.query('SET FOREIGN_KEY_CHECKS = 0');
    await pool.query('TRUNCATE TABLE playlist_songs');
    await pool.query('TRUNCATE TABLE liked_songs');
    await pool.query('TRUNCATE TABLE recently_played');
    await pool.query('TRUNCATE TABLE songs');
    await pool.query('TRUNCATE TABLE albums');
    await pool.query('TRUNCATE TABLE artists');
    await pool.query('SET FOREIGN_KEY_CHECKS = 1');
  }

  console.log(`Seeding ${songs.length} songs...`);
  let inserted = 0;
  for (const s of songs) {
    const artistId = await findOrCreateArtist(s.artist);
    const albumId = await findOrCreateAlbum(s.album, artistId, s.year);
    const audioFile = pickAudioFile(s.genre);
    await pool.query(
      `INSERT INTO songs (title, artist_id, album_id, genre, language, duration, release_year, audio_file)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [s.title, artistId, albumId, s.genre, s.language, s.duration, s.year, audioFile]
    );
    inserted++;
  }

  console.log(`Done. Inserted ${inserted} songs, ${artistCache.size} artists, ${albumCache.size} albums.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err.message);
  process.exit(1);
});
