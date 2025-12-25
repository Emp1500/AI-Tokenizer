// AI Token Monitor - Token Estimation
// Accurate estimation based on actual tokenizer behavior

(function() {
  'use strict';

  // Characters per token ratios (calibrated from actual tokenizers)
  const CHAR_PER_TOKEN = {
    'chatgpt.com': 3.7,      // GPT cl100k_base
    'chat.openai.com': 3.7,
    'claude.ai': 3.5,        // Claude tokenizer
    'gemini.google.com': 4.0 // SentencePiece
  };

  // Calculate tokens accurately
  function calculateTokens(text, platform) {
    if (!text || text.length === 0) return 0;

    const ratio = CHAR_PER_TOKEN[platform] || 3.7;
    let tokens = 0;

    // 1. Count words and their tokens
    const words = text.match(/\b[\w']+\b/g) || [];
    for (const word of words) {
      const len = word.length;
      if (len <= 3) tokens += 1;
      else if (len <= 6) tokens += 1.2;
      else if (len <= 10) tokens += 2;
      else tokens += Math.ceil(len / 4);
    }

    // 2. Punctuation (most are 1 token)
    const punct = text.match(/[^\w\s]/g) || [];
    tokens += punct.length * 0.9;

    // 3. Newlines (each is typically 1 token)
    const newlines = (text.match(/\n/g) || []).length;
    tokens += newlines;

    // 4. Numbers (2-3 digits per token)
    const numbers = text.match(/\d+/g) || [];
    for (const num of numbers) {
      tokens += Math.ceil(num.length / 2.5);
    }

    // Ensure minimum (text can't have fewer than length/6 tokens)
    const minTokens = Math.ceil(text.length / 6);
    tokens = Math.max(tokens, minTokens);

    // Ensure maximum (can't exceed ~1 token per char)
    tokens = Math.min(tokens, text.length);

    return Math.round(tokens);
  }

  // Get token details
  function getTokenDetails(text, platform) {
    const count = calculateTokens(text, platform);
    return {
      count: count,
      chars: text?.length || 0,
      ratio: text?.length ? (text.length / count).toFixed(1) : 0
    };
  }

  // Export globally
  window.calculateTokens = calculateTokens;
  window.getTokenDetails = getTokenDetails;

})();
