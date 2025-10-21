## Why
- Sight CLI currently runs as a standalone command-line tool; we need an MCP-compliant server so AI clients can request complexity insights directly.
- Teams rely on MCP transports (stdio/SSE/HTTP) for tooling access, so wrapping `sight complexity` lets us reuse existing IDE integrations.
- A spec is required before implementation to align on the MCP surface and operational expectations.

## What Changes
- Build a TypeScript MCP server (compiled to Node.js) that shells out to `@imd/sight-cli` for the `sight complexity` command.
- Expose a `sight-complexity` tool that accepts analysis targets and optional CLI arguments, returning structured metrics and a concise textual summary.
- Add configuration for locating the Sight CLI binary and default analysis scope so environments without global installs can use the server.
- Capture Sight CLI stderr/stdout for logging, map failures to readable MCP errors, and enforce execution guardrails (timeouts, working directory).
- Document usage expectations, including the bundled CLI dependency and optional overrides.

## Impact
- Requires the `@modelcontextprotocol/sdk` runtime dependency (likely via npm/pnpm) to implement the server with TypeScript support.
- Introduces TypeScript build tooling (e.g., `tsconfig.json`, `ts-node`/`tsx` or equivalent) for compilation and type-checking.
- Depends on packaging `@imd/sight-cli` alongside the MCP server so installs automatically include the CLI binary (internal registry access still required during install).
- Introduces a new capability spec `sight-mcp` that will guide future implementation and testing.
