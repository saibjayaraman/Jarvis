import crypto from "crypto";
import ollama from "ollama";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
    apiKey: process.env.CLAUDE_API_KEY
});

const provider = process.env.BRAIN_PROVIDER;

function parseToolInput(args) {
    if (args == null) return {};
    return typeof args === "string" ? JSON.parse(args) : args;
}

function toAnthropicTools(tools) {
    if (!tools?.length) return undefined;
    return tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters
    }));
}

/** Unwrap assistant rows where index.js stored the whole response in `content`. */
function normalizeMessage(m) {
    if (m.role !== "assistant" || !m.content || typeof m.content !== "object" || Array.isArray(m.content)) {
        return m;
    }
    const inner = m.content;
    if (typeof inner.content === "string" || inner.tool_calls) {
        return {
            role: "assistant",
            content: typeof inner.content === "string" ? inner.content : "",
            tool_calls: inner.tool_calls ?? m.tool_calls
        };
    }
    return m;
}

/** Map Ollama-style messages to Anthropic system + messages. */
function toAnthropicMessages(messages) {
    const systemParts = [];
    const anthropicMessages = [];
    let pendingToolResults = null;
    let toolUseIdsByName = {};

    function flushToolResults() {
        if (!pendingToolResults?.length) return;
        anthropicMessages.push({ role: "user", content: pendingToolResults });
        pendingToolResults = null;
    }

    for (const raw of messages) {
        const m = normalizeMessage(raw);
        if (m.role === "system") {
            systemParts.push(m.content);
            continue;
        }

        if (m.role === "tool") {
            if (!pendingToolResults) pendingToolResults = [];
            pendingToolResults.push({
                type: "tool_result",
                tool_use_id: toolUseIdsByName[m.tool_name] ?? m.tool_use_id,
                content: m.content
            });
            continue;
        }

        flushToolResults();

        if (m.role === "user") {
            anthropicMessages.push({ role: "user", content: m.content });
            continue;
        }

        if (m.role === "assistant") {
            toolUseIdsByName = {};
            const blocks = [];

            if (m.content) {
                blocks.push({ type: "text", text: m.content });
            }

            for (const call of m.tool_calls ?? []) {
                const id = `toolu_${crypto.randomUUID().replace(/-/g, "")}`;
                const name = call.function.name;
                toolUseIdsByName[name] = id;
                blocks.push({
                    type: "tool_use",
                    id,
                    name,
                    input: parseToolInput(call.function.arguments)
                });
            }

            const hasToolUse = blocks.some(b => b.type === "tool_use");
            if (blocks.length === 0) {
                anthropicMessages.push({ role: "assistant", content: "" });
            } else if (hasToolUse) {
                // Anthropic requires array content when tool_use blocks are present
                anthropicMessages.push({ role: "assistant", content: blocks });
            } else if (blocks.length === 1 && blocks[0].type === "text") {
                anthropicMessages.push({ role: "assistant", content: blocks[0].text });
            } else {
                anthropicMessages.push({ role: "assistant", content: blocks });
            }
        }
    }

    flushToolResults();

    return {
        system: systemParts.length ? systemParts.join("\n\n") : undefined,
        messages: anthropicMessages
    };
}

function toOllamaToolCalls(contentBlocks) {
    return contentBlocks
        .filter(c => c.type === "tool_use")
        .map(c => ({
            function: {
                name: c.name,
                arguments: c.input ?? {}
            }
        }));
}

/** Yield Ollama-shaped stream chunks from an Anthropic MessageStream. */
async function* claudeStreamToOllama(anthropicStream) {
    for await (const event of anthropicStream) {
        if (event.type !== "content_block_delta") continue;

        if (event.delta.type === "text_delta") {
            yield { message: { content: event.delta.text } };
        } else if (event.delta.type === "thinking_delta") {
            yield { message: { thinking: event.delta.thinking } };
        }
    }

    const final = await anthropicStream.finalMessage();
    const tool_calls = toOllamaToolCalls(final.content);
    if (tool_calls.length) {
        yield { message: { tool_calls } };
    }
}

async function claudeChat({ messages, tools, stream }) {
    const { system, messages: anthropicMessages } = toAnthropicMessages(messages);
    const params = {
        model: process.env.CLAUDE_MODEL,
        max_tokens: Number(process.env.CLAUDE_MAX_TOKENS) || 4096,
        messages: anthropicMessages,
        tools: toAnthropicTools(tools),
        ...(system ? { system } : {})
    };

    if (stream) {
        const anthropicStream = anthropic.messages.stream(params);
        return claudeStreamToOllama(anthropicStream);
    }

    const response = await anthropic.messages.create(params);
    const text = response.content
        .filter(c => c.type === "text")
        .map(c => c.text)
        .join("");
    const tool_calls = toOllamaToolCalls(response.content);

    return {
        message: {
            role: "assistant",
            content: text,
            ...(tool_calls.length ? { tool_calls } : {})
        }
    };
}

export async function brainChat({ messages, tools, stream }) {
    switch (provider) {
        case "ollama_local":
            return await ollama.chat({
                model: process.env.OLLAMA_MODEL,
                messages,
                tools,
                stream,
                think: process.env.OLLAMA_THINK === "false" ? false : "low"
            });

        case "ollama_remote":
            return await fetch(`${process.env.REMOTE_OLLAMA_URL}/api/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: process.env.REMOTE_OLLAMA_MODEL,
                    messages,
                    tools,
                    stream,
                    think: process.env.REMOTE_OLLAMA_THINK === "false" ? false : "low"
                })
            }).then(r => r.json());

        case "claude":
            return claudeChat({ messages, tools, stream });

        default:
            throw new Error("Unknown brain provider");
    }
}
