import "dotenv/config";
import express from "express";
import { readFileSync } from "fs";
import { brainChat } from "./brain.js";
import { tools, runTool, getCurrentPage } from "./tools.js";
import "./discord.js";
import { extractMemory } from "./memoryExtractor.js";
import { writeMemory } from "./memoryWriter.js"
import "./memoryIndexer.js";
import "./memory/journalWorker.js";

process.on("SIGINT", async () => {
    // silence everything during shutdown
    const noop = () => {};

    console.log = noop;
    console.warn = noop;
    console.error = noop;

    try {
        await model?.dispose?.();
        await store?.close?.();
    } catch {}

    process.exit(0);
});

function currentDate(date = new Date()) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
  
    return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;
}

const app = express();

const systemraw = readFileSync("./system.txt", {encoding: "utf8"})
const system = systemraw.replaceAll("<name>", process.env.USER_NAME)

const chatHistory = [{
    role: "system",
    content: system
}];

function sendEvent(res, data) {
    if (!res) return

    res.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function streamChat(messages, onToken) {
    const stream = await brainChat({
        messages,
        tools,
        stream: true
    });

    let content = "";
    let tool_calls;

    for await (const chunk of stream) {
        const token = chunk.message.content || chunk.message.thinking;
        if (token) {
            content += token;
            onToken(token);
        }

        if (chunk.message.tool_calls) {
            tool_calls = chunk.message.tool_calls;
        }
    }

    const assistant = { role: "assistant", content };
    if (tool_calls?.length) assistant.tool_calls = tool_calls;
    return assistant;
}

const MAX_TOOL_ROUNDS = process.env.MAX_TOOL_ROUNDS;

async function chatWithTools(res, messages) {
    for (let round = 0; (MAX_TOOL_ROUNDS === -1) ? true : (round < MAX_TOOL_ROUNDS); round++) {
        const response = await streamChat(messages, (token) => {
            sendEvent(res, { type: "token", content: token });
        });

        messages.push(response);

        if (!response.tool_calls?.length) {
            return response;
        }

        for (const call of response.tool_calls) {
            const name = call.function.name;
            sendEvent(res, { type: "tool", name });

            try {
                console.time("tool:" + name)
                const result = await runTool(name, call.function.arguments);
                console.timeEnd("tool:" + name)

                if (result?.sleep) {
                    return {
                        paused: true,
                        seconds: result.seconds,
                        message: result.message
                    };
                }

                const content = typeof result === "string" ? result : JSON.stringify(result);
                messages.push({ role: "tool", tool_name: name, content });
            } catch (err) {
                console.error(`Tool ${name} failed:`, err);
                messages.push({
                    role: "tool",
                    tool_name: name,
                    content: `Error: ${err.message}`
                });
            }
        }
    }

    throw new Error("Too many tool rounds");
}

app.use(express.json());
if (process.env.ENABLE_WEBUI === true) app.use(express.static("public"));

function buildSystemContext(address) {
    const page = getCurrentPage();
    return `
[TIME]
${currentDate()}

[LOCATION]
${address ?? "unknown"}

[BROWSER]
url: ${page?.url?.() ?? "none"}
title: ${page?.title?.() ?? "none"}
`;

}

app.post("/chat", async (req, res) => {
    res.setHeader("X-Accel-Buffering", "no");
    var { message, address } = req.body;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    console.log("chat:", message?.slice(0, 80));
    sendEvent(res, { type: "status", content: "Thinking…" });

    try {
        const systemMessage = {
            role: "system",
            content: buildSystemContext(address)
        }
        chatHistory.push({ role: "user", content: message });
        const response = await chatWithTools(res, [...chatHistory, systemMessage]);
        chatHistory.push({ role: "assistant", content: response })

        sendEvent(res, { type: "done" });
        res.end();
    } catch (err) {
        console.error(err);
        sendEvent(res, { type: "error", content: "Error talking to Ollama." });
        res.end();
    }
});

app.post("/chat-json", async (req, res) => {
    try {
        const { messages } = req.body;

        const lastUserMessage = [...messages]
            .reverse()
            .find(m => m.role === "user")?.content ?? "";

        const query = lastUserMessage.trim();
        if (!query) {
            console.warn("Empty query detected — skipping memory search");
        }

        const systemMessage = {
            role: "system",
            content:
                system +
                "\n\n" +
                buildSystemContext("Unknown due to client")
        };

        const response = await chatWithTools(
            null,
            [
                systemMessage,
                ...messages
            ]
        );

        res.json({
            response: response.content
        });

        queueMicrotask(async () => {
            try {
                const memory = await extractMemory(
                    brainChat,
                    [...messages, response]
                );
        
                if (!memory) return;
        
                await writeMemory(memory);
        
            } catch (err) {
                console.error("Memory extraction failed:", err);
            }
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            error: err.message
        });
    }
});

app.listen(3000, () => {
    console.log("http://localhost:3000");
});