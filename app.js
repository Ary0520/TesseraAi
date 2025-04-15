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

    // Add welcome message
    addMessage('Hello! I\'m your multilingual AI assistant. How can I help you today?', 'ai');

    // Setup image modal functionality
    setupImageModal();

    // Functions
    function handleTextSubmit() {
        const text = userInput.value.trim();
        if (!text) return;

        addMessage(text, 'user');
        userInput.value = '';

        // Show typing indicator
        showTypingIndicator();

        // Send to backend
        fetchAIResponse({ type: 'text', content: text, language: selectedLanguage });
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
                messageElement.innerHTML = formatMessage(responseText);

                // Scroll to bottom
                chatMessages.scrollTop = chatMessages.scrollHeight;
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
        chatMessages.appendChild(messageElement);

        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function formatMessage(content) {
        // If content is not a string (e.g., it's already HTML), return as is
        if (typeof content !== 'string') {
            return content;
        }

        // Step 1: Escape HTML to prevent XSS
        let formattedContent = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Step 2: Process code blocks first (```) to avoid formatting inside them
        const codeBlockRegex = /```([\s\S]*?)```/g;
        const codeBlocks = [];
        formattedContent = formattedContent.replace(codeBlockRegex, (match, code) => {
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

        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
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
});
