# AI Token Monitor

A Chrome extension that provides real-time token counting and cost estimation for popular AI chat interfaces.

## Features

- Real-time token counting for inputs and responses
- Accurate cost estimation based on current API rates
- Support for multiple AI platforms:
  - OpenAI ChatGPT
  - Anthropic Claude
  - Google Gemini
  - Google Bard
- Live updates with animated counters
- Platform-specific token calculations
- Cost tracking for both input and output tokens

## Installation

1. Clone this repository:
```bash
git clone https://github.com/yourusername/ai-token-monitor.git
```

2. Open Google Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" (toggle in the top right)

4. Click "Load unpacked" and select the extension directory

## Usage

1. Visit any supported AI chat platform:
   - chat.openai.com
   - claude.ai
   - gemini.google.com
   - bard.google.com

2. Click the extension icon to see:
   - Input token count
   - Output token count
   - Character counts
   - Estimated cost

3. Use the reset button to clear counters

## Development

### Prerequisites
- Google Chrome
- Basic understanding of JavaScript and Chrome Extension development

### Project Structure
```
ai-token-monitor/
├── manifest.json        # Extension configuration
├── background.js       # Background service worker
├── content.js         # Content script for token monitoring
├── popup.html        # Extension popup interface
├── popup.js         # Popup functionality
├── tokenizer.js    # Token calculation logic
└── icons/         # Extension icons
```

### Local Development
1. Make changes to the relevant files
2. Reload the extension in Chrome
3. Test on supported platforms

## Token Calculation

The extension uses platform-specific token calculation methods:
- GPT-3.5/4: ~4 characters per token
- Claude: ~3.5 characters per token
- Gemini: ~4.5 characters per token

Special handling for:
- Unicode characters
- Code blocks
- Special characters
- Common words
- URLs and emails

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

MIT License - feel free to use and modify for your needs.

## Acknowledgments

- Thanks to OpenAI, Anthropic, and Google for their API documentation
- Icon design inspired by classic terminal interfaces