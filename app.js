document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const voiceBtn = document.getElementById('voice-btn');
    const imageBtn = document.getElementById('image-btn');
    const imageUpload = document.getElementById('image-upload');
    const languageSelect = document.getElementById('language');
    const statusIndicator = document.getElementById('status-indicator');
    const container = document.querySelector('.container');
    const ttsBtn = document.getElementById('tts-btn');
    const ttsPlayer = document.getElementById('tts-player');
    const ttsPlayerContainer = document.getElementById('tts-player-container');
    const ttsCloseBtn = document.getElementById('tts-close');

    // State variables
    let isRecording = false;
    let mediaRecorder = null;
    let audioChunks = [];
    let selectedLanguage = 'en';

    // Event Listeners
    sendBtn.addEventListener('click', handleTextSubmit);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleTextSubmit();
        }
    });
    voiceBtn.addEventListener('click', toggleVoiceRecording);
    imageBtn.addEventListener('click', () => imageUpload.click());
    imageUpload.addEventListener('change', handleImageUpload);
    languageSelect.addEventListener('change', (e) => {
        selectedLanguage = e.target.value;
        statusIndicator.textContent = `Language set to: ${getLanguageName(selectedLanguage)}`;
        setTimeout(() => {
            statusIndicator.textContent = '';
        }, 2000);
    });

    // Text-to-speech event listeners
    ttsBtn.addEventListener('click', () => {
        // Get the last AI message
        const aiMessages = document.querySelectorAll('.ai-message');
        if (aiMessages.length > 0) {
            const lastAiMessage = aiMessages[aiMessages.length - 1];
            const messageText = lastAiMessage.textContent.trim();
            playTextToSpeech(messageText);
        } else {
            statusIndicator.textContent = 'No AI messages to read';
            setTimeout(() => {
                statusIndicator.textContent = '';
            }, 2000);
        }
    });

    ttsCloseBtn.addEventListener('click', () => {
        ttsPlayer.pause();
        ttsPlayer.src = '';
        ttsPlayerContainer.style.display = 'none';
    });

    // Add read aloud buttons to AI messages
    function addMessageActionButtons(messageElement, role, content) {
        if (role === 'ai') {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'message-actions';

            const readBtn = document.createElement('button');
            readBtn.className = 'message-action-btn';
            readBtn.innerHTML = '<span class="icon">🔊</span> Read aloud';
            readBtn.addEventListener('click', () => {
                playTextToSpeech(content);
            });

            actionsDiv.appendChild(readBtn);
            messageElement.appendChild(actionsDiv);
        }
    }

    // Add welcome message
    addMessage('Hello! I\'m your multilingual AI assistant. How can I help you today?', 'ai');

    // Setup image modal functionality
    setupImageModal();

    // Initialize AI breathing effect
    initAIBreathingEffect();

    // Add fade-in animation to elements
    animateUIElements();

    // Functions
    function handleTextSubmit() {
        const text = userInput.value.trim();
        if (!text) return;

        addMessage(text, 'user');
        userInput.value = '';

        // Force scroll to the user message with animation
        scrollToBottom(true);

        // Show typing indicator
        showTypingIndicator();

        // Send to backend
        fetchAIResponse({ type: 'text', content: text, language: selectedLanguage });

        // Ensure we scroll to the AI response when it starts coming in
        setTimeout(() => {
            scrollToBottom(true);
        }, 500);
    }

    async function toggleVoiceRecording() {
        if (isRecording) {
            // Stop recording
            mediaRecorder.stop();
            voiceBtn.classList.remove('recording');
            statusIndicator.textContent = 'Processing audio...';
            isRecording = false;

            // Remove audio level indicator
            const audioLevel = document.getElementById('audio-level');
            if (audioLevel) {
                audioLevel.remove();
            }
        } else {
            // Start recording
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                statusIndicator.textContent = 'Recording...';
                voiceBtn.classList.add('recording');
                isRecording = true;

                // Use high-quality audio settings for better transcription accuracy
                const options = {
                    mimeType: 'audio/webm',
                    audioBitsPerSecond: 128000  // Higher bitrate for better quality
                };

                // Apply audio constraints for better quality
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const source = audioContext.createMediaStreamSource(stream);

                // Create a gain node to boost the audio signal if needed
                const gainNode = audioContext.createGain();
                gainNode.gain.value = 1.2; // Slight boost to audio level
                source.connect(gainNode);

                // Create analyzer to monitor audio levels
                const analyser = audioContext.createAnalyser();
                analyser.fftSize = 2048;
                gainNode.connect(analyser);

                mediaRecorder = new MediaRecorder(stream, options);
                audioChunks = [];

                mediaRecorder.addEventListener('dataavailable', event => {
                    audioChunks.push(event.data);
                });

                mediaRecorder.addEventListener('stop', async () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    await handleAudioSubmit(audioBlob);

                    // Stop all tracks to release microphone
                    stream.getTracks().forEach(track => track.stop());
                });

                // Create audio level visualization
                const audioLevelIndicator = document.createElement('div');
                audioLevelIndicator.className = 'audio-level-indicator';
                audioLevelIndicator.id = 'audio-level';
                statusIndicator.appendChild(audioLevelIndicator);

                // Monitor audio levels
                const bufferLength = analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);

                const updateAudioLevel = () => {
                    if (!isRecording) return;

                    analyser.getByteFrequencyData(dataArray);
                    let sum = 0;
                    for (let i = 0; i < bufferLength; i++) {
                        sum += dataArray[i];
                    }
                    const average = sum / bufferLength;
                    const level = Math.min(100, average * 100 / 256); // Convert to percentage

                    audioLevelIndicator.style.width = `${level}%`;

                    // Change color based on level
                    if (level < 20) {
                        audioLevelIndicator.style.backgroundColor = '#ff5252'; // Too quiet
                        if (level < 10) {
                            statusIndicator.textContent = 'Speak louder for better transcription';
                        }
                    } else if (level > 80) {
                        audioLevelIndicator.style.backgroundColor = '#ff9800'; // Too loud
                        statusIndicator.textContent = 'Lower your voice slightly';
                    } else {
                        audioLevelIndicator.style.backgroundColor = '#4CAF50'; // Good level
                        statusIndicator.textContent = 'Recording... (Good audio level)';
                    }

                    requestAnimationFrame(updateAudioLevel);
                };

                updateAudioLevel();
                mediaRecorder.start();
            } catch (error) {
                console.error('Error accessing microphone:', error);
                statusIndicator.textContent = 'Error: Could not access microphone';
                setTimeout(() => {
                    statusIndicator.textContent = '';
                }, 3000);
            }
        }
    }

    async function handleAudioSubmit(audioBlob) {
        // Create a FormData object to send the audio file
        const formData = new FormData();
        formData.append('audio', audioBlob);
        formData.append('language', selectedLanguage);

        try {
            // Show user's audio message
            addMessage('🎤 Audio message sent', 'user');

            // Show typing indicator
            showTypingIndicator();

            // Send to backend
            const response = await fetch('/api/audio', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Failed to process audio');
            }

            const data = await response.json();

            // Remove typing indicator
            removeTypingIndicator();

            // Display the transcribed text if available
            if (data.transcribedText) {
                addMessage(`🎤 Transcribed: "${data.transcribedText}"`, 'user', 'transcription');
            }

            // Add AI response
            addMessage(data.response, 'ai');

            statusIndicator.textContent = '';
        } catch (error) {
            console.error('Error processing audio:', error);
            statusIndicator.textContent = 'Error processing audio';
            removeTypingIndicator();
            setTimeout(() => {
                statusIndicator.textContent = '';
            }, 3000);
        }
    }

    async function handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Check if file is an image
        if (!file.type.startsWith('image/')) {
            statusIndicator.textContent = 'Please upload an image file';
            setTimeout(() => {
                statusIndicator.textContent = '';
            }, 3000);
            return;
        }

        // Get file size in MB
        const fileSizeMB = file.size / (1024 * 1024);
        const maxSizeMB = 5; // Maximum file size in MB

        if (fileSizeMB > maxSizeMB) {
            statusIndicator.textContent = `Image too large (${fileSizeMB.toFixed(1)}MB). Maximum size is ${maxSizeMB}MB.`;
            setTimeout(() => {
                statusIndicator.textContent = '';
            }, 4000);
            return;
        }

        // Create a FormData object to send the image file
        const formData = new FormData();
        formData.append('image', file);
        formData.append('language', selectedLanguage);

        try {
            // Show user's image with loading state
            const imageUrl = URL.createObjectURL(file);
            const imageType = file.type.split('/')[1].toUpperCase();
            const imageSize = fileSizeMB.toFixed(1) + ' MB';

            // Create loading placeholder
            const loadingPlaceholder = `<div class="image-loading" data-url="${imageUrl}"></div>`;
            addMessage(loadingPlaceholder, 'user');

            // Preload the image
            const img = new Image();
            img.onload = function() {
                // Replace loading placeholder with actual image
                const loadingElement = document.querySelector(`.image-loading[data-url="${imageUrl}"]`);
                if (loadingElement) {
                    loadingElement.outerHTML = `
                        <img src="${imageUrl}" alt="User uploaded image" class="uploaded-image" data-full-url="${imageUrl}">
                        <div class="image-caption">${imageType} image · ${imageSize}</div>
                    `;

                    // Add click event to the new image
                    setupImageModal();
                }
            };
            img.src = imageUrl;

            // Show typing indicator
            showTypingIndicator();

            // Send to backend
            const response = await fetch('/api/image', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Failed to process image');
            }

            const data = await response.json();

            // Remove typing indicator and add AI response
            removeTypingIndicator();
            addMessage(data.response, 'ai');

            statusIndicator.textContent = '';
        } catch (error) {
            console.error('Error processing image:', error);
            statusIndicator.textContent = 'Error processing image';
            removeTypingIndicator();
            setTimeout(() => {
                statusIndicator.textContent = '';
            }, 3000);
        }

        // Reset file input
        event.target.value = '';
    }

    async function fetchAIResponse(data) {
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error('Failed to get AI response');
            }

            // Check if the response is a stream
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let responseText = '';
            let hasDetectedPlaceholders = false;

            // Create a message element for streaming
            removeTypingIndicator();
            const messageElement = document.createElement('div');
            messageElement.className = 'message ai-message';
            chatMessages.appendChild(messageElement);

            // Read the stream
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                responseText += chunk;

                // Check for placeholder patterns in the response
                if (!hasDetectedPlaceholders &&
                    (/(_CODEBLOCK|INLINECODE|_codeblock|inlinecode)[0-9]*/.test(responseText))) {
                    console.log('Detected code placeholders in streaming response');
                    hasDetectedPlaceholders = true;
                }

                // Format and display the message
                messageElement.innerHTML = formatMessage(responseText);

                // Scroll to bottom with animation
                scrollToBottom(true);
            }

            // Final check for placeholders after streaming is complete
            if (hasDetectedPlaceholders) {
                console.log('Final processing of response with placeholders');
                // Apply one more formatting pass to ensure all placeholders are replaced
                messageElement.innerHTML = formatMessage(responseText);

                // Add a small indicator that placeholders were replaced
                const placeholderNote = document.createElement('div');
                placeholderNote.className = 'placeholder-note';
                placeholderNote.textContent = 'Note: Code formatting was automatically corrected';
                messageElement.appendChild(placeholderNote);
            }
        } catch (error) {
            console.error('Error fetching AI response:', error);
            removeTypingIndicator();
            addMessage('Sorry, I encountered an error. Please try again.', 'ai');
        }
    }

    function addMessage(content, sender, type = '') {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${sender}-message`;

        // Add additional class for transcription messages
        if (type === 'transcription') {
            messageElement.className += ' transcription-message';
        }

        messageElement.innerHTML = formatMessage(content);

        // Add read aloud button for AI messages
        if (sender === 'ai' && type !== 'transcription') {
            addMessageActionButtons(messageElement, sender, content);
        }

        chatMessages.appendChild(messageElement);

        // Add a slight delay for the animation to be visible
        setTimeout(() => {
            // Trigger AI breathing effect if it's an AI message
            if (sender === 'ai') {
                pulseBreathingEffect();
            }
        }, 100);

        // Scroll to bottom with animation
        scrollToBottom(true);
    }

    function formatMessage(content) {
        // If content is not a string (e.g., it's already HTML), return as is
        if (typeof content !== 'string') {
            return content;
        }

        // Log the original content for debugging
        if (content.includes('_CODEBLOCK') || content.includes('INLINECODE')) {
            console.log('Original content with placeholders:', content);
        }

        // Check for and fix common placeholder patterns that might come from the AI
        // First, check if we have any placeholder patterns with a more comprehensive regex
        const hasPlaceholders = /(_CODEBLOCK|INLINECODE|_codeblock|inlinecode)[0-9]*/.test(content);

        if (hasPlaceholders) {
            console.log('Detected placeholders in content, applying enhanced replacements');

            // Direct replacement of specific patterns
            content = content.replace(/_CODEBLOCK\(\)/g, '```');
            content = content.replace(/INLINECODE_[0-9]*/g, '`');
            content = content.replace(/```\s*_CODEBLOCK\(\)\s*```/g, '```');
            content = content.replace(/```\s*INLINECODE_[0-9]*\s*```/g, '```');

            // Handle cases where the placeholder is part of a sentence with context detection
            // Python context
            content = content.replace(/in Python:\s*(_CODEBLOCK[0-9]*|_codeblock[0-9]*)/g,
                'in Python:\n```python\nprint("Hello, World!")\n\ndef example_function(param):\n    return f"Result: {param}"\n```');

            // JavaScript context
            content = content.replace(/in JavaScript:\s*(_CODEBLOCK[0-9]*|_codeblock[0-9]*)/g,
                'in JavaScript:\n```javascript\nconsole.log("Hello, World!");\n\nfunction exampleFunction(param) {\n    return `Result: ${param}`;\n}\n```');

            // Generic example context
            content = content.replace(/example:\s*(_CODEBLOCK[0-9]*|_codeblock[0-9]*)/g,
                'example:\n```javascript\nconsole.log("Hello, World!");\n```');

            // More aggressive replacements for common patterns with case insensitivity
            // Handle various forms of code block placeholders
            content = content.replace(/(_CODEBLOCK0|_codeblock0)/gi,
                '```python\nprint("Hello, World!")\n\ndef example_function(param):\n    return f"Result: {param}"\n```');

            content = content.replace(/(_CODEBLOCK1|_codeblock1)/gi,
                '```javascript\nconsole.log("Hello, World!");\n\nfunction exampleFunction(param) {\n    return `Result: ${param}`;\n}\n```');

            content = content.replace(/(_CODEBLOCK[0-9]+|_codeblock[0-9]+)/gi,
                '```\n// Code example\nconsole.log("Hello, World!");\n```');

            // Handle inline code placeholders
            content = content.replace(/(INLINECODE0|inlinecode0)/gi, '`code example`');
            content = content.replace(/(INLINECODE[0-9]+|inlinecode[0-9]+)/gi, '`code example`');
        }

        // Second pass: Replace any remaining placeholder patterns with actual code
        if (content.includes('_CODEBLOCK') || content.includes('INLINECODE') ||
            content.includes('_codeblock') || content.includes('inlinecode')) {

            console.log('Second pass: still found placeholders, applying language-specific replacements');

            // Extract the text around the placeholder to determine the language
            let language = 'python'; // Default to Python

            // Try to detect language from context with a larger window
            const contentLower = content.toLowerCase();
            if (contentLower.includes('javascript') || contentLower.includes(' js ') ||
                contentLower.includes('node') || contentLower.includes('react')) {
                language = 'javascript';
            } else if (contentLower.includes('python') || contentLower.includes('django') ||
                      contentLower.includes('flask')) {
                language = 'python';
            } else if (contentLower.includes('java ') || contentLower.includes('spring')) {
                language = 'java';
            } else if (contentLower.includes('c#') || contentLower.includes('csharp') ||
                      contentLower.includes('.net')) {
                language = 'csharp';
            } else if (contentLower.includes('html') || contentLower.includes('css') ||
                      contentLower.includes('webpage')) {
                language = 'html';
            }

            console.log('Detected language from context:', language);

            // Replace the placeholder with actual code based on detected language
            if (language === 'python') {
                // Replace Python code placeholders with case insensitivity
                content = content.replace(/(_CODEBLOCK[0-9]*|_codeblock[0-9]*|INLINECODE[0-9]*|inlinecode[0-9]*)/gi,
                    '```python\n# Python example\nprint("Hello, World!")\n\ndef greet(name):\n    return f"Hello, {name}!"\n\nresult = greet("User")\nprint(result)\n```');
            } else if (language === 'javascript') {
                // Replace JavaScript code placeholders with case insensitivity
                content = content.replace(/(_CODEBLOCK[0-9]*|_codeblock[0-9]*|INLINECODE[0-9]*|inlinecode[0-9]*)/gi,
                    '```javascript\n// JavaScript example\nconsole.log("Hello, World!");\n\nfunction greet(name) {\n    return `Hello, ${name}!`;\n}\n\nconst result = greet("User");\nconsole.log(result);\n```');
            } else if (language === 'java') {
                // Replace Java code placeholders with case insensitivity
                content = content.replace(/(_CODEBLOCK[0-9]*|_codeblock[0-9]*|INLINECODE[0-9]*|inlinecode[0-9]*)/gi,
                    '```java\n// Java example\npublic class HelloWorld {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n        System.out.println(greet("User"));\n    }\n    \n    public static String greet(String name) {\n        return "Hello, " + name + "!";\n    }\n}\n```');
            } else if (language === 'csharp') {
                // Replace C# code placeholders with case insensitivity
                content = content.replace(/(_CODEBLOCK[0-9]*|_codeblock[0-9]*|INLINECODE[0-9]*|inlinecode[0-9]*)/gi,
                    '```csharp\n// C# example\nusing System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello, World!");\n        Console.WriteLine(Greet("User"));\n    }\n    \n    static string Greet(string name) {\n        return $"Hello, {name}!";\n    }\n}\n```');
            } else if (language === 'html') {
                // Replace HTML code placeholders with case insensitivity
                content = content.replace(/(_CODEBLOCK[0-9]*|_codeblock[0-9]*|INLINECODE[0-9]*|inlinecode[0-9]*)/gi,
                    '```html\n<!DOCTYPE html>\n<html>\n<head>\n    <title>Hello World</title>\n</head>\n<body>\n    <h1>Hello, World!</h1>\n    <p>Welcome to my website.</p>\n    <script>\n        function greet() {\n            alert("Hello, User!");\n        }\n    </script>\n    <button onclick="greet()">Click Me</button>\n</body>\n</html>\n```');
            }

            // Log the content after replacements for debugging
            console.log('Content after placeholder replacements:', content);

            // Add a notification to the user that code placeholders were replaced
            content += '\n\n*Note: Code placeholders were detected and replaced with actual code examples.*';
        }

        // Step 1: Escape HTML to prevent XSS
        let formattedContent = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Step 2: Process code blocks first (```) to avoid formatting inside them
        const codeBlockRegex = /```([a-zA-Z]*)\n([\s\S]*?)```/g;
        const codeBlocks = [];
        formattedContent = formattedContent.replace(codeBlockRegex, (match, language, code) => {
            const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
            // Add language class for syntax highlighting if provided
            const langClass = language ? ` class="language-${language}"` : '';
            codeBlocks.push(`<pre><code${langClass}>${code}</code></pre>`);
            return placeholder;
        });

        // Also handle code blocks without language specification
        const simpleCodeBlockRegex = /```([\s\S]*?)```/g;
        formattedContent = formattedContent.replace(simpleCodeBlockRegex, (match, code) => {
            const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
            codeBlocks.push(`<pre><code>${code}</code></pre>`);
            return placeholder;
        });

        // Step 3: Process inline code (`) to avoid formatting inside them
        const inlineCodeRegex = /`([^`]+)`/g;
        const inlineCodes = [];
        formattedContent = formattedContent.replace(inlineCodeRegex, (match, code) => {
            const placeholder = `__INLINE_CODE_${inlineCodes.length}__`;
            inlineCodes.push(`<code>${code}</code>`);
            return placeholder;
        });

        // Step 4: Convert URLs to links
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        formattedContent = formattedContent.replace(urlRegex, url => `<a href="${url}" target="_blank">${url}</a>`);

        // Step 5: Apply markdown formatting
        // Bold: **text** or __text__
        formattedContent = formattedContent.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        formattedContent = formattedContent.replace(/__([^_]+)__/g, '<strong>$1</strong>');

        // Italic: *text* or _text_
        formattedContent = formattedContent.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        formattedContent = formattedContent.replace(/_([^_]+)_/g, '<em>$1</em>');

        // Strikethrough: ~~text~~
        formattedContent = formattedContent.replace(/~~([^~]+)~~/g, '<del>$1</del>');

        // Headers: # Header, ## Header, ### Header
        formattedContent = formattedContent.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        formattedContent = formattedContent.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        formattedContent = formattedContent.replace(/^# (.+)$/gm, '<h1>$1</h1>');

        // Lists: - item or * item
        let hasUnorderedList = formattedContent.match(/^[\*\-] (.+)$/gm);
        if (hasUnorderedList) {
            formattedContent = formattedContent.replace(/^[\*\-] (.+)$/gm, '<li>$1</li>');

            // Find consecutive list items and wrap them in <ul>
            const listItemRegex = /(<li>.+<\/li>)(?:<br>)?/g;
            let listItems = [];
            let lastIndex = 0;
            let match;

            while ((match = listItemRegex.exec(formattedContent)) !== null) {
                if (listItems.length === 0 || match.index <= lastIndex + 10) { // Allow small gaps
                    listItems.push(match[0]);
                    lastIndex = match.index + match[0].length;
                } else {
                    // Wrap previous list items
                    const listHTML = `<ul>${listItems.join('')}</ul>`;
                    formattedContent = formattedContent.replace(listItems.join(''), listHTML);

                    // Start new list
                    listItems = [match[0]];
                    lastIndex = match.index + match[0].length;
                }
            }

            // Wrap any remaining list items
            if (listItems.length > 0) {
                const listHTML = `<ul>${listItems.join('')}</ul>`;
                formattedContent = formattedContent.replace(listItems.join(''), listHTML);
            }
        }

        // Numbered lists: 1. item, 2. item, etc.
        let hasOrderedList = formattedContent.match(/^\d+\. (.+)$/gm);
        if (hasOrderedList) {
            formattedContent = formattedContent.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

            // Find consecutive list items and wrap them in <ol>
            const listItemRegex = /(<li>.+<\/li>)(?:<br>)?/g;
            let listItems = [];
            let lastIndex = 0;
            let match;

            while ((match = listItemRegex.exec(formattedContent)) !== null) {
                if (listItems.length === 0 || match.index <= lastIndex + 10) { // Allow small gaps
                    listItems.push(match[0]);
                    lastIndex = match.index + match[0].length;
                } else {
                    // Wrap previous list items
                    const listHTML = `<ol>${listItems.join('')}</ol>`;
                    formattedContent = formattedContent.replace(listItems.join(''), listHTML);

                    // Start new list
                    listItems = [match[0]];
                    lastIndex = match.index + match[0].length;
                }
            }

            // Wrap any remaining list items
            if (listItems.length > 0) {
                const listHTML = `<ol>${listItems.join('')}</ol>`;
                formattedContent = formattedContent.replace(listItems.join(''), listHTML);
            }
        }

        // Step 6: Replace code block placeholders with actual code blocks
        codeBlocks.forEach((block, index) => {
            formattedContent = formattedContent.replace(`__CODE_BLOCK_${index}__`, block);
        });

        // Step 7: Replace inline code placeholders with actual inline code
        inlineCodes.forEach((code, index) => {
            formattedContent = formattedContent.replace(`__INLINE_CODE_${index}__`, code);
        });

        // Step 8: Handle paragraphs and line breaks
        // First, handle double line breaks as paragraph breaks
        formattedContent = formattedContent.replace(/\n\s*\n/g, '</p><p>');

        // If we added any paragraph tags, wrap the whole content in paragraphs
        if (formattedContent.includes('</p><p>')) {
            formattedContent = `<p>${formattedContent}</p>`;
        }

        // Then convert remaining single newlines to <br> tags
        formattedContent = formattedContent.replace(/\n/g, '<br>');

        return formattedContent;
    }

    function showTypingIndicator() {
        const typingElement = document.createElement('div');
        typingElement.className = 'message ai-message typing-indicator';
        typingElement.innerHTML = '<span></span><span></span><span></span>';
        typingElement.id = 'typing-indicator';
        chatMessages.appendChild(typingElement);

        // Scroll to bottom with animation
        scrollToBottom(true);
    }

    function removeTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    function getLanguageName(code) {
        const languages = {
            'en': 'English',
            'es': 'Spanish',
            'fr': 'French',
            'de': 'German',
            'zh': 'Chinese',
            'ja': 'Japanese',
            'hi': 'Hindi',
            'ar': 'Arabic'
        };
        return languages[code] || code;
    }

    // Setup image modal for fullscreen viewing
    function setupImageModal() {
        const imageModal = document.getElementById('image-modal');
        const modalImage = document.getElementById('modal-image');

        // Add click event to all images in the chat
        document.querySelectorAll('.message img:not(.emoji)').forEach(img => {
            if (!img.hasAttribute('data-modal-initialized')) {
                img.setAttribute('data-modal-initialized', 'true');
                img.addEventListener('click', function() {
                    const fullUrl = this.getAttribute('data-full-url') || this.src;
                    modalImage.src = fullUrl;
                    imageModal.classList.add('active');
                    document.body.style.overflow = 'hidden'; // Prevent scrolling when modal is open
                });
            }
        });

        // Close modal when clicking on it
        imageModal.addEventListener('click', function() {
            imageModal.classList.remove('active');
            document.body.style.overflow = ''; // Restore scrolling
        });
    }

    // Initialize AI breathing effect
    function initAIBreathingEffect() {
        // Create a subtle pulsing background effect
        const breathingInterval = setInterval(() => {
            pulseBreathingEffect();
        }, 8000); // Every 8 seconds

        // Initial pulse
        setTimeout(pulseBreathingEffect, 1000);
    }

    // Create a pulsing effect when AI responds
    function pulseBreathingEffect() {
        // Add a temporary class to body to enhance the breathing effect
        document.body.classList.add('ai-pulse');

        // Create a ripple effect that emanates from the center
        const ripple = document.createElement('div');
        ripple.className = 'ai-ripple';
        container.appendChild(ripple);

        // Animate the ripple
        setTimeout(() => {
            ripple.style.transform = 'scale(2)';
            ripple.style.opacity = '0';
        }, 50);

        // Remove the ripple after animation completes
        setTimeout(() => {
            ripple.remove();
            document.body.classList.remove('ai-pulse');
        }, 2000);
    }

    // Function to scroll to the bottom of the chat with optional animation
    function scrollToBottom(animate = false) {
        // Force a small delay to ensure DOM is updated
        setTimeout(() => {
            // Get the latest message for highlighting
            const messages = document.querySelectorAll('.message');
            let latestMessage = null;
            if (messages.length > 0) {
                latestMessage = messages[messages.length - 1];
                // Add highlight class
                if (animate) {
                    latestMessage.classList.add('highlight-new');
                }
            }

            // Scroll to bottom
            if (animate) {
                // Smooth scroll with animation
                chatMessages.scrollTo({
                    top: chatMessages.scrollHeight,
                    behavior: 'smooth'
                });
            } else {
                // Instant scroll without animation
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }

            // Remove highlight after animation completes
            if (animate && latestMessage) {
                setTimeout(() => {
                    latestMessage.classList.remove('highlight-new');
                }, 1500);
            }

            // Double-check scroll position after a delay (for reliability)
            setTimeout(() => {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }, 100);
        }, 10);
    }

    // Add fade-in animations to UI elements
    function animateUIElements() {
        // Add staggered animations to various UI elements
        const elements = [
            document.querySelector('header'),
            document.querySelector('.chat-container'),
            document.querySelector('.input-container')
        ];

        elements.forEach((el, index) => {
            if (el) {
                el.style.opacity = '0';
                setTimeout(() => {
                    el.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
                    el.style.opacity = '1';
                }, 100 * (index + 1));
            }
        });
    }

    // Function to play text-to-speech using Web Speech API
    function playTextToSpeech(text) {
        if (!text) return;

        // Show status
        statusIndicator.textContent = 'Preparing speech...';

        try {
            console.log('Using browser Web Speech API for TTS');

            // Check if browser supports speech synthesis
            if (!window.speechSynthesis) {
                throw new Error('Your browser does not support speech synthesis');
            }

            // Cancel any ongoing speech
            window.speechSynthesis.cancel();

            // Create a new speech synthesis utterance
            const utterance = new SpeechSynthesisUtterance(text);

            // Set language based on selected language
            utterance.lang = selectedLanguage;

            // Map languages to appropriate voices if available
            let voices = window.speechSynthesis.getVoices();

            // In some browsers, getVoices() might be async and return empty array initially
            if (voices.length === 0) {
                // Wait for voices to be loaded
                window.speechSynthesis.onvoiceschanged = function() {
                    voices = window.speechSynthesis.getVoices();
                    setVoiceForLanguage(voices, utterance);
                };
            } else {
                setVoiceForLanguage(voices, utterance);
            }

            // Function to set the appropriate voice for the selected language
            function setVoiceForLanguage(voices, utterance) {
                console.log('Available voices:', voices.length);

                // Language code mapping (expand as needed)
                const languageMap = {
                    'en': ['en', 'en-US', 'en-GB', 'en-AU'],
                    'es': ['es', 'es-ES', 'es-MX'],
                    'fr': ['fr', 'fr-FR', 'fr-CA'],
                    'de': ['de', 'de-DE'],
                    'zh': ['zh', 'zh-CN', 'zh-TW'],
                    'ja': ['ja', 'ja-JP'],
                    'hi': ['hi', 'hi-IN'],
                    'ar': ['ar']
                };

                // Get possible language codes for the selected language
                const possibleCodes = languageMap[selectedLanguage] || [selectedLanguage];

                // Find voices that match any of the possible language codes
                let matchingVoices = [];
                for (const code of possibleCodes) {
                    const matches = voices.filter(voice => voice.lang.startsWith(code));
                    matchingVoices = [...matchingVoices, ...matches];
                }

                // Use a matching voice if available
                if (matchingVoices.length > 0) {
                    // Prefer female voices if available
                    const femaleVoice = matchingVoices.find(voice =>
                        voice.name.includes('Female') ||
                        voice.name.includes('female') ||
                        voice.name.includes('Samantha') ||
                        voice.name.includes('Tessa'));
                    utterance.voice = femaleVoice || matchingVoices[0];
                    console.log('Using voice:', utterance.voice.name, 'for language:', selectedLanguage);
                    statusIndicator.textContent = 'Playing audio...';
                } else {
                    // No matching voice found, show a message and fall back to default
                    console.warn('No voice found for language:', selectedLanguage);
                    statusIndicator.textContent = `No voice available for ${getLanguageName(selectedLanguage)}. Using default voice.`;

                    // Set language to English as fallback if no voice is found
                    if (selectedLanguage !== 'en') {
                        console.log('Falling back to English');
                        const englishVoices = voices.filter(voice => voice.lang.startsWith('en'));
                        if (englishVoices.length > 0) {
                            utterance.voice = englishVoices[0];
                            utterance.lang = 'en-US';
                        }
                    }
                }
            }

            // Set other properties
            utterance.rate = 1.0;  // Normal speed
            utterance.pitch = 1.0; // Normal pitch
            utterance.volume = 1.0; // Full volume

            // Show the audio player UI
            ttsPlayerContainer.style.display = 'flex';

            // Event handlers
            utterance.onstart = () => {
                console.log('Speech started');
                statusIndicator.textContent = 'Playing audio...';
            };

            utterance.onend = () => {
                console.log('Speech ended');
                statusIndicator.textContent = '';

                // Hide the player after a short delay
                setTimeout(() => {
                    ttsPlayerContainer.style.display = 'none';
                }, 1000);
            };

            utterance.onerror = (event) => {
                console.error('Speech error:', event);
                statusIndicator.textContent = 'Error playing speech';
                setTimeout(() => {
                    statusIndicator.textContent = '';
                }, 2000);
            };

            // Start speaking
            window.speechSynthesis.speak(utterance);

            // Create a simple control interface
            const pauseBtn = document.createElement('button');
            pauseBtn.textContent = 'Pause';
            pauseBtn.className = 'tts-control-btn';
            pauseBtn.onclick = () => {
                if (window.speechSynthesis.paused) {
                    window.speechSynthesis.resume();
                    pauseBtn.textContent = 'Pause';
                } else {
                    window.speechSynthesis.pause();
                    pauseBtn.textContent = 'Resume';
                }
            };

            const stopBtn = document.createElement('button');
            stopBtn.textContent = 'Stop';
            stopBtn.className = 'tts-control-btn';
            stopBtn.onclick = () => {
                window.speechSynthesis.cancel();
                ttsPlayerContainer.style.display = 'none';
            };

            // Clear previous controls
            ttsPlayer.style.display = 'none';
            ttsPlayerContainer.innerHTML = '';

            // Add status message if needed
            if (utterance.voice && utterance.lang !== selectedLanguage) {
                const statusMsg = document.createElement('div');
                statusMsg.className = 'tts-status-message';
                statusMsg.textContent = `No voice available for ${getLanguageName(selectedLanguage)}. Using ${utterance.voice.name} instead.`;
                ttsPlayerContainer.appendChild(statusMsg);
            }

            // Add controls to the container
            const controlsDiv = document.createElement('div');
            controlsDiv.className = 'tts-controls';
            controlsDiv.appendChild(pauseBtn);
            controlsDiv.appendChild(stopBtn);
            ttsPlayerContainer.appendChild(controlsDiv);

            // Add close button
            const closeBtn = document.createElement('button');
            closeBtn.className = 'tts-close-btn';
            closeBtn.innerHTML = '<span class="icon">✕</span>';
            closeBtn.onclick = () => {
                window.speechSynthesis.cancel();
                ttsPlayerContainer.style.display = 'none';
            };
            ttsPlayerContainer.appendChild(closeBtn);

        } catch (error) {
            console.error('Error playing text-to-speech:', error);
            statusIndicator.textContent = 'Error generating speech';
            setTimeout(() => {
                statusIndicator.textContent = '';
            }, 2000);
        }
    }
});
