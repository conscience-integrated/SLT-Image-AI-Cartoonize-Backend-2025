const express = require('express');
const router = express.Router();
const imageController = require('../controllers/imageController');

router.post('/upload', imageController.uploadImage);
router.post('/process', imageController.processImage);
router.get('/:filename', imageController.getImage);
router.get('/download/:filename', imageController.downloadImage);

module.exports = router;