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

            // // Invoke the LangGraph app with the current thread ID
            // const config = { configurable: { thread_id: threadId } };
            // const result = await app.invoke(
            //     { messages: [new HumanMessage(trimmed)] },
            //     config
            // );
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

            // const latestMessage = result.messages[result.messages.length - 1];
            // console.log(latestMessage.content + "\n");
        }
    } finally {
        rl.close();
    }
}

main().catch(console.error);