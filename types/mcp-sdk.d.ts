declare module '@modelcontextprotocol/sdk/server/mcp.js' {
  interface ServerInfo {
    name: string;
    version: string;
  }

  interface ToolSchema {
    title?: string;
    description?: string;
    inputSchema?: unknown;
    outputSchema?: unknown;
  }

  type ToolHandler = (params: unknown) => Promise<unknown>;

  export class McpServer {
    constructor(info: ServerInfo);
    registerTool(slug: string, schema: ToolSchema, handler: ToolHandler): void;
    connect(transport: unknown): Promise<void>;
  }
}

declare module '@modelcontextprotocol/sdk/server/stdio.js' {
  export class StdioServerTransport {
    connect?(): Promise<void>;
  }
}
