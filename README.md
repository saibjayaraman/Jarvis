# Jarvis

A tool-using AI agent system that runs across multiple clients (Web + Discord) backed by a swappable “brain” (Ollama or Claude).  
Jarvis is designed as an execution-first system with tool-driven reasoning, browser automation, and layered memory retrieval using QMD.

---

## Features

- Multi-client agent — Web UI + Discord bot using the same backend API
- Thread-based memory (Discord) — each thread reconstructed from full Discord history
- Uses an advanced memory system (QMD) for persistant memory accross chats
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

## Memory System (QMD)

Jarvis now uses **@tobilu/qmd** for persistent semantic + lexical memory across:

- chats (`memory/previous_chats`)
- people (`memory/people`)
- journal (`memory/journal`)

### Indexing pipeline

A background indexer runs automatically:

```js
await store.update({
    collections: ["chats", "people", "journal"]
});

await store.embed({
    chunkStrategy: "auto",
    force: false
});
```

### Memory retrieval

Before each LLM call, the system:

- Expands multiple memory queries from the model
- Runs parallel search across QMD collections
- Merges + deduplicates results
- Injects compact context into system prompt

### Tool: search_memory

The model can issue multi-query memory searches:

```json
{
  "queries": [
    "project goals",
    "current work",
    "technical focus",
    "recent activity"
  ]
}
```

Each query is executed via QMD hybrid search (lexical + vector).

---

## Architecture

```
Discord / Web Client
    ↓
Express server (index.js)
    ↓
system.txt + runtime context (time/location/browser state)
    ↓
QMD memory retrieval layer (search_memory tool)
    ↓
brain.js (provider router)
    ↓
LLM (Ollama / Claude / remote)
    ↓
tool calls (optional)
    ↓
Playwright + internal tools
    ↓
QMD memory write-back (journaling / chat logs / people extraction)
```

---

## Discord behavior

- @mention creates a new thread
- Each thread is a full conversation reconstructed from Discord history
- First message is stored as thread root
- No server-side chat memory (client is source of truth)

---

## Core principles

- Client owns conversational context
- Backend is stateless
- Memory is externalized into QMD collections
- Tool execution is deterministic and loop-controlled
- Memory retrieval happens before LLM reasoning step
- No hardcoded “knowledge assumptions” inside model context

---

## Requirements

- Node.js 18+
- Playwright (Chromium)
- Ollama or Anthropic API key

---

## Setup

### Cloning (Run in terminal)

```bash
git clone https://github.com/saibjayaraman/Jarvis.git
cd ollama-chat
npm install
npx playwright install chromium
ollama pull phi3.5:3.8b
npm run add_collections
```

### Environment variables (Copy to .env and fill other values)

```env
# Current Brain
BRAIN_PROVIDER=claude

# Brains
## ollama_local
OLLAMA_MODEL=qwen3:8b
OLLAMA_URL=http://localhost:11434
OLLAMA_THINK=false

## ollama_remote
REMOTE_OLLAMA_URL=
REMOTE_OLLAMA_MODEL=
REMOTE_OLLAMA_THINK=false

## claude
CLAUDE_API_KEY=
CLAUDE_MODEL=claude-haiku-4-5-20251001

# QMD Search
INDEXING_FREQUENCY=0.25
QMD_SEARCH_MODEL_PROVIDER=ollama_local
QMD_SEARCH_MODEL=phi3.5:3.8b
QMD_SEARCH_TOP_K=5
JOURNAL_INTERVAL=24
JOURNAL_MODEL=phi3.5:3.8b
MAX_MEMORY_CHARS=4000

# Other
USER_NAME=
DISCORD_TOKEN=
ENABLE_WEBUI=false
MAX_TOOL_ROUNDS=-1
PROCESS_PORT=3000
```
### Brain providers


| Provider      | Description           |
| ------------- | --------------------- |
| ollama_local  | Local Ollama instance |
| ollama_remote | Remote Ollama server  |
| claude        | Anthropic Claude API  |

### Run

```bash
npm start
```

Open:

```
http://localhost:3000
```

It is also reccomended to write a bit about you, your background, preferences, and facts about yourself in memory/people/your_name.md

---

## Browser tools


| Tool                                     | Purpose                |
| ---------------------------------------- | ---------------------- |
| navigate                                 | Load URL               |
| observatory                              | Inspect page state     |
| observePage                              | Full DOM snapshot      |
| clicker                                  | Click element by ID    |
| clickText                                | Click by visible label |
| typist                                   | Type into inputs       |
| type                                     | CSS selector input     |
| newTab / switchTab / closeTab / listTabs | Tab management         |


---

## Memory tools


| Tool          | Purpose                              |
| ------------- | ------------------------------------ |
| search_memory | Multi-query QMD hybrid memory search |


Memory is automatically:

- indexed
- embedded
- deduplicated
- merged across collections

Collections:

- chats
- people
- journal

---

## System prompt behavior (Jarvis)

Jarvis is an execution-first agent:

- Task completion > conversation
- Minimize tool cycles
- Prefer direct action over explanation
- Memory is always consulted when relevant
- Recover from tool failure by switching strategy immediately

---

## Project structure


| File       | Purpose                                 |
| ---------- | --------------------------------------- |
| index.js   | Express server + Playwright + tool loop |
| brain.js   | Model router (Ollama / Claude / remote) |
| tools.js   | Tool definitions + runner               |
| memory.js  | QMD memory interface                    |
| qmd.js     | Store initialization                    |
| system.txt | System prompt                           |
| public/    | Web UI                                  |


---

## Key design change

Old:

```
server memory → model
```

New:

```
client memory → QMD retrieval layer → model → QMD write-back
```

---

## Notes

- QMD is the long-term memory layer
- Memory is retrieved per-request via multi-query expansion
- Memory is written asynchronously after responses
- System remains stateless outside QMD
- Tool outputs should remain minimal to avoid context bloat

