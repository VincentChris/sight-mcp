# Sight MCP Server

This repository exposes the Sight CLI complexity analysis as an [MCP](https://modelcontextprotocol.io/) server so LLM clients can request metrics without shell access.

## Prerequisites

- Node.js 18 or newer
- Network access to the internal npm registry (`http://npm.imile-inc.com/`) so `npm install` can download `@imd/sight-cli`

The MCP server bundles `@imd/sight-cli` as a production dependency. After installation the executable is available at `node_modules/.bin/sight`; override `SIGHT_BINARY` only if you need a custom build.

## Usage

1. `npm install`
2. `npm run build`
3. `npm start`

During development you can run `npm run dev` to execute the TypeScript entry point via `tsx`.

Configuration is provided via environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `SIGHT_BINARY` | bundled `node_modules/.bin/sight` if present, otherwise `sight` | Absolute path or executable name of the CLI |
| `SIGHT_WORKDIR` | current working directory | Directory passed to the CLI |
| `SIGHT_DEFAULT_ARGS` | `--output json` | Extra default arguments (space separated or JSON array) |
| `SIGHT_ALLOWED_FLAGS` | *(see below)* | Comma-separated whitelist for Sight CLI flags to guard against typos |
| `SIGHT_TIMEOUT_MS` | `60000` | Timeout for the CLI invocation |

## MCP Tool

- **Name:** `sight-complexity`
- **Inputs:**
  - `target` (string, required): analysis target passed to `sight complexity`
  - `args` (string[], optional): additional Sight CLI flags that must be present in the allow list
  - `includeRawReport` (boolean): include raw JSON in the text response
  - `timeoutMs` (number): override configured timeout
- **Outputs:** Structured complexity metrics parsed from the CLI, plus a human summary and optional raw report text.

## Testing

```bash
npm test
```

Unit tests mock the Sight CLI process to cover success, validation failures, missing binary, non-zero exit codes, and timeouts.

- **Sight CLI flags supported by default:** `-o`, `--output`, `--output-file`, `-i`, `--include`, `-e`, `--exclude`, `-j`, `--concurrency`, `-t`, `--threshold`, `--min-complexity`, `--filter`, `--min-file`, `--top-files`, `--top-functions`, `-c`, `--config`, `--no-config`, `--jsx-analysis`, `--jsx-props-in-cognitive`, `--fast-mode`, `--memory-limit`, `--timeout`, `--max-file-size`, `--skip-minified-js`, `--no-color`, `--include-details`, `--pretty`, `--respect-gitignore`, `--use-global-gitignore`, `--algorithms`, `--progress`, `--tui`, `--json-view`, `--view-output-file`, `--events`, `--events-file`. Update `SIGHT_ALLOWED_FLAGS` to permit additional switches if the CLI evolves.
