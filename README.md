# Jarvis

A local web chat UI backed by a tool-using AI agent. The model can see your approximate location and the current time, and it controls a headless browser to browse the web on your behalf.

The assistant persona and behavior live in `system.txt` (default: JARVIS-style, task-focused, minimal narration).

## Features

- **Agentic browsing** — The model drives a headless Chromium instance via Playwright: navigate, observe pages, click links/buttons, type into fields, and manage tabs.
- **Context awareness** — Each request includes the server time, your reverse-geocoded address (from browser geolocation), and the active tab’s URL/title.
- **Streaming replies** — Tokens stream to the browser over Server-Sent Events (SSE).
- **Multi-turn tool loop** — The server runs tool calls, feeds results back to the model, and repeats until the model finishes or hits a safety cap.
- **Pluggable “brain”** — Swap between local Ollama, remote Ollama, and Anthropic Claude via `.env`, without changing the rest of the app.

## How it works

```
Browser (chat.js)
    │  POST /chat  { message, address? }
    ▼
Express (index.js)
    │  builds messages: system.txt + chat history + per-request context
    ▼
brain.js  ──►  Ollama or Claude API  (streaming)
    │  tool_calls
    ▼
Playwright tools (navigate, observatory, clicker, …)
    │  tool results
    └──► back to the model until done
```

1. `**public/chat.js**` asks for geolocation (optional), reverse-geocodes coordinates with OpenStreetMap Nominatim, and sends your message plus address to the server.
2. `**index.js**` merges `system.txt`, conversation history, and a fresh system block with `[TIME]`, `[LOCATION]`, and `[BROWSER]` state.
3. `**brain.js**` translates between the app’s Ollama-shaped message/tool format and each provider’s API (including Claude streaming).
4. When the model requests tools, `**index.js**` runs them against the shared Playwright browser and appends results to the message list for the next model turn.

## Requirements

- [Node.js](https://nodejs.org/) 18+
- For **Ollama** providers: [Ollama](https://ollama.com/) running locally or on another machine
- For **Claude**: an [Anthropic API key](https://console.anthropic.com/)
- Playwright’s Chromium binary (installed once after `npm i`)

## Setup

```bash
git clone <your-repo-url>
cd ollama-chat
npm i
npx playwright install chromium
```

Create `.env` in the project root (see `.gitignore` — never commit secrets):

```env
# Current Brain
BRAIN_PROVIDER=

# Brains
## ollama_local
OLLAMA_MODEL=
OLLAMA_URL=http://localhost:11434
OLLAMA_THINK=false

## ollama_remote
REMOTE_OLLAMA_URL=
REMOTE_OLLAMA_MODEL=
REMOTE_OLLAMA_THINK=false

## claude
CLAUDE_API_KEY=
CLAUDE_MODEL=claude-haiku-4-5-20251001

# Other
USER_NAME=
```

### Choose a brain

Set `BRAIN_PROVIDER` to one of:


| Value           | Description                                                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `ollama_local`  | Chat via the Ollama npm client. Set `OLLAMA_MODEL` (e.g. `qwen3:8b`). `OLLAMA_THINK` controls extended thinking (`false` or `low`). |
| `ollama_remote` | Same API, but HTTP to `REMOTE_OLLAMA_URL` with `REMOTE_OLLAMA_MODEL`.                                                               |
| `claude`        | Anthropic Messages API. Set `CLAUDE_API_KEY` and `CLAUDE_MODEL`. Optional: `CLAUDE_MAX_TOKENS` (default `4096`).                    |


Examples:

```env
BRAIN_PROVIDER=ollama_local
OLLAMA_MODEL=qwen3:8b
USER_NAME=Your Name
```

```env
BRAIN_PROVIDER=claude
CLAUDE_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-haiku-4-5-20251001
USER_NAME=Your Name
```

`USER_NAME` can be set to anything and is just so that the AI system knows what to call you.

### Run

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000). Allow location when prompted if you want the model to see where you are.

## Browser tools

These are exposed to the model (defined in `tools.js`, implemented in `index.js`):


| Tool                                             | Purpose                                                                    |
| ------------------------------------------------ | -------------------------------------------------------------------------- |
| `navigate`                                       | Go to a URL                                                                |
| `observePage`                                    | Snapshot title, URL, visible text, inputs, and clickable elements with IDs |
| `observatory`                                    | Lighter/ob configurable page inspection                                    |
| `clickText`                                      | Click by visible label                                                     |
| `clickElement`                                   | Click by ID from `observePage`                                             |
| `clicker`                                        | Click by ID from `observatory`                                             |
| `type`                                           | Fill a CSS selector                                                        |
| `typist`                                         | Type into an input by index                                                |
| `newTab` / `switchTab` / `closeTab` / `listTabs` | Tab management                                                             |


The browser runs **headless** on the server machine — not on your phone’s screen. The model only sees what Playwright returns from each tool.

## Project layout


| Path         | Role                                                       |
| ------------ | ---------------------------------------------------------- |
| `index.js`   | Express server, Playwright browser, tool runner, chat loop |
| `brain.js`   | Provider switch + Ollama/Claude API adapters               |
| `tools.js`   | Tool schemas sent to the model                             |
| `system.txt` | System prompt and agent rules                              |
| `public/`    | Static UI (`index.html`, `chat.js`, `style.css`)           |


## Customization

- Edit `**system.txt`** to change tone, rules, and tool discipline.
- Add or change tools in `**tools.js`** and wire handlers in `**index.js**`’s `runTool`.
- Adjust context in `**buildSystemContext()**` in `index.js` if you want more or less browser metadata per turn.

## Notes

- **Location** is approximate (browser GPS → Nominatim). Denying permission sends `unknown` for location; the app still works.
- **Remote Ollama** with `stream: true` may need extra work in `brain.js` if the remote endpoint does not return the same stream shape as the local client.
- Keep `.env` out of version control. Rotate any API key that was ever committed or shared.

