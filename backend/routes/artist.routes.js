const express = require('express');
const router = express.Router();
const artistController = require('../controllers/artist.controller');

router.get('/', artistController.getAllArtists);
router.get('/:id', artistController.getArtistById);

module.exports = router;
