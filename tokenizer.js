// Unicode range patterns for accurate token counting
const UNICODE_RANGES = {
  ASCII: /[\x00-\x7F]+/,
  CJK: /[\u4E00-\u9FFF\u3400-\u4DBF\u20000-\u2A6DF\u2A700-\u2B73F\u2B740-\u2B81F\u2B820-\u2CEAF\uF900-\uFAFF\u2F800-\u2FA1F]+/,
  EMOJI: /[\u2600-\u26FF\u2700-\u27BF\u1F300-\u1F5FF\u1F600-\u1F64F\u1F680-\u1F6FF\u1F900-\u1F9FF]+/,
  SPECIAL: /[^\x00-\x7F\u4E00-\u9FFF\u3400-\u4DBF\u20000-\u2A6DF\u2A700-\u2B73F\u2B740-\u2B81F\u2B820-\u2CEAF\uF900-\uFAFF\u2F800-\u2FA1F\u2600-\u26FF\u2700-\u27BF\u1F300-\u1F5FF\u1F600-\u1F64F\u1F680-\u1F6FF\u1F900-\u1F9FF]+/
};

// Model-specific tokenization patterns
const MODEL_TOKENS = {
  'chat.openai.com': {
    avgTokenLength: 4,
    specialTokens: [
      '.',',','!','?',':',';','\'','"','-','_','(',')','[',']','{','}','/','\n',
      'http://','https://','www.','.com','.org','.net','.edu',
      'the','and','that','for','you','this','have','with'
    ],
    prefixes: ['un', 're', 'in', 'dis', 'pre', 'non', 'anti', 'sub', 'inter'],
    suffixes: ['ing', 'ed', 'ly', 'tion', 'ment', 'ness', 'able', 'ible', 'ful']
  },
  'claude.ai': {
    avgTokenLength: 3.5,
    specialTokens: [
      '.',',','!','?',':',';','\'','"','-','_','(',')','[',']','{','}','/','\n',
      'http://','https://','www.','.com','.org','.net','.edu',
      'the','and','that','for','you','this','have','with'
    ],
    prefixes: ['un', 're', 'in', 'dis', 'pre', 'non', 'anti', 'sub', 'inter'],
    suffixes: ['ing', 'ed', 'ly', 'tion', 'ment', 'ness', 'able', 'ible', 'ful']
  },
  'gemini.google.com': {
    avgTokenLength: 4.5,
    specialTokens: [
      '.',',','!','?',':',';','\'','"','-','_','(',')','[',']','{','}','/','\n',
      'http://','https://','www.','.com','.org','.net','.edu',
      'the','and','that','for','you','this','have','with'
    ],
    prefixes: ['un', 're', 'in', 'dis', 'pre', 'non', 'anti', 'sub', 'inter'],
    suffixes: ['ing', 'ed', 'ly', 'tion', 'ment', 'ness', 'able', 'ible', 'ful']
  }
};

// Common word tokens for quick lookup
const COMMON_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what'
]);