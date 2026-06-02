import "dotenv/config";
import express from "express";
import { chromium } from "playwright";
import { readFileSync } from "fs";
import { brainChat } from "./brain.js";
import { tools } from "./tools.js"

function currentDate(date = new Date()) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
  
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  }

const browser = await chromium.launch({
    headless: true
});

let currentElements = [];
let pages = [];
let currentPageIndex = 0;
let clipboard = "";

function getCurrentPage() {
    return pages[currentPageIndex];
}

async function newTab(url = "about:blank") {
    const page = await browser.newPage();
    pages.push(page);
    currentPageIndex = pages.length - 1;
    if (url) {
        await page.goto(url);
    }
    return {
        success: true,
        index: currentPageIndex,
        url
    };
}
newTab()
async function switchTab(index) {
    if (!pages[index]) {
        return {
            success: false,
            error: "Tab does not exist"
        };
    }
    currentPageIndex = index;
    return {
        success: true
    };
}
async function closeTab(index) {
    if (!pages[index]) {
        return {
            success: false
        };
    }
    await pages[index].close();
    pages.splice(index, 1);
    if (currentPageIndex >= pages.length) {
        currentPageIndex = pages.length - 1;
    }
    return {
        success: true
    };
}
async function listTabs() {
    return pages.map((page, index) => ({
        index,
        url: page.url()
    }));
}
async function navigate(url) {
    const start = performance.now();
    const page = getCurrentPage();
    await page.goto(url, {
        waitUntil: "domcontentloaded"
    });
    const end = performance.now();
    return {
        success: true,
        loadTimeMs: end - start
    };
}
async function clickSelector(selector) {
    const page = getCurrentPage()

    try {
        await page.locator(selector).first().click();
        return {
            success: true
        };
    } catch (err) {
        return {
            success: false,
            error: err.message
        };
    }
}
async function clickElement(id) {
    const page = getCurrentPage()
    
    try {
        const element = currentElements.find(
            e => e.id === id
        );
        if (!element) {
            return {
                success: false,
                error: "Element not found"
            };
        }
        await page
            .getByText(element.text)
            .first()
            .click();
        return {
            success: true
        };
    } catch (err) {
        return {
            success: false,
            error: err.message
        };
    }
}
async function clickText(text) {
    const page = getCurrentPage()
    
    try {
        await page.getByText(text, {
            exact: false
        }).first().click();

        return {
            success: true
        };
    } catch (err) {
        return {
            success: false,
            error: err.message
        };
    }
}
async function type(selector, text) {
    const page = getCurrentPage()
    
    await page.fill(selector, text);
    return `Typed into ${selector}`;
}
async function extractText(selector) {
    const page = getCurrentPage()
    
    const items = await page.locator(selector).allTextContents();
    return items;
}
async function observePage() {
    const page = getCurrentPage()
    
    const title = await page.title();
    const url = page.url();

    currentElements = [];

    let id = 1;

    // Links
    const links = await page.locator("a").evaluateAll(nodes =>
        nodes
            .slice(0, 50)
            .map(node => ({
                text: node.innerText?.trim(),
                href: node.href
            }))
            .filter(x => x.text)
    );

    for (const link of links) {
        currentElements.push({
            id: id++,
            type: "link",
            text: link.text
        });
    }
    // Buttons
    const buttons = await page.locator("button").allTextContents();
    for (const text of buttons) {
        if (!text.trim()) continue;
        currentElements.push({
            id: id++,
            type: "button",
            text: text.trim()
        });
    }
    // Inputs
    const inputs = await page.locator("input").evaluateAll(nodes =>
        nodes.slice(0, 20).map(node => ({
            placeholder: node.placeholder || "",
            type: node.type || "text"
        }))
    );
    // Visible text sample
    const visibleText = (
        await page.locator("body").innerText()
    )
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 2000);
    return {
        title,
        url,
        visibleText,
        inputs,
        elements: currentElements
    };
}
async function copyText(text) {
    clipboard = text;
    return {
        success: true
    };
}
async function getClipboard() {
    return {
        text: clipboard
    };
}
async function pasteIntoElement(id) {
    const element = currentElements.find(
        e => e.id === id
    );
    if (!element) {
        return {
            success: false
        };
    }
    await getCurrentPage()
        .getByText(element.text)
        .fill(clipboard);
    return {
        success: true
    };
}
async function observatory(args = {}) {
    const {
        maxTextChars = 800,
        maxLinks = 20,
        maxElements = 50
    } = args;
    const page = getCurrentPage();
    currentElements = [];
    let id = 1;
    // LINKS
    const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("a"))
            .map(a => ({
                text: (a.innerText || "").trim(),
                href: a.href || ""
            }))
            .filter(x => x.text);
    });
    const limitedLinks = links.slice(0, maxLinks);
    for (const link of limitedLinks) {
        currentElements.push({
            id: id++,
            type: "link",
            text: link.text
        });
    }
    // BUTTONS + INPUTS (elements)
    const elements = await page.evaluate(() => {
        const els = document.querySelectorAll(
            "button, input, textarea, select"
        );
        return Array.from(els).map(el => ({
            tag: el.tagName,
            text:
                el.innerText ||
                el.value ||
                el.placeholder ||
                "",
            placeholder: el.placeholder || ""
        }));
    });
    const limitedElements = elements.slice(0, maxElements || elements.length);
    for (const el of limitedElements) {
        if (!el.text?.trim()) continue;
        currentElements.push({
            id: id++,
            type: el.tag.toLowerCase(),
            text: el.text.trim()
        });
    }
    // VISUAL TEXT
    const rawText = await page.locator("body").innerText();
    const visibleText = rawText
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, Math.min(maxTextChars, 2000));
    return {
        url: page.url(),
        title: await page.title(),
        visibleText,
        elements: currentElements
    };
}
async function clicker(id) {
    const target =
        currentElements.find(
            e => e.id === id
        );
    if (!target) {
        return {
            success: false
        };
    }
    const page = getCurrentPage();
    await page
        .getByText(target.text)
        .first()
        .click();
    return {
        success: true
    };
}
async function typist(id, text) {
    const page = getCurrentPage();
    const inputs =
        page.locator(
            "input, textarea"
        );
    const input =
        inputs.nth(id - 1);
    await input.fill(text);
    return {
        success: true
    };
}

const app = express();

const MODEL = "qwen3:8b";
const systemraw = readFileSync("./system.txt", {encoding: "utf8"})
const system = systemraw.replaceAll("<name>", process.env.USER_NAME)
const chatHistory = [{
    role: "system",
    content: system
}];

function parseArgs(args) {
    return typeof args === "string" ? JSON.parse(args) : args;
}

function sendEvent(res, data) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function runTool(name, args) {
    const parsed = parseArgs(args);
    console.log(name, args)

    switch (name) {
        // navigation
        case "navigate":
            return await navigate(parsed.url);

        // core interaction
        case "observePage":
            return await observePage();
        case "clickSelector":
            return await clickSelector(parsed.selector);
        case "clickText":
            return await clickText(parsed.text);
        case "clickElement":
            return await clickElement(parsed.id);
        case "type":
            return await type(
                parsed.selector,
                parsed.text
            );
        case "extractText":
            return await extractText(parsed.selector);

        // tabs
        case "newTab":
            return await newTab(parsed.url);
        case "switchTab":
            return await switchTab(parsed.index);
        case "closeTab":
            return await closeTab(parsed.index);
        case "listTabs":
            return await listTabs();

        // clipboard
        case "copyText":
            return await copyText(parsed.text);
        case "getClipboard":
            return await getClipboard()
        case "pasteIntoElement":
            return await pasteIntoElement(parsed.id);

        // observatory system
        case "observatory":
            return await observatory(parsed);
        case "clicker":
            return await clicker(parsed.id);
        case "typist":
            return await typist(parsed.id, parsed.text);
        default:
            return {
                success: false,
                error: "Unknown tool: " + name
            };
    }
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

const MAX_TOOL_ROUNDS = 10;

async function chatWithTools(res, messages) {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
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
app.use(express.static("public"));

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
tab: ${currentPageIndex}/${pages.length}
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

app.listen(3000, () => {
    console.log("http://localhost:3000");
});