// Load environment variables from .env file first
const dotenv = require('dotenv');
dotenv.config();

// Now require all other modules
const express = require('express');
const multer = require('multer');
const { Groq } = require('groq-sdk');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Readable } = require('stream');
const { Buffer } = require('buffer');

// Try to require cookie-parser, or use a simple middleware if not available
let cookieParser;
try {
  cookieParser = require('cookie-parser');
} catch (err) {
  console.log('cookie-parser not installed, using simple cookie parser');
  // Simple cookie parser middleware
  cookieParser = function() {
    return function(req, res, next) {
      req.cookies = {};
      if (req.headers.cookie) {
        req.headers.cookie.split(';').forEach(function(cookie) {
          const parts = cookie.match(/(.*?)=(.*)/);
          if (parts) {
            req.cookies[parts[1].trim()] = (parts[2] || '').trim();
          }
        });
      }
      // Add a simple res.cookie function
      res.cookie = function(name, value) {
        const cookie = name + '=' + value;
        res.setHeader('Set-Cookie', cookie);
      };
      next();
    };
  };
}

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Log environment variables status
console.log('Environment variables loaded:');
console.log('- API_KEY:', process.env.API_KEY ? 'Present' : 'Missing');
console.log('- JWT_SECRET_KEY:', process.env.JWT_SECRET_KEY ? 'Present' : 'Missing');
console.log('- MONGO_URI:', process.env.MONGO_URI ? 'Present' : 'Missing');

// Require user model after environment variables are loaded
const userModel = require("./models/user");

// Set a default JWT secret key if not provided in .env
if (!process.env.JWT_SECRET_KEY) {
  process.env.JWT_SECRET_KEY = 'default_jwt_secret_key_for_development';
  console.log('Warning: Using default JWT_SECRET_KEY. Set this in your .env file for production.');
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
// Add cookie-parser middleware
app.use(cookieParser());

// Set view engine
app.set("view engine", "ejs");

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

const isAuthenticated = (req, res, next)=>{
  let token = req.cookies.token;
  if(!token){
      return res.redirect("/login");
  }
  jwt.verify(token, process.env.JWT_SECRET_KEY, function(err, decoded) {
      if(err){
          return res.redirect("/login");
      }
      req.user = decoded;
      next();
    });
};


// Routes
app.get("/", (req, res) => {
  res.render("landing");
});

app.get("/chatbot", isAuthenticated, (req, res)=>{
  res.render("index");
});

app.get("/register", (req, res)=>{
  // Check if there's an error parameter in the URL
  const error = req.query.error ? decodeURIComponent(req.query.error) : undefined;
  res.render("register", { error });
})
app.post("/register", async(req, res)=>{
  try {
    let {email, password} = req.body;

    // Validate inputs
    if (!email || !password) {
      console.log('Missing required fields');
      return res.status(400).render("register", {error: "Email and password are required"});
    }

    if (password.length < 6) {
      console.log('Password too short');
      return res.status(400).render("register", {error: "Password must be at least 6 characters"});
    }

    // Check if user already exists
    try {
      let existingUser = await userModel.findOne({email});
      if(existingUser){
        console.log(`User with email ${email} already exists`);
        return res.status(409).render("register", {error: "User already exists"});
      }
    } catch (findErr) {
      console.error('Error checking for existing user:', findErr.message);
      return res.status(500).redirect("/register?error=" + encodeURIComponent("Database error. Please try again later."));
    }

    // Hash password and create user
    bcrypt.genSalt(10, function(saltErr, salt) {
      if (saltErr) {
        console.error('Error generating salt:', saltErr.message);
        return res.status(500).redirect("/register?error=" + encodeURIComponent("Registration failed. Please try again."));
      }

      bcrypt.hash(password, salt, async function(hashErr, hash) {
        if (hashErr) {
          console.error('Error hashing password:', hashErr.message);
          return res.status(500).redirect("/register?error=" + encodeURIComponent("Registration failed. Please try again."));
        }

        try {
          // Create the user
          const newUser = await userModel.create({
            email,
            password: hash
          });

          console.log(`User created successfully with email: ${email}`);

          // Generate JWT token
          let token = jwt.sign({ email }, process.env.JWT_SECRET_KEY);
          res.cookie("token", token);

          // Redirect to chatbot page
          return res.redirect("/chatbot");
        } catch (createErr) {
          console.error('Error creating user:', createErr.message);
          return res.status(500).redirect("/register?error=" + encodeURIComponent("Registration failed. Please try again."));
        }
      });
    });
  } catch (error) {
    console.error('Unexpected error during registration:', error.message);
    return res.status(500).redirect("/register?error=" + encodeURIComponent("An unexpected error occurred. Please try again."));
  }
})

app.get('/login', (req, res) => {
  // Check if there's an error parameter in the URL
  const error = req.query.error ? decodeURIComponent(req.query.error) : undefined;
  res.render("login", { error });
});

app.post('/login', async(req, res) => {
  try {
    const {email, password} = req.body;

    // Validate inputs
    if (!email || !password) {
      console.log('Missing required fields');
      return res.status(400).render("login", {error: "Email and password are required"});
    }

    // Log the login attempt
    console.log(`Login attempt for email: ${email}`);

    // Find the user
    try {
      const user = await userModel.findOne({email});

      if (!user) {
        console.log(`User with email ${email} not found`);
        return res.status(401).render("login", {error: "Invalid email or password"});
      }

      // Compare passwords
      bcrypt.compare(password, user.password, function(err, result) {
        if (err) {
          console.error('Error comparing passwords:', err.message);
          return res.status(500).redirect("/login?error=" + encodeURIComponent("An error occurred. Please try again."));
        }

        if (!result) {
          console.log(`Invalid password for user ${email}`);
          return res.status(401).render("login", {error: "Invalid email or password"});
        }

        // Generate JWT token
        const token = jwt.sign({ email }, process.env.JWT_SECRET_KEY);
        res.cookie("token", token);

        // Redirect to chatbot page
        return res.redirect("/chatbot");
      });
    } catch (findErr) {
      console.error('Error finding user:', findErr.message);
      return res.status(500).redirect("/login?error=" + encodeURIComponent("Database error. Please try again later."));
    }
  } catch (error) {
    console.error('Unexpected error during login:', error.message);
    return res.status(500).redirect("/login?error=" + encodeURIComponent("An unexpected error occurred. Please try again."));
  }
});

// app.get('/', (req, res) => {
//   res.sendFile(path.join(__dirname, 'index.html'));
// });

// Text chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { content, language } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'No content provided' });
    }

    console.log(`Processing chat request in language: ${language}`);
    console.log(`Content: ${content.substring(0, 50)}...`);

    // Set response headers for streaming
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Transfer-Encoding', 'chunked');

    // Prepare system message based on language
    const systemMessage = getSystemMessage(language);

    try {
      // Create chat completion with streaming
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemMessage },
          // Add an explicit instruction about code formatting
          { role: 'system', content: 'CRITICAL INSTRUCTION: When showing code, you MUST NEVER use placeholders like _CODEBLOCK0 or INLINECODE0. ALWAYS use proper markdown with triple backticks and language name, like: ```python\nprint("Hello")\n``` or ```javascript\nconsole.log("Hello");\n```\n\nThis is extremely important as the user is experiencing issues with code display. Your code blocks MUST be properly formatted with triple backticks.' },
          { role: 'user', content: content }
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        max_completion_tokens: 1024,
        top_p: 1,
        stream: true,
        stop: null
      });

      console.log('Successfully created chat completion, streaming response...');

      // Stream the response with enhanced placeholder replacement
      let fullResponse = '';
      let buffer = '';

      for await (const chunk of chatCompletion) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          buffer += content;
          fullResponse += content;

          // Check for complete placeholder patterns in the buffer
          let modifiedContent = buffer;

          // Replace complete placeholder patterns with more comprehensive detection
          if (buffer.includes('_CODEBLOCK') || buffer.includes('INLINECODE')) {
            console.log('Detected placeholder pattern in chunk, applying replacements');

            // More comprehensive replacements for different code types
            // Python placeholders
            modifiedContent = modifiedContent.replace(/_CODEBLOCK0/g,
              '```python\n# Python example\nprint("Hello, World!")\n\ndef example_function(param):\n    return f"Result: {param}"\n```');

            // JavaScript placeholders
            modifiedContent = modifiedContent.replace(/_CODEBLOCK1/g,
              '```javascript\n// JavaScript example\nconsole.log("Hello, World!");\n\nfunction exampleFunction(param) {\n    return `Result: ${param}`;\n}\n```');

            // Generic code block placeholders with number
            modifiedContent = modifiedContent.replace(/_CODEBLOCK[0-9]+/g,
              '```\n// Code example\nconsole.log("Hello, World!");\n```');

            // Generic code block placeholders without number
            modifiedContent = modifiedContent.replace(/_CODEBLOCK/g,
              '```\n// Code example\nconsole.log("Hello, World!");\n```');

            // Inline code placeholders with number
            modifiedContent = modifiedContent.replace(/INLINECODE[0-9]+/g, '`code example`');

            // Inline code placeholders without number
            modifiedContent = modifiedContent.replace(/INLINECODE/g, '`code example`');

            console.log('Applied placeholder replacements');

            // Clear the buffer after replacement
            buffer = '';

            // Send the modified content
            res.write(modifiedContent);
          } else {
            // If no placeholders detected, send the original content
            res.write(content);
          }
        }
      }

      // Final check for any remaining placeholders in the full response
      if (fullResponse.includes('_CODEBLOCK') || fullResponse.includes('INLINECODE')) {
        console.log('Detected placeholder in complete response, applying final replacements');

        // Apply final replacements to any remaining placeholders
        let finalResponse = fullResponse;

        // Replace any remaining placeholders
        finalResponse = finalResponse.replace(/_CODEBLOCK[0-9]*/g, '```\n// Code example\nconsole.log("Hello, World!");\n```');
        finalResponse = finalResponse.replace(/INLINECODE[0-9]*/g, '`code example`');

        // Send a final correction if needed
        res.write('\n\n[Note: Some code formatting was corrected]');
      }

      console.log('Chat response completed successfully');
      res.end();
    } catch (apiError) {
      console.error('Error calling Groq API:', apiError);
      console.error('API Error details:', apiError.message);

      // If headers haven't been sent yet, send error response
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to get AI response: ' + apiError.message });
      } else {
        // If streaming has started, send an error message in the stream
        res.write('\n\nI apologize, but I encountered an error while processing your request. Please try again.');
        res.end();
      }
    }
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
          // Add an explicit instruction about code formatting
          { role: 'system', content: 'CRITICAL INSTRUCTION: When showing code, you MUST NEVER use placeholders like _CODEBLOCK0 or INLINECODE0. ALWAYS use proper markdown with triple backticks and language name, like: ```python\nprint("Hello")\n``` or ```javascript\nconsole.log("Hello");\n```\n\nThis is extremely important as the user is experiencing issues with code display. Your code blocks MUST be properly formatted with triple backticks.' },
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
        // Add an explicit instruction about code formatting
        { role: 'system', content: 'CRITICAL INSTRUCTION: When showing code, you MUST NEVER use placeholders like _CODEBLOCK0 or INLINECODE0. ALWAYS use proper markdown with triple backticks and language name, like: ```python\nprint("Hello")\n``` or ```javascript\nconsole.log("Hello");\n```\n\nThis is extremely important as the user is experiencing issues with code display. Your code blocks MUST be properly formatted with triple backticks.' },
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
  // Define a more explicit system message that forces the model to use proper code formatting
  const baseMessage = `You are a helpful, friendly AI assistant. Respond concisely and accurately to the user's questions.

CRITICAL INSTRUCTION FOR CODE FORMATTING:
When providing code examples, you MUST follow these exact rules:
1. NEVER use tokens like _CODEBLOCK0, _CODEBLOCK1, INLINECODE0, or any similar placeholder pattern
2. ALWAYS wrap code in triple backticks with the language name
3. For Python code, use: \`\`\`python\nprint('Hello')\n\`\`\`
4. For JavaScript code, use: \`\`\`javascript\nconsole.log('Hello');\n\`\`\`
5. For inline code, use single backticks like: \`code\`
6. ALWAYS provide ACTUAL CODE, never placeholders
7. NEVER abbreviate or shorten code blocks
8. ALWAYS include the language identifier after the opening backticks

Example of CORRECT code formatting:
\`\`\`javascript
function example() {
  console.log('This is correct');
}
\`\`\`

Example of INCORRECT code formatting:
_CODEBLOCK0 or INLINECODE0

Failure to follow these rules will result in broken code display for the user.
`;

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

// Text-to-speech endpoint
app.post('/api/tts', async (req, res) => {
  try {
    const { text, language } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }

    console.log(`Generating speech for text: "${text.substring(0, 50)}..." in language: ${language}`);

    // Select appropriate voice based on language
    let voice = "Aaliyah-PlayAI"; // Default English voice

    // Map languages to appropriate voices
    const voiceMap = {
      'en': "Aaliyah-PlayAI",
      'es': "Sofia-PlayAI",  // Spanish voice
      'fr': "Celine-PlayAI", // French voice
      'de': "Hannah-PlayAI", // German voice
      // Add more language-voice mappings as needed
    };

    // Use language-specific voice if available
    if (voiceMap[language]) {
      voice = voiceMap[language];
    }

    try {
      // Generate speech using Groq - using the exact format from your example
      const speech = await groq.audio.speech.create({
        model: "playai-tts",
        voice: voice,
        response_format: "wav", // Changed to wav as in your example
        input: text,
      });

      // Get the audio data
      const audioBuffer = Buffer.from(await speech.arrayBuffer());

      // Set appropriate headers for WAV format
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Length', audioBuffer.length);

      // Send the audio data
      res.send(audioBuffer);

      console.log('Speech generated successfully');
    } catch (speechError) {
      console.error('Specific error in speech generation:', speechError);
      throw speechError; // Re-throw to be caught by the outer try-catch
    }
  } catch (error) {
    console.error('Error generating speech:', error.message);
    console.error('Error details:', error);
    res.status(500).json({ error: 'Failed to generate speech' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
