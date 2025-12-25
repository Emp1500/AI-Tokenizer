// AI Token Monitor - Content Script
// Live monitoring with model detection

(function() {
  'use strict';

  const DEBUG = true;
  const log = (...args) => DEBUG && console.log('[AI Token Monitor]', ...args);

  if (window.__aiTokenMonitorInit) return;
  window.__aiTokenMonitorInit = true;

  log('Loaded:', window.location.hostname);

  // ============ PLATFORM CONFIG ============
  const PLATFORMS = {
    'claude.ai': {
      name: 'Claude',
      input: ['div.ProseMirror', '[contenteditable="true"]', 'fieldset [contenteditable]'],
      response: ['.font-claude-message', '[data-is-streaming]', '.prose'],
      modelSelector: '[data-testid="model-selector"]', // Model picker
      modelPatterns: ['claude-3.5-sonnet', 'claude-3.5-haiku', 'claude-3-opus', 'sonnet', 'haiku', 'opus']
    },
    'chatgpt.com': {
      name: 'ChatGPT',
      input: ['#prompt-textarea', 'textarea'],
      response: ['[data-message-author-role="assistant"]', '.markdown.prose', '.agent-turn'],
      modelSelector: '[data-testid="model-switcher"]',
      modelPatterns: ['gpt-4o', 'gpt-4o-mini', 'o1-preview', 'o1-mini', 'gpt-4-turbo', 'gpt-4']
    },
    'chat.openai.com': {
      name: 'ChatGPT',
      input: ['#prompt-textarea', 'textarea'],
      response: ['[data-message-author-role="assistant"]', '.markdown.prose'],
      modelSelector: '[data-testid="model-switcher"]',
      modelPatterns: ['gpt-4o', 'gpt-4o-mini', 'o1', 'gpt-4']
    },
    'gemini.google.com': {
      name: 'Gemini',
      input: ['.ql-editor', '[contenteditable="true"]', 'textarea'],
      response: ['.model-response-text', '.response-content', 'model-response'],
      modelSelector: '.model-selector',
      modelPatterns: ['gemini-2.0', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro']
    }
  };

  const config = PLATFORMS[window.location.hostname] || {
    name: 'Unknown',
    input: ['textarea', '[contenteditable="true"]'],
    response: ['[class*="message"]', '[class*="response"]'],
    modelSelector: null,
    modelPatterns: []
  };

  // ============ STATE ============
  let lastInputHash = '';
  let lastOutputHash = '';
  let detectedModel = null;
  let streamingPoll = null;

  // ============ UTILITIES ============
  function findAll(selectors) {
    const elements = [];
    for (const sel of selectors) {
      try {
        document.querySelectorAll(sel).forEach(el => elements.push(el));
      } catch (e) {}
    }
    return elements;
  }

  function getText(element) {
    if (!element) return '';
    const clone = element.cloneNode(true);
    clone.querySelectorAll('script, style, svg, button').forEach(e => e.remove());
    return (clone.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function hash(text) {
    let h = 0;
    for (let i = 0; i < text.length; i++) {
      h = ((h << 5) - h) + text.charCodeAt(i);
      h |= 0;
    }
    return h.toString(36) + ':' + text.length;
  }

  // ============ TOKEN COUNTING ============
  // More accurate token estimation
  function countTokens(text) {
    if (!text || text.length === 0) return 0;

    // Use global tokenizer if available
    if (typeof window.calculateTokens === 'function') {
      return window.calculateTokens(text, window.location.hostname);
    }

    // Accurate fallback estimation
    // Based on OpenAI's cl100k_base: ~3.5-4 chars per token
    let tokens = 0;

    // Count words (most are 1-2 tokens)
    const words = text.match(/\b\w+\b/g) || [];
    tokens += words.reduce((sum, word) => {
      if (word.length <= 4) return sum + 1;
      if (word.length <= 8) return sum + 2;
      return sum + Math.ceil(word.length / 4);
    }, 0);

    // Count punctuation and special chars (usually 1 token each)
    const punctuation = text.match(/[^\w\s]/g) || [];
    tokens += punctuation.length * 0.8;

    // Count whitespace/newlines
    const newlines = (text.match(/\n/g) || []).length;
    tokens += newlines;

    // Minimum floor
    tokens = Math.max(tokens, Math.ceil(text.length / 5));

    return Math.round(tokens);
  }

  // ============ MODEL DETECTION ============
  function detectModel() {
    // Try to find model from various UI elements
    const searchTexts = [];

    // Check for model selector elements
    if (config.modelSelector) {
      const selector = document.querySelector(config.modelSelector);
      if (selector) {
        searchTexts.push(getText(selector).toLowerCase());
      }
    }

    // Check page title
    searchTexts.push(document.title.toLowerCase());

    // Check for model indicators in the page
    const allText = searchTexts.join(' ');

    // Match against known model patterns
    for (const pattern of config.modelPatterns) {
      if (allText.includes(pattern.toLowerCase())) {
        if (pattern !== detectedModel) {
          detectedModel = pattern;
          log('Detected model:', detectedModel);

          // Notify background
          try {
            chrome.runtime.sendMessage({
              type: 'modelDetected',
              model: detectedModel
            }).catch(() => {});
          } catch (e) {}
        }
        return;
      }
    }
  }

  // ============ SEND UPDATES ============
  function sendUpdate(type, tokens, chars) {
    log(`${type}: ${chars} chars, ${tokens} tokens`);
    try {
      chrome.runtime.sendMessage({
        type: type,
        tokens: tokens,
        chars: chars,
        platform: window.location.hostname,
        detectedModel: detectedModel,
        timestamp: Date.now()
      }).catch(() => {});
    } catch (e) {}
  }

  // ============ CHECK INPUT ============
  function checkInput() {
    const inputs = findAll(config.input);
    let text = '';
    inputs.forEach(el => text += getText(el) + ' ');
    text = text.trim();

    const h = hash(text);
    if (h !== lastInputHash && text.length > 0) {
      lastInputHash = h;
      const tokens = countTokens(text);
      sendUpdate('inputUpdate', tokens, text.length);
    }
  }

  // ============ CHECK RESPONSES ============
  function checkResponses() {
    const responses = findAll(config.response);
    let text = '';
    responses.forEach(el => text += getText(el) + '\n');
    text = text.trim();

    const h = hash(text);
    if (h !== lastOutputHash && text.length > 0) {
      lastOutputHash = h;
      const tokens = countTokens(text);
      sendUpdate('responseUpdate', tokens, text.length);
    }
  }

  // ============ STREAMING DETECTION ============
  function isStreaming() {
    // Check for streaming indicators
    const indicators = [
      '[data-is-streaming="true"]',
      '.result-streaming',
      '.streaming',
      '.loading'
    ];

    for (const sel of indicators) {
      if (document.querySelector(sel)) return true;
    }

    return false;
  }

  function startStreamingPoll() {
    if (streamingPoll) return;
    log('Streaming started');

    streamingPoll = setInterval(() => {
      checkResponses();
      if (!isStreaming()) {
        stopStreamingPoll();
      }
    }, 150); // Fast polling during streaming
  }

  function stopStreamingPoll() {
    if (!streamingPoll) return;
    log('Streaming ended');

    clearInterval(streamingPoll);
    streamingPoll = null;
    checkResponses(); // Final update
  }

  // ============ SETUP ============
  function setupInputListeners() {
    const inputs = findAll(config.input);
    inputs.forEach(input => {
      if (input.dataset.monitored) return;
      input.dataset.monitored = 'true';

      log('Monitoring input:', input.tagName);

      const handler = () => checkInput();
      input.addEventListener('input', handler);
      input.addEventListener('keyup', handler);
      input.addEventListener('paste', () => setTimeout(handler, 100));

      if (input.contentEditable === 'true') {
        new MutationObserver(handler).observe(input, {
          childList: true,
          subtree: true,
          characterData: true
        });
      }
    });
  }

  function setupObserver() {
    const observer = new MutationObserver((mutations) => {
      let textChanged = false;

      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          textChanged = true;
        }
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
              textChanged = true;
            }
            if (node.nodeType === Node.ELEMENT_NODE) {
              setupInputListeners();
            }
          }
        }
      }

      if (textChanged && !streamingPoll) {
        startStreamingPoll();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  // ============ INIT ============
  function init() {
    log('Initializing for:', config.name);

    setupInputListeners();
    setupObserver();

    // Initial checks
    checkInput();
    checkResponses();
    detectModel();

    // Regular polling
    setInterval(() => {
      checkInput();
      checkResponses();
      detectModel();

      if (isStreaming() && !streamingPoll) {
        startStreamingPoll();
      }
    }, 1000);

    // Notify background
    try {
      chrome.runtime.sendMessage({
        type: 'contentScriptReady',
        platform: window.location.hostname
      }).catch(() => {});
    } catch (e) {}
  }

  // ============ MESSAGE HANDLER ============
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'forceUpdate') {
      checkInput();
      checkResponses();
      sendResponse({ success: true });
    } else if (request.type === 'getStatus') {
      sendResponse({
        active: true,
        platform: window.location.hostname,
        model: detectedModel
      });
    }
    return true;
  });

  // ============ START ============
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 300));
  } else {
    setTimeout(init, 300);
  }

  // Handle SPA navigation
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      log('URL changed');
      lastInputHash = '';
      lastOutputHash = '';
      setTimeout(init, 500);
    }
  }).observe(document.body, { childList: true, subtree: true });

})();
