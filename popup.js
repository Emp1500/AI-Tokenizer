// AI Token Monitor - Popup
(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    console.log('[AI Token Monitor] Popup opened');

    const elements = {
      inputChars: document.getElementById('inputChars'),
      inputTokens: document.getElementById('inputTokens'),
      outputChars: document.getElementById('outputChars'),
      outputTokens: document.getElementById('outputTokens'),
      costDisplay: document.getElementById('costDisplay'),
      resetButton: document.getElementById('resetButton'),
      modelSelect: document.getElementById('modelSelect'),
      platformDisplay: document.getElementById('platformDisplay'),
      streamingIndicator: document.getElementById('streamingIndicator')
    };

    let pollInterval = null;
    let currentModels = {};

    // Update display
    function updateStats(stats) {
      if (!stats) return;

      if (elements.inputChars) {
        elements.inputChars.textContent = (stats.inputChars || 0).toLocaleString();
      }
      if (elements.inputTokens) {
        elements.inputTokens.textContent = (stats.inputTokens || 0).toLocaleString();
      }
      if (elements.outputChars) {
        elements.outputChars.textContent = (stats.outputChars || 0).toLocaleString();
      }
      if (elements.outputTokens) {
        elements.outputTokens.textContent = (stats.outputTokens || 0).toLocaleString();
      }
      if (elements.costDisplay) {
        const cost = stats.cost || 0;
        elements.costDisplay.textContent = `$${cost.toFixed(6)}`;
      }
      if (elements.platformDisplay && stats.platform) {
        const names = {
          'chatgpt.com': 'ChatGPT',
          'chat.openai.com': 'ChatGPT',
          'claude.ai': 'Claude',
          'gemini.google.com': 'Gemini'
        };
        elements.platformDisplay.textContent = names[stats.platform] || stats.platform;
      }
      if (elements.modelSelect && stats.model) {
        elements.modelSelect.value = stats.model;
      }
    }

    // Load models
    function loadModels() {
      chrome.runtime.sendMessage({ type: 'getModels' }, (response) => {
        if (chrome.runtime.lastError || !response?.models) return;

        currentModels = response.models;
        if (!elements.modelSelect) return;

        elements.modelSelect.innerHTML = '';
        Object.entries(response.models).forEach(([key, value]) => {
          const option = document.createElement('option');
          option.value = key;
          option.textContent = value.displayName || key;
          elements.modelSelect.appendChild(option);
        });
      });
    }

    // Request stats
    function requestStats() {
      chrome.runtime.sendMessage({ type: 'getStats' }, (response) => {
        if (chrome.runtime.lastError) return;
        updateStats(response);
      });

      // Force content script update
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'forceUpdate' }).catch(() => {});
        }
      });
    }

    // Model change handler
    if (elements.modelSelect) {
      elements.modelSelect.addEventListener('change', () => {
        chrome.runtime.sendMessage({
          type: 'switchModel',
          model: elements.modelSelect.value
        }, () => requestStats());
      });
    }

    // Reset handler
    if (elements.resetButton) {
      elements.resetButton.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'reset' }, () => {
          updateStats({
            inputChars: 0,
            inputTokens: 0,
            outputChars: 0,
            outputTokens: 0,
            cost: 0
          });
        });
      });
    }

    // Listen for updates
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'statsUpdate') {
        updateStats(message);
      }
    });

    // Initial load
    loadModels();
    requestStats();

    // Poll for updates
    pollInterval = setInterval(requestStats, 500);

    // Cleanup
    window.addEventListener('unload', () => {
      if (pollInterval) clearInterval(pollInterval);
    });
  });
})();
