# Jarvis

A tool-using AI agent system that runs across multiple clients (Web + Discord) backed by a swappable “brain” (Ollama or Claude).  
Jarvis is designed as an execution-first system with tool-driven reasoning, browser automation, and layered memory retrieval using QMD.

---

## Features

## Features

- Multi-client agent — Web UI + Discord bot using the same backend API
- Docker-compatible deployment
- Thread-based memory (Discord) — each thread reconstructed from full Discord history
- Persistent long-term memory powered by QMD
- Automatic journaling system that summarizes interactions into memory
- User profile extraction and persistent preference storage
- Swappable AI brain:
  - Ollama (local)
  - Ollama (remote)
  - Anthropic Claude
- Tool-using agent loop:
  - Structured tool execution
  - Iterative reasoning/action cycles
  - Automatic recovery from tool failures
- Browser automation (Playwright):
  - Navigate pages
  - Inspect page state
  - Click / type / interact
  - Multi-tab management
- Memory retrieval tool:
  - Multi-query semantic search
  - Hybrid lexical + vector retrieval
  - Cross-collection memory lookup
- Background indexing:
  - Automatic embedding generation
  - Automatic re-indexing
  - Collection synchronization
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

- message creates a new thread
- Each thread is a full conversation reconstructed from Discord history
- First message is stored as thread root
- No server-side chat memory (client is source of truth)

---

## Core principles

- Memory is externalized into QMD collections
- Tool execution is deterministic and loop-controlled
- No hardcoded “knowledge assumptions” inside model context

---

## Requirements

### Native

- Node.js 22+
- Ollama or Anthropic API key

### Docker (Recommended)

- Docker
- Docker Compose

Running inside Docker is recommended because it provides a consistent environment for Playwright, browser automation, and future sandboxed tooling.

---

## Setup

### 1) Clone

```bash
git clone https://github.com/saibjayaraman/Jarvis.git
cd Jarvis
```

### 2) Environment variables (Copy to .env and fill missing values if needed)

```env
# Current Brain
BRAIN_PROVIDER=openai1

# Brains
## ollama_local
OLLAMA_MODEL=gemma4:12b-mlx
OLLAMA_URL=http://host.docker.internal:11434
OLLAMA_THINK=false

## ollama_remote
REMOTE_OLLAMA_URL=
REMOTE_OLLAMA_MODEL=
REMOTE_OLLAMA_THINK=false

## claude
CLAUDE_API_KEY=
CLAUDE_MODEL=claude-haiku-4-5

## openai1
OPENAI_URL=https://api.deepinfra.com/v1/openai
OPENAI_MODEL=moonshotai/Kimi-K2.5
OPENAI_API_KEY=

## openai2
OPENAI2_MODEL=
OPENAI2_API_KEY=

# QMD Search
INDEXING_FREQUENCY=0.25
QMD_SEARCH_MODEL_PROVIDER=ollama_local
QMD_SEARCH_MODEL=phi3.5:3.8b
QMD_SEARCH_TOP_K=5
JOURNAL_INTERVAL=24
JOURNAL_MODEL=phi3.5:3.8b
MAX_MEMORY_CHARS=4000

# Coder
CODER_MODEL_PROVIDER=ollama_local
CODER_MODEL=deepseek-coder-v2:lite

# Other
USER_NAME=Sai Jayaraman
DISCORD_TOKEN=
ENABLE_WEBUI=false
MAX_TOOL_ROUNDS=-1
PROCESS_PORT=3000
```

#### Providers


| Provider         | Description                                                         |
| ---------------- | ------------------------------------------------------------------- |
| ollama_local     | Local Ollama instance                                               |
| ollama_remote    | Remote Ollama server                                                |
| claude           | Anthropic Claude API                                                |
| openai1/ openai2 | Any OpenAI compatible API (Two providers can be configured at once) |


### 3) Discord

- Go to the [Discord Developer Dashboard](https://discord.com/developers/applications)
- Create a new app called Jarvis
- Go to the bot tab, scroll down, andclick reset token
- Copy the token and put it in .env in the DISCORD_TOKEN= section
- Go to the installation tab, and make sure Install Link is set to Discord Provided Link
- Copy the link, and paste it into your browser
- Add the bot to your server of choice (preferably an empty/new
 server)

### 5) Ensuring Ollama Setup (Linux Only)

Make sure Linux is bound to 0.0.0.0:11434, not 127.0.0.1:11434, as this will break access from within a Docker container:

Run:

```bash
systemctl edit ollama.service
```

Paste:

```bash
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
```

ctrl+w then Enter to save, ctrl+x to exit

### 6) Run

```bash
docker compose up
```

It is also reccomended to write a bit about you, your background, preferences, and other facts about yourself in memory/people/your_name.md

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

---

# Goals / Future Features

- Full sandbox for coding/command execution and app building
- Tasks so Jarvis can schedule itself to wake up later
- Email/SMS
- API Framework (direct access via API to do tasks without full browser)
- Python sandbox (execute code mid response)
- Sub agents with specifc jobs

