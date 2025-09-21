const Image = require('../models/Image');
const { processImageWithGemini } = require('../utils/gemini');
const { applyWatermark } = require('../utils/watermark');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const qr = require('qr-image');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, uuidv4() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage }).single('image');

// Helper function to save base64 image
const saveBase64Image = (base64Data, directory, filename) => {
  return new Promise((resolve, reject) => {
    // Remove data:image/png;base64, prefix if present
    const base64String = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64String, 'base64');
    
    // Ensure directory exists
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    
    const filePath = path.join(directory, filename);
    fs.writeFile(filePath, buffer, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(filePath);
      }
    });
  });
};

exports.uploadImage = (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      return res.status(500).json({ error: 'File upload failed' });
    }
    
    const { userId } = req.body;
    const imagePath = req.file.path;
    
    Image.create({ 
      user_id: userId, 
      original_image: imagePath 
    }, (err, results) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json({ 
        success: true, 
        imageId: results.insertId,
        imagePath: imagePath
      });
    });
  });
};

exports.processImage = async (req, res) => {
  try {
    const { imageData, userId, style } = req.body;
    
    if (!imageData || !userId || !style) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Add artificial delay to test loading (remove in production)
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Generate unique filename
    const filename = `${uuidv4()}.png`;
    const originalPath = path.join(__dirname, '../uploads', filename);
    const outputPath = path.join(__dirname, '../outputs', filename);
    
    // Ensure directories exist
    if (!fs.existsSync(path.join(__dirname, '../uploads'))) {
      fs.mkdirSync(path.join(__dirname, '../uploads'), { recursive: true });
    }
    if (!fs.existsSync(path.join(__dirname, '../outputs'))) {
      fs.mkdirSync(path.join(__dirname, '../outputs'), { recursive: true });
    }
    
    // Save base64 image
    await saveBase64Image(imageData, path.join(__dirname, '../uploads'), filename);
    
    // Process image with Gemini AI
    const processedImageData = await processImageWithGemini(originalPath, style);
    
    // Save processed image
    const processedImageBuffer = Buffer.from(processedImageData, 'base64');
    fs.writeFileSync(outputPath, processedImageBuffer);
    
    // Apply watermark to processed image
    await applyWatermark(outputPath, outputPath);
    
    // Save to database
    Image.create({ 
      user_id: userId, 
      original_image: `uploads/${filename}`,
      processed_image: `outputs/${filename}`,
      style: style
    }, (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
    // In the processImage function, update the QR code generation:
    const qrCode = qr.imageSync(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/download/${filename}`, { type: 'png' });
    const qrCodeBase64 = qrCode.toString('base64');
      
      res.json({ 
        success: true, 
        processedImage: `outputs/${filename}`,
        imageId: results.insertId,
        qrCode: qrCodeBase64
      });
    });
    
  } catch (error) {
    console.error('Error processing image:', error);
    res.status(500).json({ error: 'Image processing failed', details: error.message });
  }
};

exports.getImage = (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, '../outputs', filename);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Image not found' });
  }
};

exports.downloadImage = (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, '../outputs', filename);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath, `cartoonized-${filename}`);
  } else {
    res.status(404).json({ error: 'Image not found' });
  }
};