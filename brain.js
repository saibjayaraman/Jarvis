import crypto from "crypto";
import { Ollama } from "ollama";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

const anthropic = process.env.CLAUDE_API_KEY ? new Anthropic({
    apiKey: process.env.CLAUDE_API_KEY
}) : undefined;

const ollama_local = process.env.OLLAMA_URL? new Ollama({
    host: process.env.OLLAMA_URL
}) : undefined;

const ollama_remote = process.env.REMOTE_OLLAMA_URL ? new Ollama({
    host: process.env.REMOTE_OLLAMA_URL
}) : undefined;

const openai1 = process.env.OPENAI_URL ? new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_URL
}) : undefined;

const openai2 = process.env.OPENAI2_URL ? new OpenAI({
    apiKey: process.env.OPENAI2_API_KEY,
    baseURL: process.env.OPENAI2_URL
}) : undefined;

function parseToolInput(args) {
    if (args == null) return {};
    return typeof args === "string" ? JSON.parse(args) : args;
}

function toOpenAITools(tools = []) {
    return tools
        .filter(Boolean)
        .map(t => {
            const fn = t.function ?? t;

            const parameters = fn.parameters ?? {
                type: "object",
                properties: {}
            };

            return {
                type: "function",
                function: {
                    name: fn.name,
                    description: fn.description ?? "",
                    parameters: {
                        ...parameters,
                        type: "object",
                        properties: parameters.properties ?? {},
                        required: parameters.required ?? [],
                        additionalProperties:
                            parameters.additionalProperties ?? false
                    },
                    // DeepInfra / OpenAI compatible optional strict mode
                    strict: fn.strict ?? false
                }
            };
        });
}

function toOpenAIToolCalls(toolCalls = []) {
    return toolCalls.map(call => ({
        id: call.id,
        type: "function",
        function: {
            name: call.function.name,
            arguments:
                typeof call.function.arguments === "string"
                    ? call.function.arguments
                    : JSON.stringify(call.function.arguments ?? {})
        }
    }));
}

function toOpenAIMessages(messages) {
    const out = [];
    let toolCallIdsByName = {};
    let toolCallQueue = [];

    for (const m of messages) {
        if (m.role === "assistant" && m.tool_calls?.length) {
            const tool_calls = m.tool_calls.map(call => ({
                id: call.id || `call_${crypto.randomUUID().replace(/-/g, "")}`,
                type: "function",
                function: {
                    name: call.function.name,
                    arguments:
                        typeof call.function.arguments === "string"
                            ? call.function.arguments
                            : JSON.stringify(call.function.arguments ?? {})
                }
            }));
            toolCallIdsByName = {};
            toolCallQueue = [];
            for (const tc of tool_calls) {
                toolCallIdsByName[tc.function.name] = tc.id;
                toolCallQueue.push(tc.id);
            }
            out.push({
                role: "assistant",
                content: m.content ?? "",
                tool_calls
            });
            continue;
        }

        if (m.role === "tool") {
            const id =
                m.tool_call_id ??
                toolCallIdsByName[m.tool_name] ??
                toolCallQueue.shift();
            out.push({
                role: "tool",
                tool_call_id: id,
                content: typeof m.content === "string"
                    ? m.content
                    : JSON.stringify(m.content)
            });
            continue;
        }

        out.push(m);
    }

    return out;
}

function toAnthropicTools(tools = []) {
    return tools
        .filter(Boolean)
        .map(t => {
            const fn = t.function ?? t;

            return {
                name: fn.name,
                description: fn.description,
                input_schema: fn.parameters
            };
        });
}

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

async function openAIChat(
    client,
    { messages, tools, stream },
    model
) {
    if (!client) {
        throw new Error("The OpenAI Client URL is not Specified, or Doesn't Exist")
    }

    const params = {
        model,
        messages: toOpenAIMessages(messages),
        tools: toOpenAITools(tools),
        tool_choice: process.env.OPENAI_TOOLS
    };

    if (stream) {
        const openaiStream = await client.chat.completions.create({
            ...params,
            stream: true
        });

        return (async function* () {
            const accumulated = [];
            for await (const chunk of openaiStream) {
                const delta = chunk.choices?.[0]?.delta;

                if (delta?.content) {
                    yield {
                        message: {
                            content: delta.content
                        }
                    };
                }

                if (delta?.tool_calls) {
                    for (const tc of delta.tool_calls) {
                        const idx = tc.index ?? 0;
                        if (!accumulated[idx]) {
                            accumulated[idx] = {
                                id: "",
                                function: { name: "", arguments: "" }
                            };
                        }
                        const slot = accumulated[idx];
                        if (tc.id) slot.id = tc.id;
                        if (tc.function?.name) slot.function.name += tc.function.name;
                        if (tc.function?.arguments) slot.function.arguments += tc.function.arguments;
                    }
                }
            }

            if (accumulated.length) {
                yield {
                    message: {
                        tool_calls: accumulated.filter(Boolean)
                    }
                };
            }
        })();
    }
    console.log("===== OUTGOING MESSAGES =====");
    console.dir(messages, { depth: null });
    console.log("=============================");

    console.log(
        JSON.stringify(params.messages, null, 2)
    );

    const response = await client.chat.completions.create(params);

    const message = response.choices[0].message;

    return {
        message: {
            role: "assistant",
            content: message.content ?? "",
            ...(message.tool_calls?.length
                ? {
                    tool_calls: toOpenAIToolCalls(
                        message.tool_calls
                    )
                }
                : {})
        }
    };
}

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

async function claudeChat({ messages, tools, stream }, model = process.env.CLAUDE_MODEL) {
    const { system, messages: anthropicMessages } = toAnthropicMessages(messages);
    const params = {
        model: model ? model : process.env.CLAUDE_MODEL,
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

export async function brainChat({ messages, tools, stream }, provider = process.env.BRAIN_PROVIDER, model = undefined, think = false) {
    switch (provider) {
        case "ollama_local":
            return await ollama_local.chat({
                model: model ? model : process.env.OLLAMA_MODEL,
                messages,
                tools,
                stream,
                think: think ? think : (process.env.OLLAMA_THINK === "false" ? false : "low")
            });

        case "ollama_remote":
            return await ollama_remote.chat({
                model: model ? model : process.env.REMOTE_OLLAMA_MODEL,
                messages,
                tools,
                stream,
                think: think ? think : (process.env.REMOTE_OLLAMA_THINK === "false" ? false : "low")
            });

        case "claude":
            return claudeChat({ messages, tools, stream }, model);

        case "openai1":
            return openAIChat(
                openai1,
                { messages, tools, stream },
                model ?? process.env.OPENAI_MODEL
            );
        
        case "openai2":
            return openAIChat(
                openai2,
                { messages, tools, stream },
                model ?? process.env.OPENAI2_MODEL
            );

        default:
            throw new Error("Unknown brain provider");
    }
}
