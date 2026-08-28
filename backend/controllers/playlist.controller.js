const pool = require('../config/db');

const SONG_SELECT_FOR_PLAYLIST = `
  SELECT s.id, s.title, s.genre, s.duration, s.audio_file, s.audio_source, s.release_year,
         a.name AS artist, al.title AS album, ps.position, ps.added_at
  FROM playlist_songs ps
  JOIN songs s ON ps.song_id = s.id
  LEFT JOIN artists a ON s.artist_id = a.id
  LEFT JOIN albums al ON s.album_id = al.id
  WHERE ps.playlist_id = ?
  ORDER BY ps.position ASC, ps.added_at ASC
`;

async function assertOwnership(playlistId, userId) {
  const [rows] = await pool.query('SELECT * FROM playlists WHERE id = ?', [playlistId]);
  if (rows.length === 0) {
    const err = new Error('Playlist not found.');
    err.status = 404;
    throw err;
  }
  if (rows[0].user_id !== userId) {
    const err = new Error('You do not have permission to modify this playlist.');
    err.status = 403;
    throw err;
  }
  return rows[0];
}

exports.getUserPlaylists = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, COUNT(ps.id) AS song_count
       FROM playlists p
       LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
       WHERE p.user_id = ?
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

exports.createPlaylist = async (req, res, next) => {
  try {
    const { name, description = '', is_public = false } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Playlist name is required.' });
    }
    const [result] = await pool.query(
      'INSERT INTO playlists (user_id, name, description, is_public) VALUES (?, ?, ?, ?)',
      [req.user.id, name.trim(), description, !!is_public]
    );
    const [rows] = await pool.query('SELECT * FROM playlists WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.getPlaylistById = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM playlists WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Playlist not found.' });

    const playlist = rows[0];
    // Private playlists are only visible to their owner
    if (!playlist.is_public && (!req.user || req.user.id !== playlist.user_id)) {
      return res.status(403).json({ message: 'This playlist is private.' });
    }

    const [songs] = await pool.query(SONG_SELECT_FOR_PLAYLIST, [playlist.id]);
    res.json({ ...playlist, songs });
  } catch (err) {
    next(err);
  }
};

exports.updatePlaylist = async (req, res, next) => {
  try {
    await assertOwnership(req.params.id, req.user.id);
    const { name, description, is_public } = req.body;
    await pool.query(
      'UPDATE playlists SET name = COALESCE(?, name), description = COALESCE(?, description), is_public = COALESCE(?, is_public) WHERE id = ?',
      [name, description, is_public, req.params.id]
    );
    const [rows] = await pool.query('SELECT * FROM playlists WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.deletePlaylist = async (req, res, next) => {
  try {
    await assertOwnership(req.params.id, req.user.id);
    await pool.query('DELETE FROM playlists WHERE id = ?', [req.params.id]);
    res.json({ message: 'Playlist deleted.' });
  } catch (err) {
    next(err);
  }
};

exports.addSongToPlaylist = async (req, res, next) => {
  try {
    await assertOwnership(req.params.id, req.user.id);
    const { songId } = req.body;
    if (!songId) return res.status(400).json({ message: 'songId is required.' });

    const [[{ maxPos }]] = await pool.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS maxPos FROM playlist_songs WHERE playlist_id = ?',
      [req.params.id]
    );

    await pool.query(
      'INSERT IGNORE INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)',
      [req.params.id, songId, maxPos]
    );
    const [songs] = await pool.query(SONG_SELECT_FOR_PLAYLIST, [req.params.id]);
    res.status(201).json({ message: 'Song added.', songs });
  } catch (err) {
    next(err);
  }
};

exports.removeSongFromPlaylist = async (req, res, next) => {
  try {
    await assertOwnership(req.params.id, req.user.id);
    await pool.query(
      'DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?',
      [req.params.id, req.params.songId]
    );
    const [songs] = await pool.query(SONG_SELECT_FOR_PLAYLIST, [req.params.id]);
    res.json({ message: 'Song removed.', songs });
  } catch (err) {
    next(err);
  }
};
