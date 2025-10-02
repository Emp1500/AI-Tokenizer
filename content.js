// Function to calculate tokens with platform-specific rules
function calculateTokens(text, platform = window.location.hostname) {
  if (!text) return 0;
  
  try {
    // Get the appropriate token patterns for the platform
    const patterns = MODEL_TOKENS[platform] || MODEL_TOKENS['chat.openai.com'];
    let tokenCount = 0;
    let remaining = text;

    // Handle special tokens first
    patterns.specialTokens.forEach(token => {
      const regex = new RegExp(escapeRegExp(token), 'g');
      remaining = remaining.replace(regex, match => {
        tokenCount += 1;
        return ' ';
      });
    });

    // Process the remaining text
    const words = remaining.split(/\s+/).filter(Boolean);
    for (const word of words) {
      if (COMMON_WORDS.has(word.toLowerCase())) {
        tokenCount += 1;
        continue;
      }

      // Handle different character types
      const ascii = word.match(UNICODE_RANGES.ASCII);
      const cjk = word.match(UNICODE_RANGES.CJK);
      const emoji = word.match(UNICODE_RANGES.EMOJI);
      const special = word.match(UNICODE_RANGES.SPECIAL);

      if (ascii) tokenCount += Math.ceil(ascii[0].length / patterns.avgTokenLength);
      if (cjk) tokenCount += cjk[0].length;
      if (emoji) tokenCount += emoji[0].length * 2;
      if (special) tokenCount += Math.ceil(special[0].length / 2);
    }

    return Math.max(1, Math.ceil(tokenCount));
  } catch (error) {
    console.error('[AI Token Monitor] Token calculation error:', error);
    return Math.ceil(text.length / 4); // Fallback calculation
  }
}

// Utility function to escape regex special characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Track processed nodes with their text content
const processedNodes = new WeakMap();
let lastText = '';
let updateTimer = null;

// CSS Selectors for different AI chat platforms
const PLATFORM_SELECTORS = {
  'claude.ai': {
    container: '.main-container',
    input: '[contenteditable="true"]',
    response: '.prose',
    responseContainer: '.claude-response'
  },
  'gemini.google.com': {
    container: '.conversation-container',
    input: 'textarea[placeholder],div[contenteditable="true"]',
    response: '.response-container,.message-content',
    responseContainer: '.model-response-text'
  },
  'chat.openai.com': {
    container: 'main',
    input: 'textarea[data-id="root"]',
    response: '.markdown-content',
    responseContainer: '.group.w-full'
  },
  'bard.google.com': {
    container: '#conversation-area',
    input: 'textarea,[contenteditable="true"]',
    response: '.response-content',
    responseContainer: '.model-response'
  }
};

// Get selectors for current platform
function getCurrentPlatformSelectors() {
  const host = window.location.hostname;
  return PLATFORM_SELECTORS[host] || {
    container: '.main-container',
    input: '[contenteditable="true"]'
  };
}

// Function to process text nodes with error handling
function processTextContent(node, isResponse = false) {
  try {
    if (processedNodes.has(node)) {
      const oldText = processedNodes.get(node);
      const newText = node.textContent.trim();
      if (oldText === newText) return;
    }

    const text = node.textContent.trim();
    if (!text) return;

    processedNodes.set(node, text);
    
    const platform = window.location.hostname;
    const tokens = calculateTokens(text, platform);
    const chars = text.length;

    chrome.runtime.sendMessage({
      type: isResponse ? 'responseUpdate' : 'textUpdate',
      text: text,
      tokens: tokens,
      chars: chars,
      isResponse: isResponse,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[AI Token Monitor] Error processing text:', error);
  }
}

// Function to monitor input with intelligent debouncing
function monitorInput(inputElement) {
  let lastProcessedText = '';
  let debounceTimer;

  const handleInput = () => {
    clearTimeout(debounceTimer);
    
    debounceTimer = setTimeout(() => {
      try {
        const text = inputElement.value || inputElement.textContent || '';
        
        if (text !== lastProcessedText) {
          lastProcessedText = text;
          const platform = window.location.hostname;
          const tokens = calculateTokens(text, platform);
          const chars = text.length;

          chrome.runtime.sendMessage({
            type: 'inputUpdate',
            text: text,
            tokens: tokens,
            chars: chars,
            timestamp: Date.now()
          });
        }
      } catch (error) {
        console.error('[AI Token Monitor] Input processing error:', error);
      }
    }, 100);
  };

  const events = ['input', 'keyup', 'change', 'paste'];
  events.forEach(event => inputElement.addEventListener(event, handleInput));
}

// Function to find and monitor all input fields
function findAndMonitorInputs() {
  const selectors = getCurrentPlatformSelectors();
  const inputs = document.querySelectorAll(selectors.input);
  inputs.forEach(input => monitorInput(input));
}

// Function to initialize observers with enhanced monitoring
function initializeObserver() {
  const selectors = getCurrentPlatformSelectors();
  const targetNode = document.querySelector(selectors.container);

  if (targetNode) {
    findAndMonitorInputs();

    const config = {
      childList: true,
      subtree: true,
      characterData: true,
      characterDataOldValue: true,
      attributes: true,
      attributeFilter: ['contenteditable', 'value']
    };

    const observer = new MutationObserver((mutations) => {
      let shouldCheckInputs = false;
      let changedNodes = new Set();

      mutations.forEach(mutation => {
        switch (mutation.type) {
          case 'childList':
            shouldCheckInputs = true;
            mutation.addedNodes.forEach(node => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                const responses = node.querySelectorAll(selectors.response);
                responses.forEach(response => changedNodes.add(response));
              }
            });
            break;
            
          case 'characterData':
            const closestResponse = mutation.target.parentElement?.closest(selectors.response);
            if (closestResponse) changedNodes.add(closestResponse);
            break;
            
          case 'attributes':
            if (mutation.target.matches(selectors.input)) {
              monitorInput(mutation.target);
            }
            break;
        }
      });

      changedNodes.forEach(node => processTextContent(node, true));
      if (shouldCheckInputs) findAndMonitorInputs();
    });

    observer.observe(targetNode, config);
  } else {
    setTimeout(initializeObserver, 1000);
  }
}

// Start monitoring
const startMonitoring = () => {
  try {
    initializeObserver();
    // Force initial check
    const selectors = getCurrentPlatformSelectors();
    document.querySelectorAll(selectors.response).forEach(node => processTextContent(node, true));
  } catch (error) {
    console.error('[AI Token Monitor] Startup error:', error);
  }
};

// Start monitoring on load and URL changes
startMonitoring();
document.addEventListener('DOMContentLoaded', startMonitoring);

// Monitor URL changes for single-page applications
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    startMonitoring();
  }
}).observe(document, {subtree: true, childList: true});