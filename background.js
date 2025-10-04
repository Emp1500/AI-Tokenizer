// Enhanced background.js with improved state management and cost tracking

// Updated API pricing (as of 2024)
const API_PRICING = {
  'chat.openai.com': {
    models: {
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
      'gpt-3.5-turbo-16k': { input: 0.003, output: 0.004 }
    },
    default: 'gpt-3.5-turbo'
  },
  'claude.ai': {
    models: {
      'claude-3-opus': { input: 0.015, output: 0.075 },
      'claude-3-sonnet': { input: 0.003, output: 0.015 },
      'claude-3-haiku': { input: 0.00025, output: 0.00125 },
      'claude-2.1': { input: 0.008, output: 0.024 },
      'claude-instant': { input: 0.0008, output: 0.0024 }
    },
    default: 'claude-3-sonnet'
  },
  'gemini.google.com': {
    models: {
      'gemini-pro': { input: 0.00025, output: 0.0005 },
      'gemini-pro-vision': { input: 0.00025, output: 0.0005 },
      'gemini-ultra': { input: 0.007, output: 0.021 }
    },
    default: 'gemini-pro'
  },
  'bard.google.com': {
    models: {
      'gemini-pro': { input: 0.00025, output: 0.0005 }
    },
    default: 'gemini-pro'
  }
};

// Session state management
class SessionState {
  constructor() {
    this.sessions = new Map();
    this.totalStats = {
      inputTokens: 0,
      outputTokens: 0,
      inputChars: 0,
      outputChars: 0,
      totalCost: 0,
      sessionCount: 0,
      messageCount: 0
    };
    this.currentSessionId = null;
    this.settings = {
      selectedModel: {},
      trackingEnabled: true,
      showNotifications: false,
      costAlerts: {
        enabled: false,
        threshold: 1.0
      }
    };
    this.loadState();
  }

  createSession(tabId, platform) {
    const sessionId = `${tabId}_${Date.now()}`;
    const session = {
      id: sessionId,
      tabId: tabId,
      platform: platform,
      model: this.settings.selectedModel[platform] || API_PRICING[platform]?.default,
      startTime: Date.now(),
      lastActivity: Date.now(),
      stats: {
        inputTokens: 0,
        outputTokens: 0,
        inputChars: 0,
        outputChars: 0,
        cost: 0,
        messages: 0
      },
      history: []
    };
    
    this.sessions.set(sessionId, session);
    this.currentSessionId = sessionId;
    this.totalStats.sessionCount++;
    this.saveState();
    
    return session;
  }

  getSession(tabId) {
    for (const [id, session] of this.sessions) {
      if (session.tabId === tabId) {
        this.currentSessionId = id;
        return session;
      }
    }
    return null;
  }

  updateSession(sessionId, update) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    
    const pricing = API_PRICING[session.platform]?.models[session.model];
    if (!pricing) return null;
    
    // Update session stats
    if (update.type === 'inputUpdate') {
      session.stats.inputTokens = update.tokens;
      session.stats.inputChars = update.chars;
    } else if (update.type === 'responseUpdate' || update.type === 'outputUpdate') {
      session.stats.outputTokens += update.tokens;
      session.stats.outputChars += update.chars;
      session.stats.messages++;
    }
    
    // Calculate cost
    const inputCost = (session.stats.inputTokens / 1000) * pricing.input;
    const outputCost = (session.stats.outputTokens / 1000) * pricing.output;
    session.stats.cost = inputCost + outputCost;
    
    // Update activity time
    session.lastActivity = Date.now();
    
    // Add to history
    session.history.push({
      timestamp: Date.now(),
      type: update.type,
      tokens: update.tokens,
      chars: update.chars
    });
    
    // Keep history size manageable
    if (session.history.length > 100) {
      session.history = session.history.slice(-50);
    }
    
    // Update total stats
    this.updateTotalStats();
    
    // Check cost alerts
    if (this.settings.costAlerts.enabled && session.stats.cost > this.settings.costAlerts.threshold) {
      this.sendCostAlert(session);
    }
    
    this.saveState();
    return session;
  }

  updateTotalStats() {
    const totals = {
      inputTokens: 0,
      outputTokens: 0,
      inputChars: 0,
      outputChars: 0,
      totalCost: 0,
      messageCount: 0
    };
    
    for (const session of this.sessions.values()) {
      totals.inputTokens += session.stats.inputTokens;
      totals.outputTokens += session.stats.outputTokens;
      totals.inputChars += session.stats.inputChars;
      totals.outputChars += session.stats.outputChars;
      totals.totalCost += session.stats.cost;
      totals.messageCount += session.stats.messages;
    }
    
    this.totalStats = { ...this.totalStats, ...totals };
  }

  clearOldSessions() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    for (const [id, session] of this.sessions) {
      if (session.lastActivity < oneHourAgo) {
        this.sessions.delete(id);
      }
    }
    this.saveState();
  }

  resetStats() {
    this.sessions.clear();
    this.totalStats = {
      inputTokens: 0,
      outputTokens: 0,
      inputChars: 0,
      outputChars: 0,
      totalCost: 0,
      sessionCount: 0,
      messageCount: 0
    };
    this.saveState();
  }

  sendCostAlert(session) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'AI Token Monitor - Cost Alert',
      message: `Session cost has exceeded $${this.settings.costAlerts.threshold.toFixed(2)}. Current: $${session.stats.cost.toFixed(4)}`
    });
  }

  async loadState() {
    try {
      const stored = await chrome.storage.local.get(['sessions', 'totalStats', 'settings']);
      if (stored.sessions) {
        // Restore sessions from storage
        const sessionData = JSON.parse(stored.sessions);
        this.sessions = new Map(sessionData);
      }
      if (stored.totalStats) {
        this.totalStats = stored.totalStats;
      }
      if (stored.settings) {
        this.settings = { ...this.settings, ...stored.settings };
      }
    } catch (error) {
      console.error('[AI Token Monitor] Failed to load state:', error);
    }
  }

  async saveState() {
    try {
      const sessionData = Array.from(this.sessions.entries());
      await chrome.storage.local.set({
        sessions: JSON.stringify(sessionData),
        totalStats: this.totalStats,
        settings: this.settings,
        lastSaved: Date.now()
      });
    } catch (error) {
      console.error('[AI Token Monitor] Failed to save state:', error);
    }
  }

  exportData() {
    return {
      sessions: Array.from(this.sessions.values()),
      totalStats: this.totalStats,
      settings: this.settings,
      exported: new Date().toISOString()
    };
  }
}

// Initialize state
const state = new SessionState();

// Clean up old sessions periodically
setInterval(() => {
  state.clearOldSessions();
}, 15 * 60 * 1000); // Every 15 minutes

// Message handlers
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[AI Token Monitor] Message received:', message.type);
  
  switch (message.type) {
    case 'contentScriptReady':
      handleContentScriptReady(sender.tab, message);
      break;
      
    case 'inputUpdate':
    case 'responseUpdate':
    case 'outputUpdate':
      handleTokenUpdate(sender.tab, message);
      break;
      
    case 'batchUpdate':
      handleBatchUpdate(sender.tab, message);
      break;
      
    case 'getStats':
      handleGetStats(sender.tab, sendResponse);
      break;
      
    case 'getSessionDetails':
      handleGetSessionDetails(sender.tab, sendResponse);
      break;
      
    case 'reset':
      handleReset(sendResponse);
      break;
      
    case 'updateSettings':
      handleUpdateSettings(message.settings, sendResponse);
      break;
      
    case 'exportData':
      handleExportData(sendResponse);
      break;
      
    case 'getModels':
      handleGetModels(sender.tab, sendResponse);
      break;

    case 'switchModel':
      handleSwitchModel(sender.tab, message, sendResponse);
      break;
  }
  
  return true; // Keep message channel open for async responses
});

// Handler functions
function handleGetModels(tab, sendResponse) {
  if (!tab) {
    sendResponse({ models: {} });
    return;
  }
  const session = state.getSession(tab.id);
  if (session && API_PRICING[session.platform]) {
    sendResponse({ models: API_PRICING[session.platform].models });
  } else {
    sendResponse({ models: {} });
  }
}
function handleContentScriptReady(tab, message) {
  if (!tab) return;
  
  const platform = message.platform || new URL(tab.url).hostname;
  let session = state.getSession(tab.id);
  
  if (!session) {
    session = state.createSession(tab.id, platform);
  }
  
  // Send current session stats to content script
  chrome.tabs.sendMessage(tab.id, {
    type: 'sessionUpdate',
    session: session
  });
}

function handleTokenUpdate(tab, message) {
  if (!tab) return;
  
  let session = state.getSession(tab.id);
  if (!session) {
    const platform = new URL(tab.url).hostname;
    session = state.createSession(tab.id, platform);
  }
  
  session = state.updateSession(session.id, message);
  
  // Broadcast update to popup if open
  chrome.runtime.sendMessage({
    type: 'statsUpdate',
    inputTokens: session.stats.inputTokens,
    inputChars: session.stats.inputChars,
    outputTokens: session.stats.outputTokens,
    outputChars: session.stats.outputChars,
    cost: session.stats.cost,
    model: session.model,
    platform: session.platform
  }).catch(() => {
    // Popup not open, ignore
  });
}

function handleBatchUpdate(tab, message) {
  if (!tab) return;
  
  let session = state.getSession(tab.id);
  if (!session) {
    const platform = new URL(tab.url).hostname;
    session = state.createSession(tab.id, platform);
  }
  
  // Process batched updates
  if (message.inputTokens > 0) {
    state.updateSession(session.id, {
      type: 'inputUpdate',
      tokens: message.inputTokens,
      chars: message.inputChars
    });
  }
  
  if (message.outputTokens > 0) {
    state.updateSession(session.id, {
      type: 'outputUpdate',
      tokens: message.outputTokens,
      chars: message.outputChars
    });
  }
}

function handleGetStats(tab, sendResponse) {
  const session = tab ? state.getSession(tab.id) : null;
  
  if (session) {
    sendResponse({
      ...session.stats,
      model: session.model,
      platform: session.platform,
      duration: Date.now() - session.startTime
    });
  } else {
    sendResponse({
      inputTokens: 0,
      inputChars: 0,
      outputTokens: 0,
      outputChars: 0,
      cost: 0,
      messages: 0
    });
  }
}

function handleGetSessionDetails(tab, sendResponse) {
  const sessions = Array.from(state.sessions.values());
  const currentSession = tab ? state.getSession(tab.id) : null;
  
  sendResponse({
    current: currentSession,
    all: sessions,
    totals: state.totalStats
  });
}

function handleReset(sendResponse) {
  state.resetStats();
  sendResponse({ success: true });
}

function handleUpdateSettings(newSettings, sendResponse) {
  state.settings = { ...state.settings, ...newSettings };
  state.saveState();
  sendResponse({ success: true, settings: state.settings });
}

function handleExportData(sendResponse) {
  const exportData = state.exportData();
  sendResponse(exportData);
}

function handleSwitchModel(tab, message, sendResponse) {
  if (!tab) {
    sendResponse({ success: false, error: 'No tab information' });
    return;
  }
  
  const session = state.getSession(tab.id);
  if (session) {
    session.model = message.model;
    state.settings.selectedModel[session.platform] = message.model;
    state.saveState();
    sendResponse({ success: true, model: message.model });
  } else {
    sendResponse({ success: false, error: 'No active session' });
  }
}

// Handle tab close to clean up sessions
chrome.tabs.onRemoved.addListener((tabId) => {
  const session = state.getSession(tabId);
  if (session) {
    // Save final stats before removing
    state.saveState();
    // Optional: keep session for historical data
    // state.sessions.delete(session.id);
  }
});

// Initialize on install/update
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[AI Token Monitor] Extension installed');
    chrome.storage.local.clear(); // Start fresh
  } else if (details.reason === 'update') {
    console.log('[AI Token Monitor] Extension updated');
    state.loadState(); // Reload saved state
  }
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SessionState,
    API_PRICING,
    state
  };
}