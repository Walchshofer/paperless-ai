const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const token = jwt.sign(
  {
    id: 1,
    username: 'admin',
    role: 'admin',
    is_superuser: true,
  },
  JWT_SECRET,
  { expiresIn: '1h' }
);
console.log(token);
