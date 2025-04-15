const express = require('express');
const multer = require('multer');
const { Groq } = require('groq-sdk');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Configure Groq client
const groq = new Groq({
  apiKey: process.env.API_KEY,
});

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Text chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { content, language } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'No content provided' });
    }

    // Set response headers for streaming
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Transfer-Encoding', 'chunked');

    // Prepare system message based on language
    const systemMessage = getSystemMessage(language);

    // Create chat completion with streaming
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: content }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_completion_tokens: 1024,
      top_p: 1,
      stream: true,
      stop: null
    });

    // Stream the response
    for await (const chunk of chatCompletion) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        res.write(content);
      }
    }

    res.end();
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    // If headers haven't been sent yet, send error response
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to get AI response' });
    } else {
      // If streaming has started, end the response
      res.end();
    }
  }
});

// Audio processing endpoint
app.post('/api/audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const language = req.body.language || 'en';

    // Save the audio file temporarily
    const tempFilePath = path.join(__dirname, 'temp_audio_' + Date.now() + '.webm');
    fs.writeFileSync(tempFilePath, req.file.buffer);

    try {
      // Use Groq's Whisper model to transcribe the audio
      // Force English language for transcription
      const transcription = await groq.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: "whisper-large-v3",
        response_format: "verbose_json",
        language: "en",  // Force English transcription
        temperature: 0,   // Lower temperature for more deterministic outputs
        prompt: "The following is a conversation with an AI assistant. The audio may contain questions, instructions, or conversation.", // Context hint
      });

      // Get the transcribed text
      let transcribedText = transcription.text;
      console.log('Raw transcribed text:', transcribedText);

      // Log detailed transcription information
      console.log('Transcription details:', JSON.stringify({
        language: transcription.language,
        duration: transcription.duration,
        segments: transcription.segments?.length || 0
      }, null, 2));

      // Post-process the transcription to improve accuracy
      transcribedText = postProcessTranscription(transcribedText);

      // Process with Groq LLM
      const systemMessage = getSystemMessage(language);

      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: transcribedText }
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        max_completion_tokens: 1024,
        top_p: 1,
        stream: false
      });

      const response = chatCompletion.choices[0].message.content;

      // Clean up the temporary file
      fs.unlinkSync(tempFilePath);

      res.json({ response, transcribedText });
    } catch (transcriptionError) {
      console.error('Error transcribing audio:', transcriptionError);

      // Clean up the temporary file if it exists
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }

      throw transcriptionError;
    }
  } catch (error) {
    console.error('Error processing audio:', error);
    res.status(500).json({ error: 'Failed to process audio: ' + error.message });
  }
});

// Image processing endpoint
app.post('/api/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const language = req.body.language || 'en';

    // Convert image to base64
    const imageBuffer = req.file.buffer;
    const base64Image = imageBuffer.toString('base64');
    const mimeType = req.file.mimetype;
    const dataURI = `data:${mimeType};base64,${base64Image}`;

    console.log(`Processing image of type: ${mimeType}, size: ${imageBuffer.length} bytes`);

    // Prepare system message based on language
    const systemMessage = getSystemMessage(language);

    // Process with Groq using the Meta Llama-4-Scout model for vision capabilities
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemMessage },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Please analyze this image and describe what you see in detail.' },
            { type: 'image_url', image_url: { url: dataURI } }
          ]
        }
      ],
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      temperature: 0.7,
      max_completion_tokens: 1024,
      top_p: 1,
      stream: false
    });

    const response = chatCompletion.choices[0].message.content;
    console.log('Image analysis completed successfully');

    res.json({ response });
  } catch (error) {
    console.error('Error processing image:', error);
    res.status(500).json({ error: 'Failed to process image: ' + error.message });
  }
});

// Post-process transcription to improve accuracy
function postProcessTranscription(text) {
  if (!text) return text;

  // Common corrections for speech recognition errors
  const corrections = [
    // Fix common speech recognition errors
    { pattern: /\bi\s/gi, replacement: "I " },  // Capitalize standalone 'i'
    { pattern: /\bi'm\b/gi, replacement: "I'm" },
    { pattern: /\bi'll\b/gi, replacement: "I'll" },
    { pattern: /\bi've\b/gi, replacement: "I've" },
    { pattern: /\bi'd\b/gi, replacement: "I'd" },
    { pattern: /\bim\b/gi, replacement: "I'm" },
    { pattern: /\bive\b/gi, replacement: "I've" },
    { pattern: /\bid\b/gi, replacement: "I'd" },
    { pattern: /\bill\b/gi, replacement: "I'll" },

    // Fix punctuation
    { pattern: /\s+([.,?!:;])/g, replacement: "$1" },  // Remove space before punctuation
    { pattern: /([.,?!:;])([^\s])/g, replacement: "$1 $2" },  // Add space after punctuation

    // Fix common word confusions
    { pattern: /\bwont\b/gi, replacement: "won't" },
    { pattern: /\bcant\b/gi, replacement: "can't" },
    { pattern: /\bdont\b/gi, replacement: "don't" },
    { pattern: /\bthats\b/gi, replacement: "that's" },
    { pattern: /\bwhats\b/gi, replacement: "what's" },
    { pattern: /\bhows\b/gi, replacement: "how's" },
    { pattern: /\bwhos\b/gi, replacement: "who's" },
    { pattern: /\btheir\s+are\b/gi, replacement: "there are" },
    { pattern: /\btheir\s+is\b/gi, replacement: "there is" },
    { pattern: /\byour\s+a\b/gi, replacement: "you're a" },
    { pattern: /\bits\s+a\b/gi, replacement: "it's a" },

    // Fix common technical terms that might be misheard
    { pattern: /\bgrow\s+model\b/gi, replacement: "Groq model" },
    { pattern: /\bgrow\s+API\b/gi, replacement: "Groq API" },
    { pattern: /\blamda\b/gi, replacement: "LLaMA" },
    { pattern: /\blama\s+model\b/gi, replacement: "LLaMA model" },
    { pattern: /\bwhisper\s+model\b/gi, replacement: "Whisper model" },
  ];

  // Apply all corrections
  let processedText = text;
  for (const correction of corrections) {
    processedText = processedText.replace(correction.pattern, correction.replacement);
  }

  // Ensure the first letter of the text is capitalized
  if (processedText.length > 0) {
    processedText = processedText.charAt(0).toUpperCase() + processedText.slice(1);
  }

  // Ensure the text ends with proper punctuation
  if (processedText.length > 0 && !processedText.match(/[.?!]$/)) {
    processedText += ".";
  }

  console.log('Post-processed text:', processedText);
  return processedText;
}

// Helper function to get system message based on language
function getSystemMessage(language) {
  const baseMessage = "You are a helpful, friendly AI assistant. Respond concisely and accurately to the user's questions.";

  const languageInstructions = {
    'en': "Respond in English.",
    'es': "Responde en español.",
    'fr': "Répondez en français.",
    'de': "Antworten Sie auf Deutsch.",
    'zh': "用中文回答。",
    'ja': "日本語で答えてください。",
    'hi': "हिंदी में जवाब दें।",
    'ar': "أجب باللغة العربية."
  };

  return `${baseMessage} ${languageInstructions[language] || languageInstructions['en']}`;
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
