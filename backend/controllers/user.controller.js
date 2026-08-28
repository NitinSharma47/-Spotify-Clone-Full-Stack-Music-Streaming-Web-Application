const pool = require('../config/db');

const SONG_SELECT_JOIN = `
  SELECT s.id, s.title, s.genre, s.duration, s.audio_file, s.audio_source, s.release_year,
         a.name AS artist, al.title AS album
  FROM songs s
  LEFT JOIN artists a ON s.artist_id = a.id
  LEFT JOIN albums al ON s.album_id = al.id
`;

exports.getLikedSongs = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `${SONG_SELECT_JOIN}
       JOIN liked_songs ls ON ls.song_id = s.id
       WHERE ls.user_id = ?
       ORDER BY ls.liked_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

exports.likeSong = async (req, res, next) => {
  try {
    const { songId } = req.body;
    if (!songId) return res.status(400).json({ message: 'songId is required.' });
    await pool.query(
      'INSERT IGNORE INTO liked_songs (user_id, song_id) VALUES (?, ?)',
      [req.user.id, songId]
    );
    res.status(201).json({ message: 'Song liked.' });
  } catch (err) {
    next(err);
  }
};

exports.unlikeSong = async (req, res, next) => {
  try {
    await pool.query('DELETE FROM liked_songs WHERE user_id = ? AND song_id = ?', [
      req.user.id,
      req.params.songId,
    ]);
    res.json({ message: 'Song unliked.' });
  } catch (err) {
    next(err);
  }
};

exports.checkLiked = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id FROM liked_songs WHERE user_id = ? AND song_id = ?',
      [req.user.id, req.params.songId]
    );
    res.json({ liked: rows.length > 0 });
  } catch (err) {
    next(err);
  }
};

exports.getRecentlyPlayed = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `${SONG_SELECT_JOIN}
       JOIN recently_played rp ON rp.song_id = s.id
       WHERE rp.user_id = ?
       ORDER BY rp.played_at DESC
       LIMIT 20`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

exports.addRecentlyPlayed = async (req, res, next) => {
  try {
    const { songId } = req.body;
    if (!songId) return res.status(400).json({ message: 'songId is required.' });
    await pool.query('INSERT INTO recently_played (user_id, song_id) VALUES (?, ?)', [
      req.user.id,
      songId,
    ]);
    res.status(201).json({ message: 'Recorded.' });
  } catch (err) {
    next(err);
  }
};
