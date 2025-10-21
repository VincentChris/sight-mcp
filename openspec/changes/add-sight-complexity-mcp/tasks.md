## 1. Server Foundations
- [x] Confirm `sight complexity --help` usage and JSON output options; document supported flags.
- [x] Scaffold the MCP server entry point in TypeScript using `@modelcontextprotocol/sdk` with stdio transport.
- [x] Implement configuration loader (env or config file) for Sight CLI binary path, working directory, and default options in TypeScript.
- [x] Add TypeScript project setup (tsconfig, lint/type scripts, build command) and ensure compilation to JavaScript for distribution.
- [x] Declare `@imd/sight-cli` as a production dependency and ensure installs place the Sight binary in `node_modules/.bin`.

## 2. Tool Integration
- [x] Register a `sight-complexity` tool that validates inputs, executes the CLI, and streams logs to server diagnostics.
- [x] Parse Sight CLI results into structured MCP content plus a human-readable summary.
- [x] Handle non-zero exit codes and timeouts with descriptive MCP errors that surface stderr details.

## 3. Quality & Docs
- [x] Add automated coverage (unit/integration) for success, invalid input, missing binary, and CLI failure cases.
- [x] Update operator README notes to reflect the bundled CLI dependency and configuration examples.
- [x] Run `openspec validate add-sight-complexity-mcp --strict` and ensure the change passes.
