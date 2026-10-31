import "dotenv/config";
import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";

import { tool } from "@langchain/core/tools"
import { z } from "zod"
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
// 1. Define the Graph State Schema
export const StateAnnotation = Annotation.Root({
    messages: Annotation({
        // Reducer: defines how new messages merge with existing messages
        reducer: (existing, updated) => existing.concat(updated),
        // Default initial state
        default: () => [],
    }),
});


// 1. Calculator Tool
export const calculatorTool = tool(
    async ({ expression }) => {
        try {
            // Safe evaluation for basic math: numbers, +, -, *, /, %, parenthesis, spaces
            if (!/^[0-9+\-*/().\s%]+$/.test(expression)) {
                return "Error: Invalid characters in arithmetic expression.";
            }
            const result = Function(`"use strict"; return (${expression})`)();
            return String(result);
        } catch (err) {
            return `Error evaluating expression: ${err.message}`;
        }
    },
    {
        name: "calculator",
        description: "Useful for performing mathematical calculations and evaluating arithmetic expressions.",
        schema: z.object({
            expression: z.string().describe("The mathematical expression to evaluate, e.g. '45 * 12 + 350'"),
        }),
    }
);
// 2. Weather Lookup Tool (Mock Service for MVP)
export const weatherTool = tool(
    async ({ city }) => {
        const cityLower = city.toLowerCase().trim();
        const mockWeather = {
            tokyo: "Kamlesh",
            london: "Rainy, 14°C (57°F) with high humidity",
            "new york": "Partly cloudy, 18°C (64°F)",
            paris: "Mild, 19°C (66°F)",
            mumbai: "Warm and humid, 32°C (90°F)",
        };

        if (mockWeather[cityLower]) {
            return `Current weather in ${city}: ${mockWeather[cityLower]}`;
        }
        return `Current weather in ${city}: Clear skies, 24°C (75°F) (estimated).`;
    },
    {
        name: "getWeather",
        description: "Get the current weather conditions for a specified city.",
        schema: z.object({
            city: z.string().describe("The name of the city, e.g. 'Tokyo' or 'London'"),
        }),
    }
);
// 2. Initialize Gemini Model
export const llm = new ChatGoogleGenerativeAI({
    model: process.env.GEMINI_MODEL,
    apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
    // temperature: 0.7, // High temperature for creativity
    temperature: 0, // Lower temperature (0) is recommended for precise tool calling
});

export const tools = [calculatorTool, weatherTool];
// Bind tools to the model
export const modelWithTools = llm.bindTools(tools);

export async function callModel(state) {
    // Invokes Gemini with all messages and the bound tool schemas
    const response = await modelWithTools.invoke(state.messages);
    // Return only the update; the reducer will append it to state.messages
    return { messages: [response] };
}
const toolNode = new ToolNode(tools)


// 4. Construct the Workflow Graph
const workflow = new StateGraph(StateAnnotation)
    .addNode("agent", callModel)
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    // Conditional Edge: If agent produced tool_calls -> route to 'tools', otherwise route to END
    .addConditionalEdges("agent", toolsCondition)
    // Edge: After tools execute, always route back to 'agent' to synthesize response
    .addEdge("tools", "agent")

// 5. Compile with an In-Memory Checkpointer (MemorySaver)
export const checkpointer = new MemorySaver();
export const app = workflow.compile({ checkpointer });


// --- Tool Definitions ---

