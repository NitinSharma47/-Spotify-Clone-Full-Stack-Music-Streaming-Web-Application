const pool = require('../config/db');

exports.getAllArtists = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.id, a.name, COUNT(s.id) AS song_count
       FROM artists a
       LEFT JOIN songs s ON s.artist_id = a.id
       GROUP BY a.id
       HAVING song_count > 0
       ORDER BY song_count DESC, a.name ASC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

exports.getArtistById = async (req, res, next) => {
  try {
    const [artistRows] = await pool.query('SELECT * FROM artists WHERE id = ?', [req.params.id]);
    if (artistRows.length === 0) return res.status(404).json({ message: 'Artist not found.' });

    const [songs] = await pool.query(
      `SELECT s.id, s.title, s.genre, s.duration, s.audio_file, s.release_year,
              al.title AS album
       FROM songs s
       LEFT JOIN albums al ON s.album_id = al.id
       WHERE s.artist_id = ?
       ORDER BY s.play_count DESC`,
      [req.params.id]
    );

    res.json({ ...artistRows[0], songs });
  } catch (err) {
    next(err);
  }
};
