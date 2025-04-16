// Test file for Groq TTS functionality
const { Groq } = require('groq-sdk');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.API_KEY,
});

// Log Groq client structure
console.log('Groq client structure:');
console.log('groq =', typeof groq);
console.log('groq.audio =', typeof groq.audio);
if (groq.audio) {
  console.log('groq.audio.speech =', typeof groq.audio.speech);
  if (groq.audio.speech) {
    console.log('groq.audio.speech.create =', typeof groq.audio.speech.create);
  }
}

// Test TTS functionality
async function testTTS() {
  try {
    console.log('Testing TTS functionality...');
    
    // Check if API key is set
    if (!process.env.API_KEY) {
      console.error('API_KEY is not set in environment variables');
      return;
    }
    
    console.log('API_KEY is set');
    
    // Check if audio.speech is available
    if (!groq.audio || !groq.audio.speech) {
      console.error('groq.audio.speech is not available in this version of the Groq SDK');
      console.log('Available methods on groq:', Object.keys(groq));
      if (groq.audio) {
        console.log('Available methods on groq.audio:', Object.keys(groq.audio));
      }
      return;
    }
    
    // Try to generate speech
    console.log('Attempting to generate speech...');
    const speech = await groq.audio.speech.create({
      model: "playai-tts",
      voice: "Aaliyah-PlayAI",
      response_format: "wav",
      input: "This is a test of the text to speech functionality.",
    });
    
    console.log('Speech generated successfully');
    
    // Save the audio file
    const speechFile = path.resolve("./test-speech.wav");
    const buffer = Buffer.from(await speech.arrayBuffer());
    await fs.promises.writeFile(speechFile, buffer);
    
    console.log(`Speech saved to ${speechFile}`);
  } catch (error) {
    console.error('Error testing TTS:', error);
  }
}

// Run the test
testTTS();
