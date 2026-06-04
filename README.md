# Jarvis

A tool-using AI agent system that runs across multiple clients (Web + Discord) backed by a swappable “brain” (Ollama or Claude).  
Jarvis is designed as an execution-first system with tool-driven reasoning, browser automation, and client-owned conversation memory.

---

## Features

- Multi-client agent — Web UI + Discord bot using the same backend API
- Thread-based memory (Discord) — each thread is a full isolated conversation reconstructed from Discord history
- Stateless backend — `/chat-json` receives full message history from the client (no server-side chat memory)
- Swappable AI brain:
  - Ollama (local)
  - Ollama (remote)
  - Anthropic Claude (streaming supported)
- Tool-using agent loop:
  - Executes structured tool calls
  - Iterates until completion or tool limit reached
- Browser automation (Playwright):
  - Navigate pages
  - Inspect DOM state
  - Click / type / interact
- Web UI streaming (SSE)

---

## Architecture

```
Discord / Web Client
    ↓
Express server (index.js)
    ↓
system.txt + runtime context (time/location/browser state)
    ↓
brain.js (provider router)
    ↓
LLM (Ollama / Claude / remote)
    ↓
tool calls (optional)
    ↓
Playwright + internal tools
    ↓
tool results fed back until completion
```

---

## Discord behavior

- @mention creates a new thread
- Each thread is a self-contained conversation
- Context is reconstructed from Discord messages
- First prompt is stored as thread root (critical for consistency)
- No database, no server-side memory

---

## Core principles

- Client owns memory (Discord/Web provides full context)
- Backend is stateless
- No synthetic placeholders in model context
- Tool execution is deterministic and loop-controlled
- No refusal-style “capability limits” when tools exist

---

## Requirements

- Node.js 18+
- Playwright (Chromium)
- Ollama or Anthropic API key

---

## Setup

```bash
git clone <repo>
cd ollama-chat
npm install
npx playwright install chromium
```

---

## Environment variables

```env
BRAIN_PROVIDER=ollama_local

OLLAMA_MODEL=qwen3:8b
OLLAMA_URL=http://localhost:11434

REMOTE_OLLAMA_URL=
REMOTE_OLLAMA_MODEL=

CLAUDE_API_KEY=
CLAUDE_MODEL=claude-haiku-4-5-20251001

USER_NAME=YourName
```

---

## Brain providers

| Provider | Description |
|----------|-------------|
| ollama_local | Local Ollama instance |
| ollama_remote | Remote Ollama server |
| claude | Anthropic Claude API |

---

## Run

```bash
npm start
```

Open:

```
http://localhost:3000
```

---

## Browser tools

| Tool | Purpose |
|------|--------|
| navigate | Load URL |
| observatory | Inspect page state |
| observePage | Full DOM snapshot |
| clicker | Click element by ID |
| clickText | Click by visible label |
| typist | Type into inputs |
| type | CSS selector input |
| newTab / switchTab / closeTab / listTabs | Tab management |

---

## System prompt behavior (Jarvis)

Jarvis is an execution-first agent:

- Task completion > conversation
- Minimize tool cycles
- Prefer direct action over explanation
- Never output tool-limit or capability excuses if a valid path exists
- Recover from tool failure by switching strategy immediately

---

## Project structure

| File | Purpose |
|------|--------|
| index.js | Express server + Playwright + tool loop |
| brain.js | Model router (Ollama / Claude / remote) |
| tools.js | Tool schema definitions |
| system.txt | System prompt |
| public/ | Web UI |

---

## Key design change

Old:

```
server memory → model
```

New:

```
client memory → server → model
```

This enables:
- Discord thread persistence
- Web + Discord parity
- Stateless scaling
- Easy model swapping

---

## Notes

- Threads are the source of truth in Discord mode
- Do not rely on server-side chat history (removed)
- Long conversations should be truncated or summarized
- All providers must normalize messages in brain.js