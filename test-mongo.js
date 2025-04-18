const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables from .env file
console.log('Loading environment variables...');
dotenv.config();

console.log('Attempting to connect to MongoDB...');

// Check if MONGO_URI exists
if (!process.env.MONGO_URI) {
  console.error('MONGO_URI is missing from environment variables');
  process.exit(1);
}

console.log('MONGO_URI exists in environment variables');

// Try to connect with a timeout
const connectWithTimeout = async () => {
  try {
    // Set a connection timeout
    const options = {
      serverSelectionTimeoutMS: 5000, // 5 seconds
      connectTimeoutMS: 10000, // 10 seconds
    };

    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI, options);
    console.log('MongoDB connected successfully!');

    // Close the connection after success
    await mongoose.connection.close();
    console.log('Connection closed');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    console.error('Full error:', err);
  } finally {
    process.exit(0);
  }
};

connectWithTimeout();
