import {
    Client,
    GatewayIntentBits,
    ChannelType
} from "discord.js";
import { logThreadMessage } from "./memory/logger.js";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once("clientReady", (c) => {
    console.log(`Logged in as ${c.user.tag}`);
});

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    // -------------------------
    // NEW THREAD (MENTION)
    // -------------------------
    if (
        message.channel.type === ChannelType.GuildText &&
        message.mentions.has(client.user)
    ) {
        const prompt = message.content
            .replace(new RegExp(`<@!?${client.user.id}>`, "g"), "")
            .trim();

        const cleanPrompt = prompt
            .replace(/<@&\d+>/g, "")
            .trim();
        
        let thread;
        
        try {
            thread = await message.startThread({
                name: cleanPrompt.slice(0, 60) || "Jarvis Thread",
                autoArchiveDuration: 1440
            });
        } catch (err) {
            if (err.code === 160004) {
                const active = await message.channel.threads.fetchActive();
                thread = active.threads.find(t => t.id === message.id);
                if (!thread) return;
            } else {
                throw err;
            }
        }
        

        await processThread(thread);

        return;
    }

    // -------------------------
    // THREAD CONTINUATION
    // -------------------------
    if (message.channel.isThread()) {
        await processThread(message.channel);
    }
});

async function processThread(thread) {
    await thread.sendTyping();
    const starterMessage = await thread.fetchStarterMessage();
    const fetched = await thread.messages.fetch({ limit: 100 });

    const history = [
        starterMessage,
        ...fetched.values()
    ]
        .filter(Boolean)
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
        .map((msg) => ({
            role: msg.author.bot ? "assistant" : "user",
            content: msg.content
        }));

    const response = await fetch("http://localhost:3000/chat-json", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            address: "Discord",
            messages: history
        })
    });

    if (!response.ok) {
        const err = await response.text();
        console.error(err);
        await thread.send("Backend error.");
        return;
    }

    const data = await response.json();

    if (data.response?.trim()) {
        const assistant = data.response;
        await thread.send(assistant);
    
        const userMessage = [...history]
            .reverse()
            .find(m => m.role === "user")
            ?.content ?? "";
    
        logThreadMessage(
            thread.id,
            userMessage,
            assistant
        ).catch(console.error);
    }
}

client.login(process.env.DISCORD_TOKEN);