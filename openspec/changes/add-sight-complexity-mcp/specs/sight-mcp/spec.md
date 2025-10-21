## ADDED Requirements

### Requirement: Provide Sight Complexity Tool
Sight MCP MUST expose a tool named `sight-complexity` that shells out to the `sight complexity` CLI command.

#### Scenario: Run analysis for supplied target
- **GIVEN** the server configuration includes a working directory containing project source
- **AND** the packaged `@imd/sight-cli` dependency is installed under the MCP server's `node_modules`
- **WHEN** a client invokes the `sight-complexity` tool with `{ "target": "./src" }`
- **THEN** the server MUST execute `sight complexity ./src` using the configured working directory
- **AND** the invocation MUST complete within the configured timeout or the server MUST cancel the process and return a timeout error

#### Scenario: Pass through optional CLI flags
- **GIVEN** the tool input includes `{ "target": ".", "args": ["--threshold", "20"] }`
- **WHEN** the tool runs
- **THEN** the server MUST append `--threshold 20` to the CLI invocation
- **AND** the command MUST reject unknown flags with a validation error before invoking the CLI

### Requirement: Return Structured Complexity Results
Sight MCP MUST transform successful CLI output into structured MCP responses.

#### Scenario: Expose parsed metrics
- **GIVEN** `sight complexity` returns JSON metrics on stdout
- **WHEN** the CLI exits with code `0`
- **THEN** the tool response MUST include a `structuredContent` payload containing the parsed complexity metrics object
- **AND** the first textual content item MUST summarise total files analysed, average complexity, and any threshold breaches

#### Scenario: Include raw artifact on request
- **GIVEN** the tool input sets `"includeRawReport": true`
- **WHEN** the CLI writes a report file or JSON blob
- **THEN** the response MUST attach the raw report as an additional text content item so clients may persist it

### Requirement: Support Operator Configuration
Sight MCP MUST allow operators to control the CLI binary path, default working directory, and default arguments without code changes.

#### Scenario: Default packaged binary
- **GIVEN** the server runs with no custom configuration
- **WHEN** the tool is invoked
- **THEN** the server MUST resolve the bundled `node_modules/.bin/sight` executable and execute `sight complexity` from the configured working directory

#### Scenario: Custom binary path
- **GIVEN** the server configuration sets `sightBinary: "/opt/tools/sight"` and `workingDir: "/repo"`
- **WHEN** the tool is invoked
- **THEN** the server MUST execute `/opt/tools/sight complexity` from `/repo`

#### Scenario: Default arguments merged with request
- **GIVEN** configuration sets default arguments `["--output", "json"]`
- **AND** a client supplies `{ "args": ["--threshold", "10"] }`
- **WHEN** the tool runs
- **THEN** the effective invocation MUST include both `--output json` and `--threshold 10` without duplicating flags

### Requirement: Surface Execution Failures Clearly
Sight MCP MUST map CLI failures to descriptive MCP errors with actionable diagnostics.

#### Scenario: Missing CLI binary
- **GIVEN** the configured binary path does not exist
- **WHEN** the tool is invoked
- **THEN** the server MUST return an MCP error indicating the binary is missing and MUST instruct the operator to reinstall project dependencies to restore the bundled CLI

#### Scenario: CLI returns non-zero exit
- **GIVEN** `sight complexity` exits with status `1` and writes errors to stderr
- **WHEN** the MCP tool resolves
- **THEN** the response MUST be an error containing the exit code, the first stderr line, and the command that was attempted
- **AND** the server MUST log the full stderr/stdout streams for debugging
