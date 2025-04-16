const mongoose = require('mongoose');
require('dotenv').config();  
// Create a dummy user model if MongoDB is not available
let userSchema;
let UserModel;

try {
  // Try to connect to MongoDB
  mongoose.connect('mongodb+srv://Aryan:eWggPEzki2feqbVi@cluster0.jg1k1.mongodb.net/hackhazards?retryWrites=true&w=majority&appName=Cluster0')
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => {
      console.error('MongoDB connection error:', err.message);
      console.log('Using in-memory user storage instead.');
    });


  // Define the schema
  userSchema = mongoose.Schema({
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

  // Create the model
  UserModel = mongoose.model("user", userSchema);
} catch (err) {
  console.error('Error setting up MongoDB:', err.message);
  console.log('Using in-memory user storage instead.');

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