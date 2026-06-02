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
            description: "Inspect the current webpage. Returns page title, URL, visible text, inputs, and clickable elements with IDs.",
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
    }
];