# 📚 Project Notes: LangGraph + Google Gemini Chatbot MVP (`ai_one`)

> **Location:** `d:\LLM's\ai_one`  
> **Stack:** Node.js (ESM), LangGraph.js, `@langchain/google-genai`, `@langchain/core`  
> **Purpose:** Reference guide covering everything built, configured, and learned in this project so far.

---

## 📑 Table of Contents
1. [Project Overview & Goals](#1-project-overview--goals)
2. [Tech Stack & Package Breakdown](#2-tech-stack--package-breakdown)
3. [Environment & Developer Setup](#3-environment--developer-setup)
4. [Core Architecture & Files Built](#4-core-architecture--files-built)
5. [Key Concepts & Mental Models](#5-key-concepts--mental-models)
6. [Interactive CLI & Real-Time Streaming](#6-interactive-cli--real-time-streaming)
7. [Testing & Verification Completed](#7-testing--verification-completed)
8. [Documentation & Guides Included](#8-documentation--guides-included)
9. [Future Roadmap & Next Upgrades](#9-future-roadmap--next-upgrades)
10. [Quick Command Cheatsheet](#10-quick-command-cheatsheet)

---

## 1. Project Overview & Goals
You built a **stateful, streaming, multi-turn AI chatbot** from scratch running in Node.js. 

### Core Accomplishments:
- Transitioned from simple one-off LLM API calls to an **agentic graph workflow** using **LangGraph.js**.
- Implemented **session memory (`thread_id`)** so the AI remembers previous conversation turns.
- Upgraded the terminal user experience from batch responses to **real-time token streaming** as Gemini generates text.
- Added session control commands (`/reset` to clear chat memory, `/exit` to terminate).
- Set up complete documentation, step-by-step tracklists, and architecture diagrams.

---

## 2. Tech Stack & Package Breakdown

All dependencies configured in [`package.json`](./package.json) (configured as `"type": "module"` for native ES modules):

| Package | Version | Purpose in Project |
| :--- | :--- | :--- |
| `@langchain/langgraph` | `^1.5.2` | Orchestration framework: defines state graphs, nodes, edges, state reducers, and session memory checkpointers (`MemorySaver`). |
| `@langchain/google-genai` | `^2.3.4` | Google's official LangChain model wrapper: connects to Gemini models (`gemini-3.8-flash`) using API keys. |
| `@langchain/core` | `^1.3.0` | Core abstractions: message classes (`HumanMessage`, `AIMessage`, `SystemMessage`) and stream events. |
| `dotenv` | `^18.0.9` | Environment loader: reads API keys and configuration from `.env` into `process.env`. |

---

## 3. Environment & Developer Setup

### 1. Environment Variables (`.env`)
The file [`.env`](./.env) securely holds:
```env
GEMINI_API_KEY=your_key_here
GOOGLE_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.8-flash
```
*Note: Both keys are provided to support both standard Google GenAI SDKs and LangChain integrations.*

### 2. Git & Security (`.gitignore`)
The [`.gitignore`](./.gitignore) file ensures:
- `node_modules/` is excluded.
- `.env` is never committed to GitHub or version control.

### 3. Debugger Configuration (`.vscode/launch.json`)
Configured VS Code to attach to Node.js inspect mode on port `9229` via script `npm run debug`.

---

## 4. Core Architecture & Files Built

### 1. Graph Definition: [`graph.js`](./graph.js)
This file defines the state machine and compiles the executable AI graph.

```
[START] ---> [agent (callModel)] ---> [END]
                     |
            (MemorySaver Checkpointer)
```

1. **State Annotation Schema (`StateAnnotation`)**:
   ```javascript
   export const StateAnnotation = Annotation.Root({
     messages: Annotation({
       reducer: (existing, updated) => existing.concat(updated),
       default: () => [],
     }),
   });
   ```
   - Defines the `messages` channel in state.
   - **Reducer:** Concatenates new messages to the existing array. Without this, new messages would overwrite past conversation history.

2. **Gemini LLM Setup**:
   ```javascript
   export const llm = new ChatGoogleGenerativeAI({
     model: process.env.GEMINI_MODEL,
     apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
     temperature: 0.7,
   });
   ```

3. **Node Function (`callModel`)**:
   ```javascript
   export async function callModel(state) {
     const response = await llm.invoke(state.messages);
     return { messages: [response] };
   }
   ```
   - Passes the **entire message array** to Gemini so it has full context.
   - Returns `{ messages: [response] }`. The reducer automatically appends it.

4. **Graph Construction & Compilation**:
   ```javascript
   const workflow = new StateGraph(StateAnnotation)
     .addNode("agent", callModel)
     .addEdge(START, "agent")
     .addEdge("agent", END);

   export const checkpointer = new MemorySaver();
   export const app = workflow.compile({ checkpointer });
   ```
   - Compiles the workflow with `MemorySaver` so conversation states are saved under specific `thread_id` keys.

---

### 2. Terminal CLI & Streaming: [`index.js`](./index.js)
This is the interactive entry point that runs in your terminal:

1. **Readline Interface:** Uses Node's native `readline/promises` for an asynchronous user input prompt `You > `.
2. **Session Thread Tracking:**
   ```javascript
   let threadId = `session-${Date.now()}`;
   ```
   Every run starts with a unique session ID.
3. **Special In-Chat Commands:**
   - `/reset` or `clear`: Generates a new `threadId = session-${Date.now()}`, resetting memory without restarting the program.
   - `/exit` or `quit`: Breaks the loop and shuts down cleanly.
4. **Real-Time Token Streaming (`streamEvents`)**:
   ```javascript
   const config = { configurable: { thread_id: threadId }, version: "v2" };
   const eventStream = app.streamEvents(
     { messages: [new HumanMessage(trimmed)] },
     config
   );

   for await (const event of eventStream) {
     if (event.event === "on_chat_model_stream" && event.data?.chunk?.content) {
       process.stdout.write(event.data.chunk.content);
     }
   }
   ```
   - Instead of waiting 3–5 seconds for the entire sentence, words stream instantly as Gemini produces them.

---

## 5. Key Concepts & Mental Models

### 💡 Why LangGraph instead of a simple array?
- **Branching & Cycles:** Real agents need to loop (e.g., call a tool, inspect results, decide whether to answer or call another tool). Simple scripts get messy; graphs handle cycles cleanly.
- **State Channels & Reducers:** Keeps data immutable and safe. Nodes only return partial updates.
- **Checkpointing:** By attaching a `thread_id`, state can be paused, persisted, or resumed effortlessly.

### 💡 The Message Lifecycle
1. User types input $\rightarrow$ wrapped into `new HumanMessage(input)`.
2. Passed to `app.streamEvents` with `thread_id`.
3. `MemorySaver` retrieves past messages for that `thread_id`.
4. State Reducer appends the new `HumanMessage`.
5. `START` routes to `callModel`.
6. Gemini receives the full conversation history.
7. Tokens stream live to terminal via `on_chat_model_stream`.
8. Gemini finishes $\rightarrow$ `AIMessage` appended to state $\rightarrow$ state saved to `MemorySaver`.

---

## 6. Testing & Verification Completed

| Test Scenario | Input / Action | Result | Verification Status |
| :--- | :--- | :--- | :--- |
| **Single-turn Direct Test** | One-liner `node -e` test invoking `app.invoke()` | Gemini responded with 1 introduction sentence | ✅ Verified |
| **Interactive CLI** | `npm start` | Prompt displayed `You > ` and responded | ✅ Verified |
| **Real-time Streaming** | Multi-sentence prompt | Tokens printed incrementally via `process.stdout.write` | ✅ Verified |
| **Multi-Turn Memory** | Turn 1: "My favorite food is margherita pizza."<br>Turn 2: "What is my favorite food?" | AI correctly recalled "margherita pizza" from state | ✅ Verified |
| **Session Reset (`/reset`)** | Typed `/reset`, then asked "What is my favorite food?" | AI responded that it did not know (new `threadId`) | ✅ Verified |
| **Graceful Exit (`/exit`)** | Typed `/exit` | Terminal greeted goodbye and closed readline cleanly | ✅ Verified |

---

## 7. Documentation & Guides Included

You created two dedicated in-depth markdown files in your workspace:
- [`TRACKLIST.md`](./TRACKLIST.md): 9-step manual coding tracklist with checkboxes, explanation of each line of code, and testing instructions.
- [`WALKTHROUGH.md`](./WALKTHROUGH.md): Architectural deep-dive including Mermaid flowcharts, step-by-step message lifecycles, and mental models.
- [`.agents/skills/gemini-api-dev/`](./.agents/skills/gemini-api-dev/SKILL.md): Comprehensive reference guide for building with Google Gemini models.

---

## 8. Future Roadmap & Next Upgrades

When you are ready to expand this project further, here are the logical next steps:
1. **System Prompt (Jarvis Persona):** Prepend a `SystemMessage` in `callModel` to give the AI specific behavioral guidelines or persona.
2. **Tools & Function Calling (ReAct Agent):** Bind tools (e.g., calculator, weather, web search) with `llm.bindTools()` and add tool nodes with conditional edges.
3. **Persistent Database Checkpointer:** Upgrade from in-memory `MemorySaver` to SQLite (`@langchain/langgraph-checkpoint-sqlite`) or PostgreSQL so chat history survives terminal restarts.
4. **Web Frontend / REST API:** Build a lightweight Express/Fastify server with Server-Sent Events (SSE) and an interactive web chat UI.

---

## 9. Quick Command Cheatsheet

```bash
# Run the chatbot
npm start

# Run in debug mode (attaches to VS Code debugger on port 9229)
npm run debug

# In-chat interactive commands
/reset   # Clears session memory and starts a new conversation thread
/exit    # Quits the chatbot
```

