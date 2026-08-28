const pool = require('../config/db');

const SONG_SELECT = `
  SELECT s.id, s.title, s.genre, s.language, s.duration, s.release_year,
         s.audio_file, s.audio_source, s.play_count,
         a.id AS artist_id, a.name AS artist,
         al.id AS album_id, al.title AS album
  FROM songs s
  LEFT JOIN artists a ON s.artist_id = a.id
  LEFT JOIN albums al ON s.album_id = al.id
`;

exports.getAllSongs = async (req, res, next) => {
  try {
    const { genre, limit = 100, offset = 0 } = req.query;
    const params = [];
    let query = SONG_SELECT;

    if (genre) {
      query += ' WHERE s.genre = ?';
      params.push(genre);
    }
    query += ' ORDER BY s.id ASC LIMIT ? OFFSET ?';
    params.push(Math.min(Number(limit) || 100, 500), Number(offset) || 0);

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

exports.searchSongs = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) return res.json([]);

    const like = `%${q.trim()}%`;
    const [rows] = await pool.query(
      `${SONG_SELECT}
       WHERE s.title LIKE ? OR a.name LIKE ? OR al.title LIKE ?
       ORDER BY
         CASE WHEN s.title LIKE ? THEN 0 ELSE 1 END,
         s.play_count DESC
       LIMIT 50`,
      [like, like, like, like]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

exports.getSongById = async (req, res, next) => {
  try {
    const [rows] = await pool.query(`${SONG_SELECT} WHERE s.id = ?`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Song not found.' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

exports.getGenres = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT genre, COUNT(*) AS count FROM songs GROUP BY genre ORDER BY genre'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

exports.incrementPlayCount = async (req, res, next) => {
  try {
    await pool.query('UPDATE songs SET play_count = play_count + 1 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Play count updated.' });
  } catch (err) {
    next(err);
  }
};

exports.getTopSongs = async (req, res, next) => {
  try {
    const [rows] = await pool.query(`${SONG_SELECT} ORDER BY s.play_count DESC LIMIT 12`);
    res.json(rows);
  } catch (err) {
    next(err);
  }
};
