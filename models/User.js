const db = require('../config/database');

const User = {
  create: (userData, callback) => {
    const query = 'INSERT INTO users (name, mobile) VALUES (?, ?)';
    db.execute(query, [userData.name, userData.mobile], callback);
  },
  
  findById: (id, callback) => {
    const query = 'SELECT * FROM users WHERE id = ?';
    db.execute(query, [id], callback);
  }
};

module.exports = User;