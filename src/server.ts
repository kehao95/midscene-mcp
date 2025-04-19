import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { AgentOverChromeBridge } from "@midscene/web/bridge-mode";
import { registerTools } from "./tools.js"; // Import the tool registration function

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

  // Register all tools
  registerTools(server, {
    ensureAgent,
    wrap,
    getAgent: () => agent,
    setAgent: (newAgent) => { agent = newAgent; }
  });

  // Start the server over stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Run main
main().catch(err => {
  console.error(err);
  process.exit(1);
});
