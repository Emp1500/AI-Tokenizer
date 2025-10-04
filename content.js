// Enhanced content.js with improved monitoring and performance

// Performance monitoring
const performanceMetrics = {
  tokenCalculations: 0,
  avgCalculationTime: 0,
  cacheHits: 0,
  cacheMisses: 0
};

// Debounce utility with leading and trailing options
function debounce(func, wait, options = {}) {
  let timeout, lastArgs, lastThis, lastCallTime;
  const { leading = false, trailing = true, maxWait } = options;
  let lastInvokeTime = 0;

  function invokeFunc(time) {
    const args = lastArgs;
    const thisArg = lastThis;
    lastArgs = lastThis = undefined;
    lastInvokeTime = time;
    return func.apply(thisArg, args);
  }

  function leadingEdge(time) {
    lastInvokeTime = time;
    timeout = setTimeout(timerExpired, wait);
    return leading ? invokeFunc(time) : undefined;
  }

  function remainingWait(time) {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;
    const result = wait - timeSinceLastCall;
    return maxWait ? Math.min(result, maxWait - timeSinceLastInvoke) : result;
  }

  function shouldInvoke(time) {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;
    return lastCallTime === undefined || timeSinceLastCall >= wait ||
      timeSinceLastCall < 0 || (maxWait && timeSinceLastInvoke >= maxWait);
  }

  function timerExpired() {
    const time = Date.now();
    if (shouldInvoke(time)) {
      return trailingEdge(time);
    }
    timeout = setTimeout(timerExpired, remainingWait(time));
  }

  function trailingEdge(time) {
    timeout = undefined;
    if (trailing && lastArgs) {
      return invokeFunc(time);
    }
    lastArgs = lastThis = undefined;
  }

  function debounced(...args) {
    const time = Date.now();
    lastArgs = args;
    lastThis = this;
    lastCallTime = time;

    if (shouldInvoke(time)) {
      if (timeout === undefined) {
        return leadingEdge(time);
      }
      if (maxWait) {
        timeout = setTimeout(timerExpired, wait);
        return invokeFunc(time);
      }
    }
    if (timeout === undefined) {
      timeout = setTimeout(timerExpired, wait);
    }
  }

  debounced.cancel = () => {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
    lastInvokeTime = 0;
    lastArgs = lastCallTime = lastThis = timeout = undefined;
  };

  return debounced;
}

// Enhanced platform detection with fallbacks
const PLATFORM_CONFIGS = {
  'claude.ai': {
    selectors: {
      input: '[contenteditable="true"], .ProseMirror, textarea[placeholder*="Message"]',
      response: '.prose, .assistant-message, [data-testid="message-content"]',
      container: 'main, .main-container, #root',
      typing: '.typing-indicator, .loading-indicator'
    },
    features: {
      streamingResponse: true,
      codeBlocks: true,
      markdown: true
    }
  },
  'chat.openai.com': {
    selectors: {
      input: '#prompt-textarea, textarea[data-id="root"], .text-input',
      response: '.markdown, .message-content, [data-message-author-role="assistant"]',
      container: 'main, .flex.flex-col',
      typing: '.typing-indicator, .result-streaming'
    },
    features: {
      streamingResponse: true,
      codeBlocks: true,
      markdown: true
    }
  },
  'gemini.google.com': {
    selectors: {
      input: '.input-area textarea, [contenteditable="true"], rich-textarea',
      response: '.model-response, .message-content, .response-text',
      container: '.conversation-container, .chat-container, main',
      typing: '.loading-indicator, .generating-indicator'
    },
    features: {
      streamingResponse: true,
      codeBlocks: true,
      markdown: true
    }
  },
  'bard.google.com': {
    selectors: {
      input: 'textarea, [contenteditable="true"], .input-field',
      response: '.response-content, .model-response, .message-content',
      container: '#conversation-area, .chat-area, main',
      typing: '.loading, .thinking-indicator'
    },
    features: {
      streamingResponse: true,
      codeBlocks: true,
      markdown: false
    }
  }
};

// Get current platform configuration
function getPlatformConfig() {
  const hostname = window.location.hostname;
  return PLATFORM_CONFIGS[hostname] || {
    selectors: {
      input: 'textarea, [contenteditable="true"]',
      response: '.message, .response',
      container: 'body',
      typing: '.loading, .typing'
    },
    features: {
      streamingResponse: false,
      codeBlocks: false,
      markdown: false
    }
  };
}

// Text extraction with better handling of complex DOM
function extractTextContent(element) {
  if (!element) return '';
  
  let text = '';
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
        // Skip script and style elements
        if (node.nodeType === Node.ELEMENT_NODE) {
          const tagName = node.tagName.toLowerCase();
          if (tagName === 'script' || tagName === 'style' || tagName === 'noscript') {
            return NodeFilter.FILTER_REJECT;
          }
          // Handle code blocks specially
          if (tagName === 'code' || tagName === 'pre') {
            return NodeFilter.FILTER_ACCEPT;
          }
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let node;
  let inCodeBlock = false;
  while (node = walker.nextNode()) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      if (tagName === 'code' || tagName === 'pre') {
        inCodeBlock = true;
        text += '\n```\n';
      } else if (tagName === 'br' || tagName === 'p' || tagName === 'div') {
        text += '\n';
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const nodeText = node.textContent;
      if (nodeText.trim()) {
        text += inCodeBlock ? nodeText : nodeText.trim() + ' ';
      }
    }
    
    if (inCodeBlock && node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      if (tagName !== 'code' && tagName !== 'pre') {
        inCodeBlock = false;
        text += '\n```\n';
      }
    }
  }
  
  return text.trim();
}

// Content hash for efficient change detection
function hashContent(text) {
  if (!text) return '0';
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

// Track processed content with hashes
const processedContent = new Map();
const streamingBuffers = new Map();

// Process and send token update
function processTokenUpdate(element, type = 'response', isStreaming = false) {
  const startTime = performance.now();
  
  try {
    const text = extractTextContent(element);
    const hash = hashContent(text);
    
    // Check if content has changed
    const elementId = element.id || element.className || 'unknown';
    const lastHash = processedContent.get(elementId);
    
    if (lastHash === hash && !isStreaming) {
      performanceMetrics.cacheHits++;
      return; // No change
    }
    
    performanceMetrics.cacheMisses++;
    processedContent.set(elementId, hash);
    
    // Calculate tokens
    const platform = window.location.hostname;
    const tokenDetails = getTokenDetails(text, platform);
    
    // Track performance
    const calculationTime = performance.now() - startTime;
    performanceMetrics.tokenCalculations++;
    performanceMetrics.avgCalculationTime = 
      (performanceMetrics.avgCalculationTime * (performanceMetrics.tokenCalculations - 1) + calculationTime) / 
      performanceMetrics.tokenCalculations;
    
    // Send update to background script
    chrome.runtime.sendMessage({
      type: type === 'input' ? 'inputUpdate' : 'responseUpdate',
      text: text.substring(0, 1000), // Send sample for debugging
      tokens: tokenDetails.count,
      chars: text.length,
      platform: tokenDetails.platform,
      avgTokenLength: tokenDetails.avgTokenLength,
      isStreaming: isStreaming,
      timestamp: Date.now(),
      metrics: performanceMetrics
    });
    
  } catch (error) {
    console.error('[AI Token Monitor] Processing error:', error);
  }
}

// Debounced processors for different update types
const processInputUpdate = debounce((element) => {
  processTokenUpdate(element, 'input', false);
}, 150, { leading: true, trailing: true });

const processResponseUpdate = debounce((element, isStreaming) => {
  processTokenUpdate(element, 'response', isStreaming);
}, isStreaming => isStreaming ? 100 : 300, { leading: false, trailing: true });

// Monitor input fields with better event handling
function monitorInputField(input) {
  if (!input || input.hasAttribute('data-token-monitor')) return;
  
  input.setAttribute('data-token-monitor', 'true');
  
  // Create unified handler
  const handleInputChange = () => processInputUpdate(input);
  
  // Monitor different types of input
  if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
    input.addEventListener('input', handleInputChange);
    input.addEventListener('change', handleInputChange);
  } else if (input.contentEditable === 'true' || input.contentEditable === '') {
    // ContentEditable elements
    input.addEventListener('input', handleInputChange);
    input.addEventListener('DOMCharacterDataModified', handleInputChange);
    
    // Monitor keyboard events for better responsiveness
    input.addEventListener('keyup', debounce(handleInputChange, 500));
  }
  
  // Handle paste events
  input.addEventListener('paste', () => {
    setTimeout(handleInputChange, 50);
  });
}

// Detect streaming responses
function isStreamingResponse(element) {
  const config = getPlatformConfig();
  if (!config.features.streamingResponse) return false;
  
  // Check for typing indicators
  const typingIndicators = document.querySelectorAll(config.selectors.typing);
  if (typingIndicators.length > 0) return true;
  
  // Check if element is still being modified
  const elementId = element.id || element.className || Math.random().toString();
  const buffer = streamingBuffers.get(elementId) || { lastLength: 0, count: 0 };
  const currentLength = element.textContent.length;
  
  if (currentLength > buffer.lastLength) {
    buffer.lastLength = currentLength;
    buffer.count++;
    streamingBuffers.set(elementId, buffer);
    return buffer.count > 1; // Consider streaming after multiple updates
  }
  
  return false;
}

// Initialize mutation observer with optimizations
function initializeObserver() {
  const config = getPlatformConfig();
  let observer = null;
  
  const observerCallback = debounce((mutations) => {
    const elementsToProcess = new Set();
    const inputsToCheck = new Set();
    
    for (const mutation of mutations) {
      // Handle added nodes
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check for response elements
            const responses = node.querySelectorAll(config.selectors.response);
            responses.forEach(r => elementsToProcess.add(r));
            
            // Check for input elements
            const inputs = node.querySelectorAll(config.selectors.input);
            inputs.forEach(i => inputsToCheck.add(i));
            
            // Check if node itself is relevant
            if (node.matches && node.matches(config.selectors.response)) {
              elementsToProcess.add(node);
            }
            if (node.matches && node.matches(config.selectors.input)) {
              inputsToCheck.add(node);
            }
          }
        });
      }
      
      // Handle character data changes
      if (mutation.type === 'characterData') {
        const parent = mutation.target.parentElement;
        if (parent) {
          const response = parent.closest(config.selectors.response);
          if (response) elementsToProcess.add(response);
        }
      }
      
      // Handle attribute changes (contenteditable, etc.)
      if (mutation.type === 'attributes' && mutation.target.matches) {
        if (mutation.target.matches(config.selectors.input)) {
          inputsToCheck.add(mutation.target);
        }
      }
    }
    
    // Process collected elements
    elementsToProcess.forEach(element => {
      const streaming = isStreamingResponse(element);
      processResponseUpdate(element, streaming);
    });
    
    inputsToCheck.forEach(input => monitorInputField(input));
  }, 50, { leading: false, trailing: true });
  
  function startObserving() {
    const container = document.querySelector(config.selectors.container);
    if (!container) {
      setTimeout(startObserving, 500);
      return;
    }
    
    // Initial setup
    document.querySelectorAll(config.selectors.input).forEach(monitorInputField);
    document.querySelectorAll(config.selectors.response).forEach(element => {
      processTokenUpdate(element, 'response', false);
    });
    
    // Start observing
    observer = new MutationObserver(observerCallback);
    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['contenteditable', 'value', 'class', 'style']
    });
    
    console.log('[AI Token Monitor] Observer initialized for', window.location.hostname);
  }
  
  // Clean up function
  function cleanup() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    processedContent.clear();
    streamingBuffers.clear();
  }
  
  // Handle visibility changes to pause/resume monitoring
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cleanup();
    } else {
      startObserving();
    }
  });
  
  startObserving();
  
  return { cleanup, restart: startObserving };
}

// Performance optimization: Batch updates
class UpdateBatcher {
  constructor(flushInterval = 100) {
    this.queue = [];
    this.flushInterval = flushInterval;
    this.timer = null;
  }
  
  add(update) {
    this.queue.push(update);
    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.flushInterval);
    }
  }
  
  flush() {
    if (this.queue.length === 0) return;
    
    // Combine updates by type
    const combined = {
      inputTokens: 0,
      inputChars: 0,
      outputTokens: 0,
      outputChars: 0,
      updates: []
    };
    
    this.queue.forEach(update => {
      if (update.type === 'inputUpdate') {
        combined.inputTokens = update.tokens; // Use latest
        combined.inputChars = update.chars;
      } else {
        combined.outputTokens += update.tokens;
        combined.outputChars += update.chars;
      }
      combined.updates.push(update);
    });
    
    // Send batched update
    chrome.runtime.sendMessage({
      type: 'batchUpdate',
      ...combined,
      timestamp: Date.now()
    });
    
    this.queue = [];
    this.timer = null;
  }
}

const updateBatcher = new UpdateBatcher(100);

// Initialize on page load
let observerControl = null;

function initialize() {
  console.log('[AI Token Monitor] Initializing for', window.location.hostname);
  
  // Clear any existing observers
  if (observerControl) {
    observerControl.cleanup();
  }
  
  // Start monitoring
  observerControl = initializeObserver();
  
  // Send initial status
  chrome.runtime.sendMessage({
    type: 'contentScriptReady',
    platform: window.location.hostname,
    timestamp: Date.now()
  });
}

// Handle page navigation (for SPAs)
let lastUrl = location.href;
const navigationObserver = new MutationObserver(() => {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    console.log('[AI Token Monitor] Navigation detected, reinitializing');
    setTimeout(initialize, 500); // Wait for new content to load
  }
});

navigationObserver.observe(document, { subtree: true, childList: true });

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.type) {
    case 'getStatus':
      sendResponse({
        active: true,
        platform: window.location.hostname,
        metrics: performanceMetrics,
        cached: processedContent.size
      });
      break;
      
    case 'clearCache':
      processedContent.clear();
      streamingBuffers.clear();
      tokenCache.clear();
      sendResponse({ success: true });
      break;
      
    case 'forceUpdate':
      const config = getPlatformConfig();
      document.querySelectorAll(config.selectors.response).forEach(element => {
        processTokenUpdate(element, 'response', false);
      });
      sendResponse({ success: true });
      break;
  }
  return true;
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extractTextContent,
    hashContent,
    processTokenUpdate,
    getPlatformConfig
  };
}