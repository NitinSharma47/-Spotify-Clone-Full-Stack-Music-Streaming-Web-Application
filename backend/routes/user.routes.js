const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticateToken } = require('../middleware/auth');

router.get('/me/liked-songs', authenticateToken, userController.getLikedSongs);
router.post('/me/liked-songs', authenticateToken, userController.likeSong);
router.delete('/me/liked-songs/:songId', authenticateToken, userController.unlikeSong);
router.get('/me/liked-songs/:songId/check', authenticateToken, userController.checkLiked);

router.get('/me/recently-played', authenticateToken, userController.getRecentlyPlayed);
router.post('/me/recently-played', authenticateToken, userController.addRecentlyPlayed);

module.exports = router;
