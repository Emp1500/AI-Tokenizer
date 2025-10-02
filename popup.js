// Debug logging
const DEBUG = true;
function log(message, data) {
  if (DEBUG) {
    console.log(`[AI Token Monitor] ${message}`, data || '');
  }
}

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  log('Popup opened');
  
  // Get all display elements
  const inputChars = document.getElementById('inputChars');
  const inputTokens = document.getElementById('inputTokens');
  const outputChars = document.getElementById('outputChars');
  const outputTokens = document.getElementById('outputTokens');
  const costDisplay = document.getElementById('costDisplay');
  const resetButton = document.getElementById('resetButton');
  
  // Function to format numbers with animation
  function animateValue(element, start, end, duration = 500) {
    if (!element) return;
    
    const range = end - start;
    const startTime = performance.now();
    
    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const value = Math.floor(start + (range * progress));
      element.textContent = value.toLocaleString();
      
      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }
    
    requestAnimationFrame(update);
  }

  // Function to update individual display elements with animation
  function updateDisplay(element, value, isNumber = true) {
    if (element && value !== undefined) {
      if (isNumber) {
        const currentValue = parseInt(element.textContent.replace(/,/g, '')) || 0;
        animateValue(element, currentValue, value);
      } else {
        element.textContent = value;
      }
    }
  }

  // Function to update all stats
  function updateStats(stats) {
    updateDisplay(inputChars, stats.inputChars);
    updateDisplay(inputTokens, stats.inputTokens);
    updateDisplay(outputChars, stats.outputChars);
    updateDisplay(outputTokens, stats.outputTokens);
    if (stats.cost !== undefined) {
      updateDisplay(costDisplay, `$${stats.cost.toFixed(4)}`, false);
    }
  }

  // Reset all displays to zero
  function resetDisplays() {
    updateStats({
      inputChars: 0,
      inputTokens: 0,
      outputChars: 0,
      outputTokens: 0,
      cost: 0
    });
  }

  // Request initial stats from background script
  chrome.runtime.sendMessage({ type: 'get' }, response => {
    if (response) {
      updateStats(response);
    }
  });

  // Listen for stats updates from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'statsUpdate') {
      updateStats(message);
    }
  });

  // Handle reset button click
  resetButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'reset' }, response => {
      if (response && response.success) {
        resetDisplays();
      }
    });
  });

  // Handle reset button click
  resetButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'reset' }, response => {
      if (response) {
        updateDisplay(0);
      }
    });
  });
});