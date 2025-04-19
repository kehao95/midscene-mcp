# Midscene MCP Server

## Introduction

This project implements a Model Context Protocol (MCP) server that acts as a bridge to the Midscene browser extension (`@midscene/web/bridge-mode`). It allows Large Language Models (LLMs), via MCP clients like Claude Desktop, to interactively control a Chrome browser session using Midscene's natural language automation capabilities (e.g., `aiAction`, `aiTap`, `aiQuery`).

The server exposes Midscene functions as MCP tools, enabling LLMs to perform browser tasks with human-in-the-loop oversight provided by the MCP client.

## Features

*   Connects to the Midscene Chrome Extension via Bridge Mode.
*   Exposes core Midscene functionalities as MCP tools:
    *   Connecting/Disconnecting to current or new tabs.
    *   Natural language actions (`aiAction`, `aiTap`, `aiInput`, `aiHover`, `aiKeyboardPress`, `aiScroll`).
    *   Data extraction (`aiQuery`).
    *   Assertions and waits (`aiAssert`, `aiWaitFor`).
    *   Executing YAML scripts (`runYaml`).
    *   Evaluating JavaScript (`evaluateJavaScript`).
*   Communicates over stdio, suitable for local MCP clients.
*   Built with TypeScript and the official `@modelcontextprotocol/sdk`.

## Prerequisites

*   Node.js (v18 or later recommended)
*   npm or yarn
*   Google Chrome browser
*   [Midscene Chrome Extension](https://www.midscene.com/) installed and configured (including API keys for its underlying AI models).

## Setup

1.  Clone the repository:
    ```bash
    git clone <your-repo-url>
    cd midscene-mcp
    ```
2.  Install dependencies:
    ```bash
    npm install
    # or
    yarn install
    ```

## Building

Compile the TypeScript code to JavaScript:

```bash
npm run build
# or
yarn build
```

This will generate the output in the `dist/` directory.

## Running the Server

1.  **Enable Midscene Connection:** Open the Midscene Chrome Extension and ensure "Allow Connection" is enabled for Bridge Mode.
2.  Follow the [Choose a model](https://midscenejs.com/choose-a-model.html) to set/expose related env vars.
3.  Run the compiled server:
    ```bash
    node dist/server.js
    ```

The server will start and listen for MCP messages on stdin/stdout.

## Usage with MCP Clients

This server is designed to be used with an MCP client application (e.g., Claude Desktop, MCP Inspector).

1.  Configure your MCP client to use a local executable.
2.  Point the client to the `node dist/server.js` command (or create a wrapper script if needed).
3.  The client will launch the server process and communicate with it over stdio.
4.  You can then use the LLM within the client to invoke the `midscene_*` tools, which will be presented for approval before executing actions in your browser via the Midscene extension.

Refer to your specific MCP client's documentation for instructions on connecting to a local MCP server executable. 
