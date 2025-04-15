# Multilingual AI Assistant

A real-time multilingual AI assistant built with vanilla JavaScript and Node.js that understands and responds to text, audio, and image inputs using the Groq API.

## Features

- Text-based chat interface
- Audio input support
- Image upload and analysis
- Multilingual support (8 languages)
- Real-time streaming responses
- Responsive design

## Technologies Used

- Frontend: Vanilla JavaScript, HTML, CSS
- Backend: Node.js, Express
- AI: Groq API with LLaMA-3.3-70b-versatile model

## Setup Instructions

1. Install dependencies:
   ```
   npm install
   ```

2. Start the server:
   ```
   npm start
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Usage

- **Text Input**: Type your message and press Enter or click the Send button
- **Voice Input**: Click the microphone icon to start/stop recording
- **Image Input**: Click the camera icon to upload an image
- **Language Selection**: Choose your preferred language from the dropdown menu

## Note

For a production environment, you should:
- Store the API key in environment variables
- Implement proper error handling
- Add authentication
- Use a real speech-to-text service for audio processing
- Use a vision model for image analysis
