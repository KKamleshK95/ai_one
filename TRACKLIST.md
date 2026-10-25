# 🚀 Step-by-Step Manual Coding Tracklist: LangGraph + Gemini Chatbot MVP

This tracklist is your interactive workbook. Follow each step, write the code yourself to build muscle memory, and check off each box (`[x]`) as you progress.

---

## 📋 Tracklist Overview

- [X] **Step 1:** Install Required NPM Dependencies
- [X] **Step 2:** Configure Environment Variables in `.env`
- [X] **Step 3:** Define State Schema with LangGraph `Annotation`
- [X] **Step 4:** Initialize `ChatGoogleGenerativeAI` and the Model Node
- [X] **Step 5:** Build and Compile the `StateGraph` with `MemorySaver`
- [X] **Step 6:** Run a Single-Turn Test to Verify Core Graph Execution
- [X] **Step 7:** Build the Interactive CLI Conversation Loop (`readline`)
- [X] **Step 8:** Add Real-Time Live Token Streaming
- [X] **Step 9:** Test Multi-Turn Memory & Special Commands (`/reset`, `/exit`)

---

## 🛠️ Step 1: Install Required NPM Dependencies

### 🎯 Goal
Install the 4 core libraries required for this workflow.

### 💻 Command to Run
In your terminal (Powershell in `d:\LLM's\ai_one`):
```bash
npm install @langchain/langgraph @langchain/google-genai @langchain/core dotenv
```

### 🧠 Understanding What Each Package Does
| Package | Role in Your Application |
| :--- | :--- |
| `@langchain/langgraph` | Orchestration engine that coordinates state, nodes, edges, cycles, and multi-turn memory (`MemorySaver`). |
| `@langchain/google-genai` | The official LangChain wrapper for Google Gemini models (`ChatGoogleGenAI`). |
| `@langchain/core` | Message primitives (`HumanMessage`, `AIMessage`, `SystemMessage`) and base runnable abstractions. |
| `dotenv` | Loads environment variables from `.env` into `process.env`. |

- [X] **Check when done:** Packages installed and visible in `package.json` under `"dependencies"`.

---

## 🔑 Step 2: Configure Environment Variables in `.env`

### 🎯 Goal
Ensure `@langchain/google-genai` detects your Gemini API key automatically.

### 📝 Code to Place in `.env`
Open [`.env`](file:///d:/LLM's/ai_one/.env) and ensure it has:
```env
GEMINI_API_KEY=
GOOGLE_API_KEY=
GEMINI_MODEL=gemini-3.8-flash
```

> [!NOTE]
> `@langchain/google-genai` natively looks for `GOOGLE_API_KEY`. Defining both guarantees compatibility with both LangChain and the standard Google GenAI SDK.

- [X] **Check when done:** `.env` saved with `GOOGLE_API_KEY` defined.

---

## 🧱 Step 3: Define State Schema with LangGraph `Annotation`

### 🎯 Goal
Create [`graph.js`](file:///d:/LLM's/ai_one/graph.js) and define how conversation state is stored and updated.

### 📝 Code to Write
Create `graph.js` and write:
```javascript
import "dotenv/config";
import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

// 1. Define the Graph State Schema
export const StateAnnotation = Annotation.Root({
  messages: Annotation({
    // Reducer: defines how new messages merge with existing messages
    reducer: (existing, updated) => existing.concat(updated),
    // Default initial state
    default: () => [],
  }),
});
```

### 🧠 Why the Reducer Function is Critical
In LangGraph, state updates are returned as partial dictionaries (e.g. `{ messages: [response] }`). Without a reducer, a new return value would **overwrite** the entire array, erasing chat history! The reducer `(existing, updated) => existing.concat(updated)` appends every new incoming message to the conversation history.

- [X] **Check when done:** `StateAnnotation` defined in `graph.js`.

---

## 🤖 Step 4: Initialize `ChatGoogleGenerativeAI` and the Model Node

### 🎯 Goal
Instantiate Gemini and build the graph execution node function.

### 📝 Code to Append to `graph.js`
```javascript
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

// 2. Initialize Gemini Model
export const llm = new ChatGoogleGenerativeAI({
  model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
  apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
  temperature: 0.7,
});

// 3. Define the Node Function
export async function callModel(state) {
  // state.messages contains all conversation history so far
  const response = await llm.invoke(state.messages);
  // Return only the update; the reducer will append it to state.messages
  return { messages: [response] };
}
```

### 🧠 What is a Node?
A node is simply an asynchronous JavaScript function that:
1. Receives the current graph `state`.
2. Interacts with an LLM, API, database, or tool.
3. Returns a state update object (`{ messages: [response] }`).

- [X] **Check when done:** `llm` and `callModel` added to `graph.js`.

---

## 🕸️ Step 5: Build and Compile the `StateGraph` with `MemorySaver`

### 🎯 Goal
Connect nodes with edges and compile into an executable runnable with session checkpointing.

### 📝 Code to Append to `graph.js`
```javascript
import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";

// 4. Construct the Workflow Graph
const workflow = new StateGraph(StateAnnotation)
  .addNode("agent", callModel)
  .addEdge(START, "agent")
  .addEdge("agent", END);

// 5. Compile with an In-Memory Checkpointer (MemorySaver)
export const checkpointer = new MemorySaver();
export const app = workflow.compile({ checkpointer });
```

### 🧠 How MemorySaver Works
`MemorySaver` is LangGraph's built-in session state manager. When calling the compiled `app`, passing a config object like `{ configurable: { thread_id: "session-1" } }` tells LangGraph to automatically retrieve previous messages for `thread_id: "session-1"` and save new ones after each node finishes.

- [X] **Check when done:** `workflow` constructed and `app` compiled with `checkpointer`.

---

## 🧪 Step 6: Run a Single-Turn Test

### 🎯 Goal
Test your compiled graph directly before building the interactive CLI interface.

### 💻 Verification Command
Run this one-liner in your terminal:
```bash
node -e "import('./graph.js').then(async ({ app }) => { const { HumanMessage } = await import('@langchain/core/messages'); const res = await app.invoke({ messages: [new HumanMessage('Hello, say 1 sentence introducing yourself.')] }, { configurable: { thread_id: 'test' } }); console.log('\nAI Response:', res.messages[res.messages.length - 1].content); })"
```

### 🔍 Expected Result
You should see a single sentence response from Gemini printed in your terminal without errors.

- [X] **Check when done:** Gemini responds successfully in terminal.

---

## 💬 Step 7: Build the Interactive CLI Loop (`index.js`)

### 🎯 Goal
Update [`index.js`](file:///d:/LLM's/ai_one/index.js) with a full terminal conversation loop.

### 📝 Code to Write in `index.js`
```javascript
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { HumanMessage } from "@langchain/core/messages";
import { app } from "./graph.js";

async function main() {
  const rl = readline.createInterface({ input, output });
  let threadId = `session-${Date.now()}`;

  console.log("==================================================");
  console.log("🤖 LangGraph + Gemini Interactive Chatbot MVP");
  console.log("Commands: '/reset' to clear chat | '/exit' to quit");
  console.log("==================================================\n");

  try {
    while (true) {
      const userInput = await rl.question("You > ");
      const trimmed = userInput.trim();

      if (!trimmed) continue;

      if (trimmed.toLowerCase() === "/exit" || trimmed.toLowerCase() === "quit") {
        console.log("Goodbye!");
        break;
      }

      if (trimmed.toLowerCase() === "/reset" || trimmed.toLowerCase() === "clear") {
        threadId = `session-${Date.now()}`;
        console.log("🧹 Conversation reset. Started a new session!\n");
        continue;
      }

      process.stdout.write("AI  > ");

      // Invoke the LangGraph app with the current thread ID
      const config = { configurable: { thread_id: threadId } };
      const result = await app.invoke(
        { messages: [new HumanMessage(trimmed)] },
        config
      );

      const latestMessage = result.messages[result.messages.length - 1];
      console.log(latestMessage.content + "\n");
    }
  } finally {
    rl.close();
  }
}

main().catch(console.error);
```

- [ ] **Check when done:** `index.js` written and runnable via `node index.js`.

---

## ⚡ Step 8: Add Real-Time Live Token Streaming

### 🎯 Goal
Upgrade `index.js` so tokens print live to the console as Gemini generates them instead of waiting for the full response.

### 📝 Code Update in `index.js`
In the conversation loop inside `index.js`, replace the `app.invoke(...)` call with `app.streamEvents(...)`:

```javascript
      process.stdout.write("AI  > ");

      const config = { configurable: { thread_id: threadId }, version: "v2" };
      const eventStream = app.streamEvents(
        { messages: [new HumanMessage(trimmed)] },
        config
      );

      for await (const event of eventStream) {
        // Look for chat model streaming chunks
        if (event.event === "on_chat_model_stream" && event.data?.chunk?.content) {
          process.stdout.write(event.data.chunk.content);
        }
      }
      console.log("\n");
```

- [ ] **Check when done:** Responses now stream smoothly token-by-token in the console.

---

## 🧪 Step 9: Test Multi-Turn Memory & Commands

### 🎯 Goal
Verify end-to-end state persistence and special commands.

### 🧪 Test Scenarios:
1. **Multi-turn Memory Test:**
   - Prompt 1: `My favorite food is margherita pizza.`
   - Response 1: (Acknowledges)
   - Prompt 2: `What is my favorite food?`
   - Response 2: Should correctly state `margherita pizza` (proves `MemorySaver` works across turns).

2. **Session Reset Test:**
   - Type `/reset`
   - Prompt: `What is my favorite food?`
   - Response: Should state that it doesn't know (proves thread state was cleared).

3. **Exit Test:**
   - Type `/exit`
   - Terminal cleanly exits.

- [ ] **Check when done:** All 3 verification tests passed!
