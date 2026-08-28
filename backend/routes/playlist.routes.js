const express = require('express');
const router = express.Router();
const playlistController = require('../controllers/playlist.controller');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

router.get('/', authenticateToken, playlistController.getUserPlaylists);
router.post('/', authenticateToken, playlistController.createPlaylist);
router.get('/:id', optionalAuth, playlistController.getPlaylistById); // supports public playlists
router.put('/:id', authenticateToken, playlistController.updatePlaylist);
router.delete('/:id', authenticateToken, playlistController.deletePlaylist);
router.post('/:id/songs', authenticateToken, playlistController.addSongToPlaylist);
router.delete('/:id/songs/:songId', authenticateToken, playlistController.removeSongFromPlaylist);

module.exports = router;
