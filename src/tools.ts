import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AgentOverChromeBridge } from "@midscene/web/bridge-mode";
import { z } from "zod";

// Type for the dependencies needed by the tools
type EnsureAgentFn = () => AgentOverChromeBridge;
type WrapFn = (fn: (args: any) => Promise<any>) => (args: any) => Promise<any>;

interface ToolDependencies {
  ensureAgent: EnsureAgentFn;
  wrap: WrapFn;
  // Add agent state management functions if needed, e.g., to set agent = undefined on disconnect
  setAgent: (agent: AgentOverChromeBridge | undefined) => void;
  getAgent: () => AgentOverChromeBridge | undefined;
}

export function registerTools(server: McpServer, deps: ToolDependencies) {
  const { ensureAgent, wrap, setAgent, getAgent } = deps;

  // Connect to current active tab
  server.tool(
    "midscene_connect_current_tab",
    "Connects to the currently active tab in the user's Chrome browser.",
    {
      forceSameTabNavigation: z.boolean().optional().default(true).describe("If true (default), restricts pages from opening new tabs, forcing new pages to open in the current tab.")
    },
    wrap(async ({ forceSameTabNavigation }) => {
      if (getAgent()) throw new Error("Already connected to a tab.");
      const agent = new AgentOverChromeBridge();
      await agent.connectCurrentTab({ forceSameTabNavigation });
      setAgent(agent);
      return { content: [{ type: "text", text: "Connected to current tab." }] };
    })
  );

  // Disconnect
  server.tool(
    "midscene_disconnect",
    "Disconnects from the currently connected browser tab and releases resources.",
    {
      closeNewTabsAfterDisconnect: z.boolean().optional().default(false).describe("If true, the newly created tab will be closed when the bridge is destroyed. Overrides constructor setting.")
    },
    wrap(async ({ closeNewTabsAfterDisconnect }) => {
      await ensureAgent().destroy(closeNewTabsAfterDisconnect);
      setAgent(undefined);
      return { content: [{ type: "text", text: "Disconnected." }] };
    })
  );

  // AI Action (Auto Planning)
  server.tool(
    "midscene_ai_action",
    "Performs a series of UI actions described in natural language (Auto Planning). Midscene automatically plans the steps and executes them sequentially. Use for complex or multi-step interactions where planning is beneficial.",
    { prompt: z.string().describe("A natural language description of the UI steps to perform.") },
    wrap(async ({ prompt }) => {
      // aiAction does not return a meaningful value, it throws on error.
      await ensureAgent().aiAction(prompt);
      return { content: [{ type: "text", text: "Action sequence completed." }] };
    })
  );

  // AI Tap (Instant Action)
  server.tool(
    "midscene_ai_tap",
    "Performs a tap/click action on a specified element (Instant Action). Faster and more reliable for single actions. The AI model locates the element.",
    {
      locate: z.string().describe("A natural language description of the element to tap."),
      deepThink: z.boolean().optional().default(false).describe("If true, uses a two-step AI call to precisely locate the element, useful for ambiguous elements.")
    },
    wrap(async ({ locate, deepThink }) => {
      await ensureAgent().aiTap(locate, { deepThink });
      return { content: [{ type: "text", text: `Tapped element described by: "${locate}"` }] };
    })
  );

  // AI Input (Instant Action)
  server.tool(
    "midscene_ai_input",
    "Inputs text into a specified element (Instant Action). Use an empty string to clear the input.",
    {
      text: z.string().describe("The final text content to be placed in the input element. Use an empty string to clear."),
      locate: z.string().describe("A natural language description of the element to input text into."),
      deepThink: z.boolean().optional().default(false).describe("If true, uses a two-step AI call to precisely locate the element.")
    },
    wrap(async ({ text: inputText, locate, deepThink }) => {
      await ensureAgent().aiInput(inputText, locate, { deepThink });
      return { content: [{ type: "text", text: `Input "${inputText}" into element described by: "${locate}"` }] };
    })
  );

  // AI Hover (Instant Action)
  server.tool(
    "midscene_ai_hover",
    "Moves the mouse cursor over a specified element (Instant Action).",
    {
      locate: z.string().describe("A natural language description of the element to hover over."),
      deepThink: z.boolean().optional().default(false).describe("If true, uses a two-step AI call to precisely locate the element.")
     },
    wrap(async ({ locate, deepThink }) => {
      await ensureAgent().aiHover(locate, { deepThink });
      return { content: [{ type: "text", text: `Hovered over element described by: "${locate}"` }] };
    })
  );

  // AI Keyboard Press (Instant Action)
  server.tool(
    "midscene_ai_keyboard_press",
    "Presses a specified keyboard key (Instant Action). Optionally targets an element.",
    {
      key: z.string().describe("The web key to press (e.g., 'Enter', 'Tab', 'Escape'). Key combinations are not supported."),
      locate: z.string().optional().describe("Optional natural language description of the element to focus before pressing the key."),
      deepThink: z.boolean().optional().default(false).describe("If true and 'locate' is provided, uses a two-step AI call to precisely locate the element.")
    },
    wrap(async ({ key, locate, deepThink }) => {
      await ensureAgent().aiKeyboardPress(key, locate, { deepThink });
      const targetDesc = locate ? ` on element described by: "${locate}"` : '';
      return { content: [{ type: "text", text: `Pressed key "${key}"${targetDesc}` }] };
    })
  );

  // AI Scroll (Instant Action)
  server.tool(
    "midscene_ai_scroll",
    "Scrolls the page or a specified element (Instant Action).",
    {
      direction: z.enum(["up", "down", "left", "right"]).describe("The direction to scroll."),
      scrollType: z.enum(["once", "untilBottom", "untilTop", "untilLeft", "untilRight"]).optional().default("once").describe("Type of scroll: 'once' for a fixed distance, or until reaching an edge."),
      distance: z.number().optional().describe("The distance to scroll in pixels (used with scrollType 'once')."),
      locate: z.string().optional().describe("Optional natural language description of the element to scroll. If not provided, scrolls based on current mouse position."),
      deepThink: z.boolean().optional().default(false).describe("If true and 'locate' is provided, uses a two-step AI call to precisely locate the element.")
    },
    wrap(async ({ direction, scrollType, distance, locate, deepThink }) => {
      // Construct the scrollParam object as expected by the API
      const scrollParam = { direction, scrollType, distance };
      await ensureAgent().aiScroll(scrollParam, locate, { deepThink });
      const targetDesc = locate ? ` element described by: "${locate}"` : ' the page';
      return { content: [{ type: "text", text: `Scrolled${targetDesc} ${direction}.` }] };
    })
  );

  // AI Query (Data Extraction)
  server.tool(
    "midscene_ai_query",
    "Extracts structured data from the UI using multimodal AI reasoning. Describe the desired data format within the prompt.",
    {
      dataShape: z.string().describe("A description of the expected return format and the data to extract. Examples: 'The date and time displayed in the top-left corner as a string', 'User information in the format {name: string}', 'string[], list of task names', '{name: string, age: number}[], table data records'.")
    },
    wrap(async ({ dataShape }) => {
      const res = await ensureAgent().aiQuery(dataShape);
      // Attempt to stringify complex results for display, keep strings as is.
      const text = typeof res === "string" ? res : JSON.stringify(res, null, 2);
      return { content: [{ type: "text", text }] };
    })
  );

  // AI Assert
  server.tool(
    "midscene_ai_assert",
    "Performs an assertion based on a natural language condition. Throws an error if the assertion fails, including an AI-generated reason.",
    {
      assertion: z.string().describe("The assertion described in natural language (e.g., 'The login button is visible', 'The price of item X is $10')."),
      errorMsg: z.string().optional().describe("An optional custom error message to append if the assertion fails.")
    },
    wrap(async ({ assertion, errorMsg }) => {
      await ensureAgent().aiAssert(assertion, errorMsg);
      return { content: [{ type: "text", text: `Assertion passed: "${assertion}"` }] }; // Return success message
    })
  );

  // AI Wait For
  server.tool(
    "midscene_ai_wait_for",
    "Waits until a specified condition, described in natural language, becomes true on the page. Polls the condition using AI.",
    {
      assertion: z.string().describe("The condition to wait for, described in natural language."),
      timeoutMs: z.number().optional().default(15000).describe("Maximum time to wait in milliseconds (default: 15000)."),
      checkIntervalMs: z.number().optional().default(3000).describe("Interval between checks in milliseconds (default: 3000).")
     },
    wrap(async ({ assertion, timeoutMs, checkIntervalMs }) => {
      await ensureAgent().aiWaitFor(assertion, { timeoutMs, checkIntervalMs });
      return { content: [{ type: "text", text: `Wait condition met: "${assertion}"` }] }; // Return success message
    })
  );

  // Run YAML Script
  server.tool(
    "midscene_run_yaml",
    "Executes an automation script written in YAML format. Only the 'tasks' part of the script is executed.",
    {
      yamlScriptContent: z.string().describe("The YAML-formatted script content containing the 'tasks' to execute.")
    },
    wrap(async ({ yamlScriptContent }) => {
      const res = await ensureAgent().runYaml(yamlScriptContent);
      // Result contains outputs from aiQuery steps within the YAML
      const text = JSON.stringify(res.result, null, 2);
      return { content: [{ type: "text", text: `YAML script executed. Query results:
${text}` }] };
    })
  );

  // Set AI Action Context
  server.tool(
    "midscene_set_ai_action_context",
    "Sets background knowledge/context provided to the AI model when using 'midscene_ai_action'. This context persists for subsequent aiAction calls.",
    {
      actionContext: z.string().describe("The background knowledge or standing instructions for the AI (e.g., 'Always close cookie consent dialogs first if they appear.').")
    },
    wrap(async ({ actionContext }) => {
      // setAIActionContext returns void
      ensureAgent().setAIActionContext(actionContext);
      return { content: [{ type: "text", text: "AI action context updated." }] };
    })
  );

  // Evaluate JavaScript
  server.tool(
    "midscene_evaluate_javascript",
    "Evaluates a JavaScript expression within the context of the current web page.",
    { script: z.string().describe("The JavaScript expression to evaluate (e.g., 'document.title', 'window.location.href').") },
    wrap(async ({ script }) => {
      const res = await ensureAgent().evaluateJavaScript(script);
      const text = typeof res === "string" ? res : JSON.stringify(res);
      return { content: [{ type: "text", text }] };
    })
  );
} 
