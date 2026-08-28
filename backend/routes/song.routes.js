const express = require('express');
const router = express.Router();
const songController = require('../controllers/song.controller');

// Order matters: specific paths before /:id
router.get('/search', songController.searchSongs);
router.get('/genres', songController.getGenres);
router.get('/top', songController.getTopSongs);
router.get('/', songController.getAllSongs);
router.get('/:id', songController.getSongById);
router.post('/:id/play', songController.incrementPlayCount);

module.exports = router;
