require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(morgan('dev'));

// Test Route
app.get('/', (req, res) => {
  res.json({ message: 'BowerBook API is running' });
});

// Start Server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));