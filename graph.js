import "dotenv/config";
import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";

// 1. Define the Graph State Schema
export const StateAnnotation = Annotation.Root({
    messages: Annotation({
        // Reducer: defines how new messages merge with existing messages
        reducer: (existing, updated) => existing.concat(updated),
        // Default initial state
        default: () => [],
    }),
});


// 2. Initialize Gemini Model
export const llm = new ChatGoogleGenerativeAI({
    model: process.env.GEMINI_MODEL,
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




// 4. Construct the Workflow Graph
const workflow = new StateGraph(StateAnnotation)
    .addNode("agent", callModel)
    .addEdge(START, "agent")
    .addEdge("agent", END);

// 5. Compile with an In-Memory Checkpointer (MemorySaver)
export const checkpointer = new MemorySaver();
export const app = workflow.compile({ checkpointer });