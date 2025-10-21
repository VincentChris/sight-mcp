#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { createSightComplexityTool, type SightComplexityInput } from './sight.js';

async function main(): Promise<void> {
  const config = loadConfig();

  const server = new McpServer({
    name: 'sight-mcp',
    version: '0.1.0'
  });

  const tool = createSightComplexityTool(config);
  server.registerTool(
    tool.slug,
    {
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema
    },
    async params => tool.handler(params as SightComplexityInput)
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.info('[sight-mcp] Server connected using stdio transport');
}

main().catch(error => {
  console.error('[sight-mcp] Failed to start server:', error);
  process.exitCode = 1;
});
