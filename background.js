// AI Token Monitor - Background Service Worker
// Updated December 2024

// Latest API pricing (per 1K tokens) - December 2024
const API_PRICING = {
  'chatgpt.com': {
    models: {
      'gpt-4o': { input: 0.0025, output: 0.01, displayName: 'GPT-4o' },
      'gpt-4o-mini': { input: 0.00015, output: 0.0006, displayName: 'GPT-4o Mini' },
      'o1-preview': { input: 0.015, output: 0.06, displayName: 'o1-preview' },
      'o1-mini': { input: 0.003, output: 0.012, displayName: 'o1-mini' },
      'gpt-4-turbo': { input: 0.01, output: 0.03, displayName: 'GPT-4 Turbo' },
      'gpt-4': { input: 0.03, output: 0.06, displayName: 'GPT-4' },
      'gpt-3.5-turbo': { input: 0.0005, output: 0.0015, displayName: 'GPT-3.5 Turbo' }
    },
    default: 'gpt-4o'
  },
  'chat.openai.com': {
    models: {
      'gpt-4o': { input: 0.0025, output: 0.01, displayName: 'GPT-4o' },
      'gpt-4o-mini': { input: 0.00015, output: 0.0006, displayName: 'GPT-4o Mini' },
      'o1-preview': { input: 0.015, output: 0.06, displayName: 'o1-preview' },
      'o1-mini': { input: 0.003, output: 0.012, displayName: 'o1-mini' },
      'gpt-4-turbo': { input: 0.01, output: 0.03, displayName: 'GPT-4 Turbo' },
      'gpt-4': { input: 0.03, output: 0.06, displayName: 'GPT-4' }
    },
    default: 'gpt-4o'
  },
  'claude.ai': {
    models: {
      'claude-3.5-sonnet': { input: 0.003, output: 0.015, displayName: 'Claude 3.5 Sonnet' },
      'claude-3.5-haiku': { input: 0.0008, output: 0.004, displayName: 'Claude 3.5 Haiku' },
      'claude-3-opus': { input: 0.015, output: 0.075, displayName: 'Claude 3 Opus' },
      'claude-3-sonnet': { input: 0.003, output: 0.015, displayName: 'Claude 3 Sonnet' },
      'claude-3-haiku': { input: 0.00025, output: 0.00125, displayName: 'Claude 3 Haiku' }
    },
    default: 'claude-3.5-sonnet'
  },
  'gemini.google.com': {
    models: {
      'gemini-2.0-flash': { input: 0.0001, output: 0.0004, displayName: 'Gemini 2.0 Flash' },
      'gemini-1.5-pro': { input: 0.00125, output: 0.005, displayName: 'Gemini 1.5 Pro' },
      'gemini-1.5-flash': { input: 0.000075, output: 0.0003, displayName: 'Gemini 1.5 Flash' },
      'gemini-1.0-pro': { input: 0.0005, output: 0.0015, displayName: 'Gemini 1.0 Pro' }
    },
    default: 'gemini-2.0-flash'
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
      sessionCount: 0
    };
    this.settings = {
      selectedModel: {},
      trackingEnabled: true
    };
    this.loadState();
  }

  createSession(tabId, platform) {
    const sessionId = `${tabId}_${Date.now()}`;
    const defaultModel = API_PRICING[platform]?.default || 'gpt-4o';

    const session = {
      id: sessionId,
      tabId: tabId,
      platform: platform,
      model: this.settings.selectedModel[platform] || defaultModel,
      startTime: Date.now(),
      lastActivity: Date.now(),
      stats: {
        inputTokens: 0,
        outputTokens: 0,
        inputChars: 0,
        outputChars: 0,
        cost: 0
      },
      detectedModel: null
    };

    this.sessions.set(sessionId, session);
    this.totalStats.sessionCount++;
    console.log('[AI Token Monitor] Created session:', sessionId, 'platform:', platform);
    return session;
  }

  getSession(tabId) {
    for (const [id, session] of this.sessions) {
      if (session.tabId === tabId) {
        return session;
      }
    }
    return null;
  }

  updateSession(sessionId, update) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // Get pricing for current model
    const platformPricing = API_PRICING[session.platform];
    const modelPricing = platformPricing?.models[session.model] ||
                         platformPricing?.models[platformPricing?.default] ||
                         { input: 0.003, output: 0.015 };

    // Update stats
    if (update.type === 'inputUpdate') {
      session.stats.inputTokens = update.tokens || 0;
      session.stats.inputChars = update.chars || 0;
    } else if (update.type === 'responseUpdate') {
      session.stats.outputTokens = update.tokens || 0;
      session.stats.outputChars = update.chars || 0;
    }

    // Update detected model if provided
    if (update.detectedModel) {
      session.detectedModel = update.detectedModel;
      // Auto-switch to detected model if it exists in our pricing
      if (platformPricing?.models[update.detectedModel]) {
        session.model = update.detectedModel;
      }
    }

    // Calculate cost
    const inputCost = (session.stats.inputTokens / 1000) * modelPricing.input;
    const outputCost = (session.stats.outputTokens / 1000) * modelPricing.output;
    session.stats.cost = inputCost + outputCost;

    session.lastActivity = Date.now();
    this.updateTotalStats();

    return session;
  }

  updateTotalStats() {
    let totals = { inputTokens: 0, outputTokens: 0, inputChars: 0, outputChars: 0, totalCost: 0 };

    for (const session of this.sessions.values()) {
      totals.inputTokens += session.stats.inputTokens;
      totals.outputTokens += session.stats.outputTokens;
      totals.inputChars += session.stats.inputChars;
      totals.outputChars += session.stats.outputChars;
      totals.totalCost += session.stats.cost;
    }

    this.totalStats = { ...this.totalStats, ...totals };
  }

  resetStats() {
    this.sessions.clear();
    this.totalStats = {
      inputTokens: 0,
      outputTokens: 0,
      inputChars: 0,
      outputChars: 0,
      totalCost: 0,
      sessionCount: 0
    };
    this.saveState();
  }

  async loadState() {
    try {
      const stored = await chrome.storage.local.get(['settings']);
      if (stored.settings) {
        this.settings = { ...this.settings, ...stored.settings };
      }
    } catch (e) {
      console.error('[AI Token Monitor] Load error:', e);
    }
  }

  async saveState() {
    try {
      await chrome.storage.local.set({
        settings: this.settings,
        lastSaved: Date.now()
      });
    } catch (e) {
      console.error('[AI Token Monitor] Save error:', e);
    }
  }
}

// Initialize state
const state = new SessionState();

// Get active tab
async function getActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab || null;
  } catch (e) {
    return null;
  }
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[AI Token Monitor] Message:', message.type);

  const handleAsync = async (handler) => {
    let tab = sender.tab;
    if (!tab) {
      tab = await getActiveTab();
    }
    handler(tab);
  };

  switch (message.type) {
    case 'contentScriptReady':
      if (sender.tab) {
        let session = state.getSession(sender.tab.id);
        if (!session) {
          const platform = message.platform || new URL(sender.tab.url).hostname;
          session = state.createSession(sender.tab.id, platform);
        }
      }
      sendResponse({ success: true });
      break;

    case 'inputUpdate':
    case 'responseUpdate':
      if (sender.tab) {
        let session = state.getSession(sender.tab.id);
        if (!session) {
          try {
            const platform = new URL(sender.tab.url).hostname;
            session = state.createSession(sender.tab.id, platform);
          } catch (e) {
            sendResponse({ success: false });
            break;
          }
        }

        session = state.updateSession(session.id, message);

        // Broadcast to popup
        chrome.runtime.sendMessage({
          type: 'statsUpdate',
          inputTokens: session.stats.inputTokens,
          inputChars: session.stats.inputChars,
          outputTokens: session.stats.outputTokens,
          outputChars: session.stats.outputChars,
          cost: session.stats.cost,
          model: session.model,
          platform: session.platform
        }).catch(() => {});
      }
      sendResponse({ success: true });
      break;

    case 'getStats':
      handleAsync((tab) => {
        const session = tab ? state.getSession(tab.id) : null;
        if (session) {
          sendResponse({
            inputTokens: session.stats.inputTokens,
            inputChars: session.stats.inputChars,
            outputTokens: session.stats.outputTokens,
            outputChars: session.stats.outputChars,
            cost: session.stats.cost,
            model: session.model,
            platform: session.platform
          });
        } else {
          sendResponse({
            inputTokens: 0,
            inputChars: 0,
            outputTokens: 0,
            outputChars: 0,
            cost: 0
          });
        }
      });
      return true;

    case 'getModels':
      handleAsync((tab) => {
        if (tab) {
          try {
            const platform = new URL(tab.url).hostname;
            const platformModels = API_PRICING[platform]?.models || {};
            sendResponse({ models: platformModels, platform: platform });
          } catch (e) {
            sendResponse({ models: {} });
          }
        } else {
          sendResponse({ models: {} });
        }
      });
      return true;

    case 'switchModel':
      handleAsync((tab) => {
        if (tab) {
          const session = state.getSession(tab.id);
          if (session) {
            session.model = message.model;
            state.settings.selectedModel[session.platform] = message.model;
            state.saveState();

            // Recalculate cost with new model
            state.updateSession(session.id, { type: 'recalculate' });

            sendResponse({ success: true, model: message.model });
          } else {
            sendResponse({ success: false });
          }
        } else {
          sendResponse({ success: false });
        }
      });
      return true;

    case 'reset':
      state.resetStats();
      sendResponse({ success: true });
      break;

    case 'modelDetected':
      if (sender.tab) {
        const session = state.getSession(sender.tab.id);
        if (session && message.model) {
          session.detectedModel = message.model;
          // Try to match to our known models
          const platform = session.platform;
          const models = API_PRICING[platform]?.models || {};
          const modelLower = message.model.toLowerCase();

          for (const [key, value] of Object.entries(models)) {
            if (modelLower.includes(key.replace(/-/g, ' ')) ||
                modelLower.includes(key) ||
                value.displayName.toLowerCase().includes(modelLower)) {
              session.model = key;
              break;
            }
          }
        }
      }
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ success: true });
  }

  return true;
});

// Clean up old sessions periodically
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  for (const [id, session] of state.sessions) {
    if (session.lastActivity < oneHourAgo) {
      state.sessions.delete(id);
    }
  }
}, 15 * 60 * 1000);

// Handle tab close
chrome.tabs.onRemoved.addListener((tabId) => {
  const session = state.getSession(tabId);
  if (session) {
    state.sessions.delete(session.id);
  }
});

console.log('[AI Token Monitor] Background script loaded');
