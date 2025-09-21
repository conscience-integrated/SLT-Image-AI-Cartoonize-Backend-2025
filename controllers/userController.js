const User = require('../models/User');

exports.createUser = (req, res) => {
  const { name, mobile } = req.body;
  
  User.create({ name, mobile }, (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json({ 
      success: true, 
      userId: results.insertId,
      message: 'User created successfully' 
    });
  });
};