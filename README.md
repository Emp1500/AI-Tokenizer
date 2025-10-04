# AI Token Monitor

A browser extension for real-time token counting and cost estimation for large language models.

## Overview

This extension provides developers, writers, and researchers with a convenient way to monitor token usage and estimate costs when interacting with AI chat platforms. It runs in the background, automatically detecting supported platforms and providing live updates.

## Key Features

- **Live Token Counting**: Tracks input and output tokens in real-time.
- **Cost Estimation**: Calculates estimated costs based on platform-specific pricing.
- **Multi-Platform Support**: Works with:
  - OpenAI ChatGPT
  - Anthropic Claude
  - Google Gemini
- **Advanced Tokenization**: Uses platform-specific algorithms for improved accuracy.
- **Session Management**: Tracks usage across multiple tabs and sessions.
- **Customizable Settings**: Adjust pricing models and other preferences.

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Emp1500/ai-token-monitor.git
   ```

2. **Load the extension in your browser**:
   - **Chrome**: Go to `chrome://extensions`, enable "Developer mode", and click "Load unpacked".
   - **Firefox**: Go to `about:debugging`, click "This Firefox", and select "Load Temporary Add-on".

3. **Select the cloned directory**.

## How to Use

1. **Navigate** to a supported platform (e.g., `chat.openai.com`).
2. **Click** the extension icon in your browser toolbar.
3. **View** the live token counts and estimated cost in the popup.
4. **Use** the reset button to clear the counters for the current session.

## Recent Changes

- Fixed several bugs in `popup.js` including duplicate event listeners and incorrect message types.
- Consolidated event listeners for better performance.
- Corrected the initial stats request to the background script.
- Ensured the reset button correctly clears the display.

## Technical Details

### Token Calculation

The extension uses a sophisticated tokenization strategy that adapts to the specific model being used:

- **GPT (OpenAI)**: Implements a BPE-like algorithm that mimics `cl100k_base`.
- **Claude (Anthropic)**: Uses a custom tokenizer tuned for Claude's models.
- **Gemini (Google)**: Approximates Gemini's tokenization with a focus on multilingual support.

### Performance

- **Efficient**: Uses `MutationObserver` and debouncing to minimize performance impact.
- **Caching**: Caches tokenization results to speed up repeated calculations.
- **Lightweight**: Designed to be unobtrusive and consume minimal resources.

### Configuration

The extension's configuration is stored within the JavaScript files:

- **`background.js`**: Contains the pricing information for the different AI models.
- **`content.js`**: Contains the CSS selectors for the different AI platforms.

## Project Structure

```
ai-token-monitor/
|-- manifest.json       # Extension manifest
|-- background.js      # Main service worker for state management
|-- content.js        # Injects into pages to monitor content
|-- popup.html       # Popup UI
|-- popup.js        # Popup logic
|-- tokenizer.js   # Core tokenization engine
|-- icons/          # Extension icons
|-- docs/           # Documentation files
```

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request with your improvements.


