Okay, let's design an MCP server for the Midscene browser extension. The goal is to expose Midscene's browser automation capabilities (like `.aiAction`, `.aiTap`, `.aiQuery`) as MCP tools, allowing an LLM (via an MCP client like Claude Desktop) to control the browser interactively with human oversight.

## Midscene MCP Server - High-Level Design Document

**1. Introduction & Goal**

*   **Goal:** Create a Model Context Protocol (MCP) server that acts as a bridge between an MCP client (like Claude Desktop or a custom application) and the Midscene browser extension's automation capabilities.
*   **Purpose:** Enable Large Language Models (LLMs) to automate browser tasks using Midscene's natural language commands and actions, facilitated by the human-in-the-loop approval mechanism inherent in MCP tool calls.
*   **Target Midscene Integration:** This server will specifically target the **Midscene Chrome Extension's Bridge Mode** (`@midscene/web/bridge-mode`) via its TypeScript SDK.

**2. High-Level Architecture**

```mermaid
graph LR
    subgraph "User's Machine"
        MCPClient[MCP Client (e.g., Claude Desktop)]
        MCPServer[Midscene MCP Server (Node.js Process)]
        MidsceneAgent[Midscene AgentOverChromeBridge Instance]
        Chrome[Chrome Browser with Midscene Extension]

        MCPClient <-- MCP over stdio --> MCPServer
        MCPServer -- Controls --> MidsceneAgent
        MidsceneAgent -- Bridge Protocol --> Chrome
    end

    LLM[LLM Service] <-- API --> MCPClient
```

*   The **MCP Client** (e.g., Claude Desktop) communicates with the **Midscene MCP Server** via a standard MCP transport (likely stdio for local execution).
*   The **Midscene MCP Server** is a standalone process (e.g., Node.js) that runs locally.
*   The Server instantiates and manages an instance of Midscene's `AgentOverChromeBridge`.
*   The `AgentOverChromeBridge` communicates with the **Midscene Chrome Extension** running in the user's browser via the Bridge Mode protocol.
*   The LLM interacts with the MCP Client, which translates LLM requests into MCP tool calls directed at the Midscene MCP Server.

**3. Core Components**

*   **Midscene MCP Server:**
    *   **Language:** TypeScript/Node.js (to easily use the `@midscene/web` SDK).
    *   **Framework:** Use the official `@modelcontextprotocol/sdk` for TypeScript.
    *   **State Management:** The server needs to manage the lifecycle of the `AgentOverChromeBridge` instance (connection status, active tab). It should likely handle only *one active bridge connection at a time*.
    *   **Transport:** stdio is recommended for local server integration with clients like Claude Desktop.
*   **Midscene `AgentOverChromeBridge` Instance:**
    *   Managed internally by the MCP Server process.
    *   Handles the actual communication with the Chrome Extension.
*   **MCP Tools:**
    *   Defined within the server to map directly to the primary methods of the `AgentOverChromeBridge`.
    *   Each tool call from the client will trigger the corresponding Midscene agent method.

**4. MCP Tools Definition**

The server will expose the following Midscene functionalities as MCP tools. Each tool call will require user approval via the MCP client interface.

*(Note: JSON Schemas below are illustrative examples and might need refinement)*

*   **`midscene_connect_current_tab`**
    *   **Description:** Connects the Midscene bridge to the currently active tab in Chrome. Fails if already connected.
    *   **Input Schema:** (Empty object or null)
    *   **Annotations:** `title: "Midscene: Connect to Current Tab"`, `readOnlyHint: false` (as it changes connection state)
    *   **Maps to:** `agent.connectCurrentTab()`
*   **`midscene_connect_new_tab`**
    *   **Description:** Opens a new tab with the specified URL and connects the Midscene bridge. Fails if already connected.
    *   **Input Schema:**
        ```json
        {
          "type": "object",
          "properties": {
            "url": { "type": "string", "description": "The URL to open in the new tab." }
          },
          "required": ["url"]
        }
        ```
    *   **Annotations:** `title: "Midscene: Connect to New Tab"`, `readOnlyHint: false`
    *   **Maps to:** `agent.connectNewTabWithUrl(url)`
*   **`midscene_disconnect`**
    *   **Description:** Disconnects the Midscene bridge from the controlled Chrome tab.
    *   **Input Schema:** (Empty object or null)
    *   **Annotations:** `title: "Midscene: Disconnect"`, `readOnlyHint: false`
    *   **Maps to:** `agent.destroy()`
*   **`midscene_ai_action`** (Corresponds to `.ai()` or `.aiAction()`)
    *   **Description:** Performs a series of UI actions described in natural language. Midscene automatically plans and executes steps. Requires an active connection.
    *   **Input Schema:**
        ```json
        {
          "type": "object",
          "properties": {
            "prompt": { "type": "string", "description": "Natural language description of UI steps (e.g., 'Type \\\"JavaScript\\\" into search box, click search button')." }
          },
          "required": ["prompt"]
        }
        ```
    *   **Annotations:** `title: "Midscene: AI Action"`, `readOnlyHint: false`, `destructiveHint: true`
    *   **Maps to:** `agent.aiAction(prompt)`
*   **`midscene_ai_tap`**
    *   **Description:** Clicks or taps an element described in natural language. Requires an active connection.
    *   **Input Schema:**
        ```json
        {
          "type": "object",
          "properties": {
            "locate": { "type": "string", "description": "Natural language description of the element to tap (e.g., 'The login button')." },
            "deepThink": { "type": "boolean", "description": "Use deepThink for more precise location (optional).", "default": false }
          },
          "required": ["locate"]
        }
        ```
    *   **Annotations:** `title: "Midscene: AI Tap"`, `readOnlyHint: false`
    *   **Maps to:** `agent.aiTap(locate, { deepThink })`
*   **`midscene_ai_input`**
    *   **Description:** Inputs text into an element described in natural language. Use empty text to clear. Requires an active connection.
    *   **Input Schema:**
        ```json
        {
          "type": "object",
          "properties": {
            "text": { "type": "string", "description": "The text to input. Use empty string to clear." },
            "locate": { "type": "string", "description": "Natural language description of the input element (e.g., 'The search input box')." },
            "deepThink": { "type": "boolean", "description": "Use deepThink for more precise location (optional).", "default": false }
          },
          "required": ["text", "locate"]
        }
        ```
    *   **Annotations:** `title: "Midscene: AI Input"`, `readOnlyHint: false`
    *   **Maps to:** `agent.aiInput(text, locate, { deepThink })`
*   **`midscene_ai_hover`**
    *   **Description:** Moves the mouse cursor over an element described in natural language. Requires an active connection.
    *   **Input Schema:** (Similar to `aiTap`)
        ```json
        {
          "type": "object",
          "properties": {
            "locate": { "type": "string", "description": "Natural language description of the element to hover over." },
            "deepThink": { "type": "boolean", "description": "Use deepThink for more precise location (optional).", "default": false }
          },
          "required": ["locate"]
        }
        ```
    *   **Annotations:** `title: "Midscene: AI Hover"`, `readOnlyHint: false`
    *   **Maps to:** `agent.aiHover(locate, { deepThink })`
*   **`midscene_ai_keyboard_press`**
    *   **Description:** Presses a specific keyboard key (e.g., 'Enter', 'Tab'). Optionally targets an element. Requires an active connection.
    *   **Input Schema:**
        ```json
        {
          "type": "object",
          "properties": {
            "key": { "type": "string", "description": "The web key to press (e.g., 'Enter', 'Tab', 'Escape'). No combinations." },
            "locate": { "type": "string", "description": "Natural language description of the target element (optional)." },
            "deepThink": { "type": "boolean", "description": "Use deepThink for more precise location if locate is provided (optional).", "default": false }
          },
          "required": ["key"]
        }
        ```
    *   **Annotations:** `title: "Midscene: AI Keyboard Press"`, `readOnlyHint: false`
    *   **Maps to:** `agent.aiKeyboardPress(key, locate, { deepThink })`
*   **`midscene_ai_scroll`**
    *   **Description:** Scrolls the page or a specific element. Requires an active connection.
    *   **Input Schema:**
        ```json
        {
          "type": "object",
          "properties": {
            "direction": { "type": "string", "enum": ["up", "down", "left", "right"], "description": "Direction to scroll." },
            "scrollType": { "type": "string", "enum": ["once", "untilBottom", "untilTop", "untilLeft", "untilRight"], "description": "Type of scroll (optional).", "default": "once" },
            "distance": { "type": "number", "description": "Distance in pixels (optional, for 'once' type)." },
            "locate": { "type": "string", "description": "Natural language description of the element to scroll, or scroll globally if omitted (optional)." },
            "deepThink": { "type": "boolean", "description": "Use deepThink for more precise location if locate is provided (optional).", "default": false }
          },
          "required": ["direction"]
        }
        ```
    *   **Annotations:** `title: "Midscene: AI Scroll"`, `readOnlyHint: false`
    *   **Maps to:** `agent.aiScroll({ direction, scrollType, distance }, locate, { deepThink })`
*   **`midscene_ai_query`**
    *   **Description:** Extracts structured data (string, number, JSON, array) from the UI based on a natural language query and format description. Requires an active connection.
    *   **Input Schema:**
        ```json
        {
          "type": "object",
          "properties": {
            "dataShape": { "type": "string", "description": "Natural language description of the data and expected format (e.g., 'string[], list of task names', '{name: string, age: number}[], table data records')." }
          },
          "required": ["dataShape"]
        }
        ```
    *   **Annotations:** `title: "Midscene: AI Query"`, `readOnlyHint: true`
    *   **Maps to:** `agent.aiQuery(dataShape)`
    *   **Output:** The result will be returned as text content, JSON-stringified. The client might need to parse it.
*   **`midscene_ai_assert`**
    *   **Description:** Asserts a condition described in natural language is true on the page. Throws an error if false. Requires an active connection.
    *   **Input Schema:** (Similar to `aiAction`)
        ```json
        {
          "type": "object",
          "properties": {
            "assertion": { "type": "string", "description": "Natural language description of the assertion (e.g., 'The price of Sauce Labs Onesie is 7.99')." },
             "errorMsg": { "type": "string", "description": "Optional custom error message prefix if assertion fails."}
          },
          "required": ["assertion"]
        }
        ```
    *   **Annotations:** `title: "Midscene: AI Assert"`, `readOnlyHint: true` (doesn't change page state directly)
    *   **Maps to:** `agent.aiAssert(assertion, errorMsg)`
*   **`midscene_ai_wait_for`**
    *   **Description:** Waits until a condition described in natural language becomes true. Requires an active connection.
    *   **Input Schema:**
        ```json
        {
          "type": "object",
          "properties": {
            "assertion": { "type": "string", "description": "Natural language description of the condition to wait for." },
            "timeoutMs": { "type": "number", "description": "Maximum time to wait in milliseconds (optional, default 15000)." },
            "checkIntervalMs": { "type": "number", "description": "How often to check in milliseconds (optional, default 3000)." }
          },
          "required": ["assertion"]
        }
        ```
    *   **Annotations:** `title: "Midscene: AI Wait For"`, `readOnlyHint: true` (doesn't change page state directly)
    *   **Maps to:** `agent.aiWaitFor(assertion, { timeoutMs, checkIntervalMs })`
*   **`midscene_evaluate_javascript`**
    *   **Description:** Evaluates a JavaScript expression in the web page context. Requires an active connection.
    *   **Input Schema:**
        ```json
        {
          "type": "object",
          "properties": {
            "script": { "type": "string", "description": "The JavaScript expression to evaluate (e.g., 'document.title')." }
          },
          "required": ["script"]
        }
        ```
    *   **Annotations:** `title: "Midscene: Evaluate JavaScript"`, `readOnlyHint: true`
    *   **Maps to:** `agent.evaluateJavaScript(script)`
    *   **Output:** The result will be returned as text content, JSON-stringified.

**5. Connection Management**

*   The server must manage the state of the Midscene connection.
*   Tools like `midscene_ai_action`, `midscene_ai_tap`, etc., should check if a connection is active before proceeding and return an error if not connected.
*   The `midscene_connect_*` tools should likely fail if a connection is already active. Alternatively, they could implicitly call `disconnect` first. Explicit disconnect via `midscene_disconnect` is safer.
*   The user needs to manually enable "Allow Connection" in the Midscene Chrome Extension for the bridge to work. The server cannot do this programmatically. The `connect` tools will likely time out or fail if this isn't done.

**6. Transport**

*   Use the **stdio** transport for seamless integration with local clients like Claude Desktop.
*   Messages (tool calls, results) will be exchanged over stdin/stdout between the client and the Midscene MCP Server process.

**7. Error Handling**

*   The MCP server should catch errors thrown by the `AgentOverChromeBridge` methods (e.g., connection failures, element not found, assertion failures, timeouts).
*   These errors should be translated into MCP tool error responses (`isError: true`) with informative messages in the `content` field.
*   Connection state errors (e.g., trying to run `aiAction` before `connect`) should also be handled gracefully.

**8. Security Considerations**

*   **Execution Context:** The MCP server runs locally with the user's privileges. The Midscene extension interacts with the browser based on its own permissions.
*   **Tool Approval:** The primary security mechanism is the MCP client's human-in-the-loop approval for *every tool call*. The user sees the tool name and arguments before approving.
*   **Scope:** The server, via Midscene, can potentially interact with any website the user navigates to while the bridge is connected. Access is limited to what the Midscene agent can do (interacting with the DOM, navigation, etc.). It cannot access arbitrary local files unless a tool specifically implements that (which these Midscene tools do not).
*   **Trust:** The user must trust the Midscene MCP Server code itself, as it orchestrates the browser actions.
*   **Midscene Extension:** The user must have the Midscene extension installed and configured (e.g., API keys for the underlying AI model used by Midscene). The MCP server *does not* handle Midscene's own AI model configuration.

**9. User Experience**

*   The user initiates actions by prompting the LLM in the MCP client.
*   The LLM decides which Midscene MCP tool(s) to call.
*   The MCP client presents the tool call (e.g., `midscene_ai_tap` with `locate="Login button"`) to the user for approval.
*   Upon approval, the MCP server executes the action via the Midscene bridge.
*   Results or errors are returned to the client and potentially shown to the user or used by the LLM for subsequent steps.
*   The user needs to remember to click "Allow Connection" in the Midscene extension UI *before* the server attempts to connect using the `midscene_connect_*` tools.

**10. Implementation Plan**

1.  Set up a Node.js/TypeScript project.
2.  Add dependencies: `@modelcontextprotocol/sdk`, `@midscene/web`.
3.  Implement the basic MCP server structure using `@modelcontextprotocol/sdk` and stdio transport.
4.  Add state management for the `AgentOverChromeBridge` instance (create, connect, disconnect, check status).
5.  Implement the `midscene_connect_*` and `midscene_disconnect` tool handlers.
6.  Implement handlers for each Midscene action/query/assert tool, ensuring they:
    *   Check for an active connection.
    *   Parse arguments correctly.
    *   Call the corresponding `AgentOverChromeBridge` method.
    *   Handle promises/async operations.
    *   Catch errors and format them as MCP error results.
    *   Format successful results correctly (often just an empty result, or text content for `aiQuery`/`evaluateJavaScript`).
7.  Define `inputSchema` and `annotations` for all tools.
8.  Add logging within the server for easier debugging.
9.  Build the TypeScript code.
10. Test incrementally using the MCP Inspector.
11. Configure and test with Claude Desktop.

**11. Future Considerations**

*   **Resources:** Expose browser state (e.g., current URL, page title) as MCP resources.
*   **Prompts:** Define common Midscene workflows (e.g., "Login to X site") as MCP prompts.
*   **Multiple Connections:** Potentially manage multiple bridge connections (more complex).
*   **Configuration:** Allow configuration (e.g., default timeouts) via environment variables or a config file.

This design provides a solid foundation for integrating Midscene's browser automation capabilities into the MCP ecosystem, enabling powerful LLM-driven web interactions with user oversight.
