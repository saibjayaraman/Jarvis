import { chromium } from "playwright";
import { searchMemory } from "./memory.js";

function parseArgs(args) {
    return typeof args === "string" ? JSON.parse(args) : args;
}

export async function runTool(name, args) {
    const parsed = parseArgs(args);

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
        case "screenshot":
            return await screenshot();
        case "search_memory":
            return await memorySearch(parsed);
        case "sleep":
            return await sleep(
                parsed.seconds,
                parsed.message
            );
        default:
            return {
                success: false,
                error: "Unknown tool: " + name
            };
    }
}

export const tools = [
    {
        type: "function",
        function: {
            name: "navigate",
            description: "Navigate to a URL",
            parameters: {
                type: "object",
                properties: {
                    url: {
                        type: "string",
                        description: "The URL to navigate to"
                    }
                }
            }
        }
    },
    {
        type: "function",
        function: {
            name: "clickText",
            description: "Click a button, link, or element by visible text.",
            parameters: {
                type: "object",
                properties: {
                    text: {
                        type: "string"
                    }
                },
                required: ["text"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "clickElement",
            description: "Click an element previously returned by observePage using its element id.",
            parameters: {
                type: "object",
                properties: {
                    id: {
                        type: "number"
                    }
                },
                required: ["id"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "type",
            description: "Type into a selector",
            parameters: {
                type: "object",
                properties: {
                    selector: {
                        type: "string",
                        description: "The selector to type into"
                    },
                    text: {
                        type: "string",
                        description: "The text to type into the selector"
                    }
                }
            }
        }
    },
    {
        type: "function",
        function: {
            name: "observePage",
            description: "Inspect the current webpage. Returns page title, URL, visible text, inputs, and clickable elements with IDs. USE observatory UNLESS observePage IS SPECIFICALLY NECESSARY",
            parameters: {
                type: "object",
                properties: {}
            }
        }
    },
    {
        type: "function",
        function: {
            name: "newTab",
            description: "Open a new browser tab.",
            parameters: {
                type: "object",
                properties: {
                    url: {
                        type: "string"
                    }
                }
            }
        }
    },
    {
        type: "function",
        function: {
            name: "observatory",
            description: "Inspect the current webpage. Returns visible text, links, and interactive elements. The model may request limits for text, links, and elements, but hard caps apply.",
            parameters: {
                type: "object",
                properties: {
                    maxTextChars: {
                        type: "number",
                        description: "Maximum number of visible text characters to return (max 2000)"
                    },
                    maxLinks: {
                        type: "number",
                        description: "Maximum number of links to return (max 50)"
                    },
                    maxElements: {
                        type: "number",
                        description: "Maximum number of interactive elements to return (0 = unlimited)"
                    }
                }
            }
        }
    },
    {
        type: "function",
        function: {
            name: "clicker",
            description: "Click an element returned by Observatory using its ID.",
            parameters: {
                type: "object",
                properties: {
                    id: {
                        type: "number"
                    }
                },
                required: ["id"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "typist",
            description: "Type text into an input element.",
            parameters: {
                type: "object",
                properties: {
                    id: {
                        type: "number"
                    },
                    text: {
                        type: "string"
                    }
                },
                required: [
                    "id",
                    "text"
                ]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "switchTab",
            description: "Switch to a different browser tab by index.",
            parameters: {
                type: "object",
                properties: {
                    index: {
                        type: "number"
                    }
                },
                required: ["index"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "closeTab",
            description: "Close a browser tab by index.",
            parameters: {
                type: "object",
                properties: {
                    index: {
                        type: "number"
                    }
                },
                required: ["index"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "listTabs",
            description: "List all open tabs with their index and URL.",
            parameters: {
                type: "object",
                properties: {}
            }
        }
    },
    {
        type: "function",
        function: {
            name: "screenshot",
            description: "Capture the current browser tab as an image.",
            parameters: {
                type: "object",
                properties: {
                    fullPage: {
                        type: "boolean"
                    }
                }
            }
        }
    },
    {
        name: "search_memory",
        description: "Search long-term memory (previous chats, people, journal). Use multiple queries for better recall.",
        parameters: {
            type: "object",
            properties: {
                queries: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of search queries. Use good queries for a vector search, but mostly target BM25 results."
                }
            },
            required: ["queries"]
        }
    },
    {
        name: "wait_for",
        description: "Pause the task until a future time or condition. Use for long running processes to send a status report to the user and then set a time to check back. Max 30 seconds",
        parameters: {
          type: "object",
          properties: {
            seconds: {
              type: "number"
            },
            message: {
              type: "string"
            }
          },
          required: ["seconds", "message"]
        }
      }
];

const browser = await chromium.launch({
    headless: true
});

let currentElements = [];
let pages = [];
let currentPageIndex = 0;
let clipboard = "";

export function getCurrentPage() {
    return pages[currentPageIndex];
}

export async function newTab(url = "about:blank") {
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

export async function switchTab(index) {
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
export async function closeTab(index) {
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
export async function listTabs() {
    return pages.map((page, index) => ({
        index,
        url: page.url()
    }));
}
export async function navigate(url) {
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
export async function clickSelector(selector) {
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
export async function clickElement(id) {
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
export async function clickText(text) {
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
export async function type(selector, text) {
    const page = getCurrentPage()
    
    await page.fill(selector, text);
    return `Typed into ${selector}`;
}
export async function extractText(selector) {
    const page = getCurrentPage()
    
    const items = await page.locator(selector).allTextContents();
    return items;
}
export async function observePage() {
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
export async function copyText(text) {
    clipboard = text;
    return {
        success: true
    };
}
export async function getClipboard() {
    return {
        text: clipboard
    };
}
export async function pasteIntoElement(id) {
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
export async function observatory(args = {}) {
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
export async function clicker(id) {
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
export async function typist(id, text) {
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
async function screenshot({ fullPage = false } = {}) {
    const path = `./screenshots/${Date.now()}.png`;

    await page.screenshot({
        path,
        fullPage
    });

    return {
        type: "image",
        path
    };
}
async function memorySearch(args) {

    const queries = Array.isArray(args?.queries)
        ? args.queries
        : [];

    if (!queries.length) {
        console.log("[MEMORY TOOL] no queries provided");
        return "";
    }

    try {
        const results = await Promise.all(
            queries.map(query => searchMemory(query))
        );

        const combined = results
            .filter(Boolean)
            .join("\n\n");

        return combined;
    } catch (err) {
        console.error(
            "[MEMORY TOOL] search failed:",
            err
        );

        return "";
    }
}
export async function sleep(seconds, message) {
    const safeSeconds = seconds >= 30 ? 30 : seconds
    return {
        sleep: true,
        safeSeconds,
        message
    };
}