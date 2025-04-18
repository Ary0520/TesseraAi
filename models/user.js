const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

// Define the schema outside of connection logic
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/.+\@.+\..+/, 'Please enter a valid email address']
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    trim: true
  },
});

// Create a variable to hold our model
let UserModel;

// Check if we have a MongoDB URI
if (!process.env.MONGO_URI) {
  console.error('MONGO_URI is missing from environment variables');
  console.log('Using in-memory user storage instead.');
  setupInMemoryModel();
} else {
  // Configure mongoose connection options
  const options = {
    serverSelectionTimeoutMS: 5000, // 5 seconds
    connectTimeoutMS: 10000, // 10 seconds
  };

  // Connect to MongoDB
  mongoose.connect(process.env.MONGO_URI, options)
    .then(() => {
      console.log('MongoDB connected successfully');
      // Only create the model after successful connection
      UserModel = mongoose.model("user", userSchema);
    })
    .catch(err => {
      console.error('MongoDB connection error:', err.message);
      console.log('Using in-memory user storage instead.');
      setupInMemoryModel();
    });

  // Create the model immediately for use in the application
  // This is needed because the connection is asynchronous
  // If connection fails, it will be replaced by the in-memory model
  UserModel = mongoose.model("user", userSchema);
}

// Function to set up in-memory model if MongoDB is unavailable
function setupInMemoryModel() {
  // Create a simple in-memory user store
  const users = [];

  // Create a mock user model
  UserModel = {
    findOne: async function(query) {
      return users.find(user => user.email === query.email);
    },
    create: async function(userData) {
      // Check if user already exists
      const existingUser = await this.findOne({ email: userData.email });
      if (existingUser) {
        throw new Error('User already exists');
      }

      // Create new user
      const newUser = { ...userData };
      users.push(newUser);
      return newUser;
    }
  };
}

module.exports = UserModel;