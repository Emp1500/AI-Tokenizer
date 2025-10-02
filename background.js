// API cost rates per 1K tokens (in USD)
const API_RATES = {
  'chat.openai.com': {
    input: 0.0015,   // GPT-3.5-turbo input rate
    output: 0.002    // GPT-3.5-turbo output rate
  },
  'claude.ai': {
    input: 0.00163,  // Claude 2 input rate
    output: 0.00551  // Claude 2 output rate
  },
  'gemini.google.com': {
    input: 0.0005,   // Gemini Pro input rate
    output: 0.0005   // Gemini Pro output rate
  },
  'bard.google.com': {
    input: 0.0005,   // Gemini Pro input rate
    output: 0.0005   // Gemini Pro output rate
  }
};

// Debug logging
const DEBUG = true;
function log(message, data) {
  if (DEBUG) {
    console.log(`[AI Token Monitor] ${message}`, data || '');
  }
}

// Initialize stats tracking
let sessionStats = {
  inputChars: 0,
  inputTokens: 0,
  outputChars: 0,
  outputTokens: 0,
  cost: 0
};

// Calculate cost with high precision
function calculateCost(tokens, type, platform) {
  const rates = API_RATES[platform] || API_RATES['chat.openai.com'];
  const rate = rates[type];
  
  // Use high-precision calculation
  const cost = (BigInt(Math.round(tokens * 1000000)) * BigInt(Math.round(rate * 1000000))) / BigInt(1000000000000);
  return Number(cost) / 1000;
}

// Function to update stats with validation
function updateStats(type, chars, tokens, platform) {
  const isInput = type === 'inputUpdate';
  const charsKey = isInput ? 'inputChars' : 'outputChars';
  const tokensKey = isInput ? 'inputTokens' : 'outputTokens';
  
  // Update character and token counts
  sessionStats[charsKey] = chars;
  sessionStats[tokensKey] = tokens;
  
  // Calculate new cost
  const costType = isInput ? 'input' : 'output';
  const newCost = calculateCost(tokens, costType, platform);
  sessionStats.cost = (sessionStats.cost || 0) + newCost;
  
  // Broadcast update to popup
  chrome.runtime.sendMessage({
    type: 'statsUpdate',
    inputChars: sessionStats.inputChars,
    inputTokens: sessionStats.inputTokens,
    outputChars: sessionStats.outputChars,
    outputTokens: sessionStats.outputTokens,
    cost: sessionStats.cost
  });
  
  // Store stats
  chrome.storage.local.set(sessionStats);
}

// Function to get current stats
function getStats() {
  return sessionStats;
}

// Function to reset stats
function resetStats() {
  sessionStats = {
    inputChars: 0,
    inputTokens: 0,
    outputChars: 0,
    outputTokens: 0,
    cost: 0
  };
  chrome.storage.local.set(sessionStats);
  return sessionStats;
}

// Initialize storage on installation
chrome.runtime.onInstalled.addListener(() => {
  resetStats();
});

// Load saved stats when browser starts
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get(null, (items) => {
    if (items) {
      sessionStats = {
        inputChars: items.inputChars || 0,
        inputTokens: items.inputTokens || 0,
        outputChars: items.outputChars || 0,
        outputTokens: items.outputTokens || 0,
        cost: items.cost || 0
      };
    }
  });
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  log('Received message:', message);

  switch (message.type) {
    case 'inputUpdate':
    case 'responseUpdate':
    case 'textUpdate':
      if (sender.tab && sender.tab.url) {
        const platform = new URL(sender.tab.url).hostname;
        updateStats(
          message.type,
          message.chars,
          message.tokens,
          platform
        );
      }
      break;

    case 'getStats':
      sendResponse(getStats());
      break;

    case 'reset':
      const newStats = resetStats();
      sendResponse({
        success: true,
        ...newStats
      });
      break;
  }

  // Return true if we're going to send a response asynchronously
  return true;
});