const db = require('../config/database');

const Image = {
  create: (imageData, callback) => {
    const query = 'INSERT INTO images (user_id, original_image, processed_image, style) VALUES (?, ?, ?, ?)';
    db.execute(query, [imageData.user_id, imageData.original_image, imageData.processed_image, imageData.style], callback);
  },
  
  findByUserId: (userId, callback) => {
    const query = 'SELECT * FROM images WHERE user_id = ? ORDER BY created_at DESC';
    db.execute(query, [userId], callback);
  }
};

module.exports = Image;