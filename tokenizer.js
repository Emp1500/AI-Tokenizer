// Enhanced tokenizer.js with more accurate tokenization algorithms

// Unicode categories for better token boundary detection
const UNICODE_CATEGORIES = {
  // Latin characters
  LATIN: /[A-Za-z\u00C0-\u00FF\u0100-\u017F\u0180-\u024F]/,
  // Numbers
  DIGIT: /[0-9]/,
  // Whitespace
  WHITESPACE: /[\s\t\n\r]/,
  // Punctuation
  PUNCTUATION: /[.,!?;:'"()\[\]{}<>@#$%^&*+=|\\\/`~\-_]/,
  // CJK characters (each typically counts as 1-2 tokens)
  CJK: /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/,
  // Japanese Hiragana/Katakana
  JAPANESE: /[\u3040-\u309F\u30A0-\u30FF]/,
  // Korean
  KOREAN: /[\uAC00-\uD7AF\u1100-\u11FF]/,
  // Arabic
  ARABIC: /[\u0600-\u06FF\u0750-\u077F]/,
  // Devanagari (Hindi, etc.)
  DEVANAGARI: /[\u0900-\u097F]/,
  // Emoji
  EMOJI: /[\u2600-\u26FF\u2700-\u27BF\u1F300-\u1F5FF\u1F600-\u1F64F\u1F680-\u1F6FF\u1F900-\u1F9FF\u1FA00-\u1FA6F]/,
  // Mathematical symbols
  MATH: /[\u2200-\u22FF\u2A00-\u2AFF]/,
  // Currency symbols
  CURRENCY: /[\u20A0-\u20CF\$£€¥¢]/
};

// Common subword units (BPE-like tokens)
const COMMON_SUBWORDS = new Set([
  // Common prefixes
  'un', 're', 'dis', 'pre', 'non', 'anti', 'de', 'over', 'under', 'inter', 'trans',
  'super', 'semi', 'sub', 'ultra', 'micro', 'macro', 'multi', 'mono', 'poly',
  // Common suffixes
  'ing', 'ed', 'er', 'est', 'ly', 'tion', 'sion', 'ment', 'ness', 'ful', 'less',
  'able', 'ible', 'ous', 'ious', 'ive', 'ative', 'ize', 'ise', 'ify', 'fy',
  // Common word parts
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
  'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his'
]);

// Platform-specific tokenization parameters
const PLATFORM_CONFIGS = {
  'chat.openai.com': {
    name: 'GPT',
    avgBytesPerToken: 4,
    vocabSize: 100000,
    // GPT uses cl100k_base encoding
    tokenization: {
      splitPattern: /('s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+)/gu,
      mergeRules: ['qu', 'th', 'ch', 'sh', 'wh', 'ph', 'gh'],
      specialTokens: new Set(['<|endoftext|>', '<|startoftext|>', '\n\n', '```'])
    }
  },
  'claude.ai': {
    name: 'Claude',
    avgBytesPerToken: 3.5,
    vocabSize: 100000,
    tokenization: {
      splitPattern: /(\p{L}+|\p{N}+|[^\s\p{L}\p{N}]+|\s+)/gu,
      mergeRules: ['th', 'he', 'in', 'er', 'an', 're', 'nd', 'at', 'on', 'nt'],
      specialTokens: new Set(['\n\n', '```', '###', '---'])
    }
  },
  'gemini.google.com': {
    name: 'Gemini',
    avgBytesPerToken: 4.5,
    vocabSize: 32000,
    tokenization: {
      splitPattern: /(\p{L}+|\p{N}+|[^\s\p{L}\p{N}]+|\s+)/gu,
      mergeRules: ['the', 'and', 'ing', 'ion', 'tion'],
      specialTokens: new Set(['<start>', '<end>', '\n\n'])
    }
  },
  'bard.google.com': {
    name: 'Gemini',
    avgBytesPerToken: 4.5,
    vocabSize: 32000,
    tokenization: {
      splitPattern: /(\p{L}+|\p{N}+|[^\s\p{L}\p{N}]+|\s+)/gu,
      mergeRules: ['the', 'and', 'ing', 'ion', 'tion'],
      specialTokens: new Set(['<start>', '<end>', '\n\n'])
    }
  }
};

// Cache for tokenization results (LRU cache)
class TokenCache {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key) {
    if (!this.cache.has(key)) return null;
    // Move to end (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove oldest (first) entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear() {
    this.cache.clear();
  }
}

const tokenCache = new TokenCache(100);

// Enhanced tokenization function using BPE-like approach
function tokenizeText(text, platform = 'chat.openai.com') {
  if (!text) return { tokens: [], count: 0 };

  // Check cache first
  const cacheKey = `${platform}:${text.substring(0, 100)}:${text.length}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.text === text) {
    return cached.result;
  }

  const config = PLATFORM_CONFIGS[platform] || PLATFORM_CONFIGS['chat.openai.com'];
  const tokens = [];
  
  try {
    // Step 1: Handle special tokens
    let processedText = text;
    for (const specialToken of config.tokenization.specialTokens) {
      const regex = new RegExp(escapeRegExp(specialToken), 'g');
      processedText = processedText.replace(regex, (match) => {
        tokens.push(match);
        return '\u0000'; // Placeholder
      });
    }

    // Step 2: Split text into initial segments
    const segments = processedText.match(config.tokenization.splitPattern) || [];
    
    for (let segment of segments) {
      if (segment === '\u0000') continue; // Skip placeholders
      
      // Handle different types of segments
      if (UNICODE_CATEGORIES.CJK.test(segment)) {
        // CJK characters: usually 2-3 tokens per character
        tokens.push(...segment.split('').map(char => char));
      } else if (UNICODE_CATEGORIES.EMOJI.test(segment)) {
        // Emojis: typically 1-2 tokens each
        tokens.push(segment);
      } else if (UNICODE_CATEGORIES.WHITESPACE.test(segment)) {
        // Whitespace handling
        if (segment.includes('\n')) {
          tokens.push(...segment.split('\n').filter(Boolean));
        } else {
          tokens.push(segment);
        }
      } else if (/^[\d]+$/.test(segment)) {
        // Numbers: chunk into groups
        tokens.push(...chunkNumbers(segment));
      } else if (/^[A-Za-z]+$/.test(segment)) {
        // Words: apply subword tokenization
        tokens.push(...applySubwordTokenization(segment, config));
      } else if (/^https?:\/\//.test(segment)) {
        // URLs: special handling
        tokens.push(...tokenizeURL(segment));
      } else {
        // Mixed content or special characters
        tokens.push(...tokenizeMixed(segment, config));
      }
    }

    // Step 3: Apply merge rules (BPE-like)
    const mergedTokens = applyMergeRules(tokens, config.tokenization.mergeRules);

    const result = {
      tokens: mergedTokens,
      count: mergedTokens.length
    };

    // Cache the result
    tokenCache.set(cacheKey, { text, result });

    return result;
  } catch (error) {
    console.error('[Tokenizer] Error:', error);
    // Fallback to simple estimation
    return {
      tokens: [],
      count: Math.ceil(text.length / config.avgBytesPerToken)
    };
  }
}

// Subword tokenization for words
function applySubwordTokenization(word, config) {
  const tokens = [];
  let remaining = word.toLowerCase();
  
  // Check for common prefixes
  for (const prefix of ['un', 're', 'dis', 'pre', 'non', 'anti', 'de', 'over', 'under']) {
    if (remaining.startsWith(prefix) && remaining.length > prefix.length + 2) {
      tokens.push(prefix);
      remaining = remaining.slice(prefix.length);
      break;
    }
  }
  
  // Check for common suffixes
  for (const suffix of ['ing', 'ed', 'er', 'est', 'ly', 'tion', 'ment', 'ness', 'able', 'ful', 'less']) {
    if (remaining.endsWith(suffix) && remaining.length > suffix.length + 2) {
      const stem = remaining.slice(0, -suffix.length);
      if (stem.length > 2) {
        tokens.push(stem);
        tokens.push(suffix);
        return tokens;
      }
    }
  }
  
  // If no subword patterns found, return as single token or split if very long
  if (remaining.length > 12) {
    // Split long words
    const chunks = [];
    for (let i = 0; i < remaining.length; i += 6) {
      chunks.push(remaining.slice(i, i + 6));
    }
    return chunks;
  }
  
  return tokens.length > 0 ? [...tokens, remaining] : [word];
}

// Tokenize numbers intelligently
function chunkNumbers(numberStr) {
  if (numberStr.length <= 3) return [numberStr];
  
  const tokens = [];
  // Split into chunks of 3-4 digits
  for (let i = 0; i < numberStr.length; i += 3) {
    tokens.push(numberStr.slice(i, i + 3));
  }
  return tokens;
}

// Tokenize URLs
function tokenizeURL(url) {
  const tokens = [];
  const parts = url.match(/https?:\/\/|www\.|[^\/\.\-]+|[\/\.\-]/g) || [];
  
  for (const part of parts) {
    if (part.length > 8) {
      // Split long parts
      for (let i = 0; i < part.length; i += 6) {
        tokens.push(part.slice(i, i + 6));
      }
    } else {
      tokens.push(part);
    }
  }
  
  return tokens;
}

// Handle mixed content (letters, numbers, special chars)
function tokenizeMixed(text, config) {
  const tokens = [];
  const parts = text.match(/[A-Za-z]+|[0-9]+|[^A-Za-z0-9]+/g) || [];
  
  for (const part of parts) {
    if (/^[A-Za-z]+$/.test(part)) {
      tokens.push(...applySubwordTokenization(part, config));
    } else if (/^[0-9]+$/.test(part)) {
      tokens.push(...chunkNumbers(part));
    } else {
      // Special characters: usually 1 token each
      tokens.push(...part.split(''));
    }
  }
  
  return tokens;
}

// Apply merge rules (simplified BPE)
function applyMergeRules(tokens, mergeRules) {
  let merged = [...tokens];
  let changed = true;
  
  while (changed) {
    changed = false;
    const newTokens = [];
    
    for (let i = 0; i < merged.length; i++) {
      if (i < merged.length - 1) {
        const pair = merged[i] + merged[i + 1];
        if (mergeRules.includes(pair.toLowerCase())) {
          newTokens.push(pair);
          i++; // Skip next token
          changed = true;
        } else {
          newTokens.push(merged[i]);
        }
      } else {
        newTokens.push(merged[i]);
      }
    }
    
    merged = newTokens;
    // Prevent infinite loops
    if (merged.length === tokens.length) break;
  }
  
  return merged;
}

// Calculate tokens with enhanced accuracy
function calculateTokens(text, platform = window.location.hostname) {
  if (!text) return 0;
  
  const result = tokenizeText(text, platform);
  return result.count;
}

// Get detailed token information
function getTokenDetails(text, platform = window.location.hostname) {
  const result = tokenizeText(text, platform);
  const config = PLATFORM_CONFIGS[platform] || PLATFORM_CONFIGS['chat.openai.com'];
  
  return {
    count: result.count,
    tokens: result.tokens,
    estimatedCost: (result.count / 1000) * 0.002, // Default rate
    platform: config.name,
    avgTokenLength: text.length / result.count
  };
}

// Utility function to escape regex special characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calculateTokens,
    tokenizeText,
    getTokenDetails,
    PLATFORM_CONFIGS,
    tokenCache
  };
}