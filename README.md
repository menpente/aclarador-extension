# Aclarador - Chrome Extension

Chrome extension that analyzes the text content of the active browser page using clear language principles based on the *Manual de Estilo del Gobierno de Aragón*.

Based on [aclarador-html](https://github.com/menpente/aclarador-html).

## Features

- **One-click analysis** of the active browser tab
- **6 specialized agents**: Analyzer, Rewriter (AI-powered), Grammar, Style, SEO, and Validator
- **Groq API integration** using `llama-3.3-70b-versatile` for AI-powered text rewriting
- **Side-by-side comparison** of original vs. improved text
- **Quality scores**: readability, quality percentage, and severity rating
- **SEO recommendations** with meta tag analysis
- **Compliance checks** against clear language principles
- **Copy improved text** to clipboard

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked** and select the `aclarador-extension` folder
5. The extension icon appears in the toolbar

## Usage

1. Click the Aclarador extension icon on any web page
2. Enter your [Groq API key](https://console.groq.com/keys) (saved locally for future use)
3. Adjust the character limit if needed (default: 3000)
4. Click **Analizar Página Activa**
5. View results: scores, text comparison, improvements, compliance, and SEO recommendations

## Project Structure

```
aclarador-extension/
├── manifest.json          # Chrome Extension manifest (v3)
├── content/
│   └── content.js         # Content script - extracts text from pages
├── lib/
│   └── agents.js          # Agent classes and coordinator
├── popup/
│   ├── popup.html         # Extension popup UI
│   ├── popup.css          # Popup styles
│   └── popup.js           # Popup logic and event handling
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## Agents

| Agent | Purpose |
|-------|---------|
| **Analyzer** | Classifies text, detects issues, routes to other agents |
| **Rewriter** | AI-powered rewriting using Groq API for clarity improvements |
| **Grammar** | Detects grammar issues like repeated words |
| **Style** | Checks sentence length, passive voice, calculates readability |
| **SEO** | Analyzes page title, meta description, keyword frequency |
| **Validator** | Quality scoring and compliance verification |

## Permissions

- `activeTab` — access content of the current tab when clicked
- `scripting` — inject content script to extract page text
- `storage` — persist API key and settings locally
