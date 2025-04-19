import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { AgentOverChromeBridge } from "@midscene/web/bridge-mode";

async function main() {
  const server = new McpServer({ name: "midscene-mcp-server", version: "0.1.0" });
  let agent: AgentOverChromeBridge | undefined;

  const ensureAgent = (): AgentOverChromeBridge => {
    if (!agent) {
      throw new Error("Midscene bridge not connected. Please run a connect tool first.");
    }
    return agent;
  };

  // Wrapper to catch errors and return MCP error responses
  const wrap = (fn: (args: any) => Promise<any>) =>
    async (args: any) => {
      try {
        return await fn(args);
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: String(err.message) }]
        };
      }
    };

  // Connect to current active tab
  server.tool(
    "midscene_connect_current_tab",
    "Connect to the current active browser tab",
    {},
    wrap(async () => {
      if (agent) throw new Error("Already connected to a tab.");
      agent = new AgentOverChromeBridge();
      await agent.connectCurrentTab();
      return { content: [{ type: "text", text: "Connected to current tab." }] };
    })
  );

  // Open new tab and connect
  server.tool(
    "midscene_connect_new_tab",
    "Open a new browser tab and connect to it",
    { url: z.string() },
    wrap(async ({ url }) => {
      if (agent) throw new Error("Already connected to a tab.");
      agent = new AgentOverChromeBridge();
      await agent.connectNewTabWithUrl(url);
      return { content: [{ type: "text", text: `Opened and connected to new tab: ${url}` }] };
    })
  );

  // Disconnect
  server.tool(
    "midscene_disconnect",
    "Disconnect from the browser tab",
    {},
    wrap(async () => {
      await ensureAgent().destroy();
      agent = undefined;
      return { content: [{ type: "text", text: "Disconnected." }] };
    })
  );

  // AI Action
  server.tool(
    "midscene_ai_action",
    "Perform an AI action with the given prompt",
    { prompt: z.string() },
    wrap(async ({ prompt }) => {
      const res = await ensureAgent().aiAction(prompt);
      const text = typeof res === "string" ? res : JSON.stringify(res);
      return { content: [{ type: "text", text }] };
    })
  );

  // AI Tap
  server.tool(
    "midscene_ai_tap",
    "Perform an AI tap on the element located by the given query",
    { locate: z.string(), deepThink: z.boolean().optional().default(false) },
    wrap(async ({ locate, deepThink }) => {
      const res = await ensureAgent().aiTap(locate, { deepThink });
      const text = typeof res === "string" ? res : JSON.stringify(res);
      return { content: [{ type: "text", text }] };
    })
  );

  // AI Input
  server.tool(
    "midscene_ai_input",
    "Input text into the element located by the given query",
    { text: z.string(), locate: z.string(), deepThink: z.boolean().optional().default(false) },
    wrap(async ({ text: inputText, locate, deepThink }) => {
      const res = await ensureAgent().aiInput(inputText, locate, { deepThink });
      const text = typeof res === "string" ? res : JSON.stringify(res);
      return { content: [{ type: "text", text }] };
    })
  );

  // AI Hover
  server.tool(
    "midscene_ai_hover",
    "Hover over the element located by the given query",
    { locate: z.string(), deepThink: z.boolean().optional().default(false) },
    wrap(async ({ locate, deepThink }) => {
      const res = await ensureAgent().aiHover(locate, { deepThink });
      const text = typeof res === "string" ? res : JSON.stringify(res);
      return { content: [{ type: "text", text }] };
    })
  );

  // AI Keyboard Press
  server.tool(
    "midscene_ai_keyboard_press",
    "Press a keyboard key, optionally focusing on an element first",
    { key: z.string(), locate: z.string().optional(), deepThink: z.boolean().optional().default(false) },
    wrap(async ({ key, locate, deepThink }) => {
      const res = await ensureAgent().aiKeyboardPress(key, locate, { deepThink });
      const text = typeof res === "string" ? res : JSON.stringify(res);
      return { content: [{ type: "text", text }] };
    })
  );

  // AI Scroll
  server.tool(
    "midscene_ai_scroll",
    "Scroll in the specified direction",
    {
      direction: z.enum(["up", "down", "left", "right"]),
      scrollType: z.enum(["once", "untilBottom", "untilTop", "untilLeft", "untilRight"]).optional().default("once"),
      distance: z.number().optional(),
      locate: z.string().optional(),
      deepThink: z.boolean().optional().default(false)
    },
    wrap(async ({ direction, scrollType, distance, locate, deepThink }) => {
      const res = await ensureAgent().aiScroll({ direction, scrollType, distance }, locate, { deepThink });
      const text = typeof res === "string" ? res : JSON.stringify(res);
      return { content: [{ type: "text", text }] };
    })
  );

  // AI Query
  server.tool(
    "midscene_ai_query",
    "Query data from the page using the specified data shape",
    { dataShape: z.string() },
    wrap(async ({ dataShape }) => {
      const res = await ensureAgent().aiQuery(dataShape);
      const text = typeof res === "string" ? res : JSON.stringify(res);
      return { content: [{ type: "text", text }] };
    })
  );

  // AI Assert
  server.tool(
    "midscene_ai_assert",
    "Assert that a condition is true on the page",
    { assertion: z.string(), errorMsg: z.string().optional() },
    wrap(async ({ assertion, errorMsg }) => {
      await ensureAgent().aiAssert(assertion, errorMsg);
      return { content: [] };
    })
  );

  // AI Wait For
  server.tool(
    "midscene_ai_wait_for",
    "Wait for a condition to be true on the page",
    { assertion: z.string(), timeoutMs: z.number().optional().default(15000), checkIntervalMs: z.number().optional().default(3000) },
    wrap(async ({ assertion, timeoutMs, checkIntervalMs }) => {
      await ensureAgent().aiWaitFor(assertion, { timeoutMs, checkIntervalMs });
      return { content: [] };
    })
  );

  // Evaluate JavaScript
  server.tool(
    "midscene_evaluate_javascript",
    "Evaluate JavaScript code in the browser context",
    { script: z.string() },
    wrap(async ({ script }) => {
      const res = await ensureAgent().evaluateJavaScript(script);
      const text = typeof res === "string" ? res : JSON.stringify(res);
      return { content: [{ type: "text", text }] };
    })
  );

  // Start the server over stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Run main
main().catch(err => {
  console.error(err);
  process.exit(1);
});
