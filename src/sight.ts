import { spawn, type SpawnOptionsWithoutStdio } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import {
  SightCliExecutionError,
  SightCliNotFoundError,
  SightCliTimeoutError,
  ToolValidationError
} from './errors.js';
import type { SightConfig } from './config.js';

const inputSchema = z
  .object({
    target: z.string().min(1, 'target must not be empty').default('.'),
    args: z.array(z.string()).optional(),
    includeRawReport: z.boolean().optional(),
    timeoutMs: z.number().int().positive().optional()
  })
  .strict();

export type SightComplexityInput = z.infer<typeof inputSchema>;

export interface SightComplexityResult {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: unknown;
}

export interface SpawnedProcess extends EventEmitter {
  stdout: NodeJS.ReadableStream | null;
  stderr: NodeJS.ReadableStream | null;
  kill?: (signal?: NodeJS.Signals) => boolean | void;
  killed?: boolean;
}

export type SpawnImplementation = (
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio
) => SpawnedProcess;

function extractFlagName(token: string): string | null {
  if (!token.startsWith('-')) {
    return null;
  }
  const index = token.indexOf('=');
  if (index === -1) {
    return token;
  }
  return token.slice(0, index);
}

export function validateArgs(args: string[] | undefined, allowedFlags: Set<string>): void {
  if (!args) {
    return;
  }
  for (const token of args) {
    if (typeof token !== 'string') {
      throw new ToolValidationError('All args entries must be strings');
    }
    const flag = extractFlagName(token);
    if (!flag) {
      continue;
    }
    if (allowedFlags.size > 0 && !allowedFlags.has(flag)) {
      throw new ToolValidationError(
        `Unsupported flag "${flag}". Update configuration to allow it before retrying.`
      );
    }
  }
}

function collectRequestFlags(args: string[] = []): Set<string> {
  const flags = new Set<string>();
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (!token.startsWith('-')) {
      continue;
    }
    const flag = extractFlagName(token);
    if (!flag) {
      continue;
    }
    flags.add(flag);
  }
  return flags;
}

export function mergeArgs(defaultArgs: string[], requestArgs: string[] = []): string[] {
  const requestFlags = collectRequestFlags(requestArgs);
  const merged: string[] = [];

  for (let i = 0; i < defaultArgs.length; i += 1) {
    const token = defaultArgs[i];
    const flag = token.startsWith('-') ? extractFlagName(token) : null;
    if (flag && requestFlags.has(flag)) {
      if (i + 1 < defaultArgs.length && !defaultArgs[i + 1].startsWith('-')) {
        i += 1;
      }
      continue;
    }
    merged.push(token);
  }

  return merged.concat(requestArgs);
}

interface CommandParts {
  binary: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
}

function commandParts(config: SightConfig, params: SightComplexityInput, args: string[]): CommandParts {
  return {
    binary: config.binary,
    args: ['complexity', params.target, ...args],
    cwd: config.workingDir,
    timeoutMs: params.timeoutMs ?? config.timeoutMs
  };
}

async function ensureBinaryExists(binary: string): Promise<void> {
  if (binary.includes(path.sep)) {
    try {
      await fs.promises.access(binary, fs.constants.X_OK);
    } catch {
      throw new SightCliNotFoundError(
        `Sight CLI binary not found at "${binary}". Install with "pnpm add @imd/sight-cli --registry http://npm.imile-inc.com" or update SIGHT_BINARY.`
      );
    }
  }
}

function logCommand(parts: CommandParts): string {
  const commandString = [parts.binary, ...parts.args].join(' ');
  console.info(`[sight-mcp] Executing: ${commandString} (cwd=${parts.cwd})`);
  return commandString;
}

function buildSummary(metrics: Record<string, unknown>, target: string): string {
  const summary = metrics.summary as Record<string, unknown> | undefined;
  const aggregate = metrics.aggregate as Record<string, unknown> | undefined;

  const filesAnalysed =
    (metrics.totalFiles as number | undefined) ??
    (metrics.fileCount as number | undefined) ??
    (metrics.filesCount as number | undefined) ??
    (summary?.totalFiles as number | undefined) ??
    (summary?.files as number | undefined) ??
    (Array.isArray(metrics.files) ? metrics.files.length : undefined);

  const averageComplexity =
    (metrics.averageComplexity as number | undefined) ??
    (metrics.avgComplexity as number | undefined) ??
    (summary?.averageComplexity as number | undefined) ??
    (summary?.mean as number | undefined) ??
    (summary?.average as number | undefined) ??
    (aggregate?.average as number | undefined);

  const breachCount =
    (metrics.thresholdBreaches as number | undefined) ??
    (summary?.thresholdBreaches as number | undefined) ??
    (summary?.breaches as number | undefined) ??
    (Array.isArray(metrics.violations) ? metrics.violations.length : undefined) ??
    (Array.isArray(metrics.thresholdBreaches) ? metrics.thresholdBreaches.length : undefined);

  const parts = [`Sight complexity completed for ${target}`];

  if (typeof filesAnalysed === 'number') {
    parts.push(`files analysed: ${filesAnalysed}`);
  }

  if (typeof averageComplexity === 'number') {
    const rounded = Math.round(averageComplexity * 100) / 100;
    parts.push(`average complexity: ${rounded}`);
  }

  if (typeof breachCount === 'number') {
    if (breachCount > 0) {
      parts.push(`threshold breaches: ${breachCount}`);
    } else {
      parts.push('no threshold breaches detected');
    }
  }

  if (parts.length === 1) {
    parts.push('review structuredContent for detailed metrics');
  }

  return parts.join('. ');
}

export interface ExecuteOptions {
  spawnImpl?: SpawnImplementation;
}

export async function executeSightComplexity(
  config: SightConfig,
  params: SightComplexityInput,
  options: ExecuteOptions = {}
): Promise<SightComplexityResult> {
  const { spawnImpl = spawn as SpawnImplementation } = options;
  const safeParams = inputSchema.parse(params);
  validateArgs(safeParams.args, config.allowedFlags);

  await ensureBinaryExists(config.binary);

  const args = mergeArgs(config.defaultArgs, safeParams.args);
  const parts = commandParts(config, safeParams, args);
  const commandString = logCommand(parts);

  return await new Promise<SightComplexityResult>((resolve, reject) => {
    let settled = false;
    const safeResolve = (value: SightComplexityResult): void => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };
    const safeReject = (error: unknown): void => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    };

    const child = spawnImpl(parts.binary, parts.args, {
      cwd: parts.cwd,
      env: process.env
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    const timeoutId: NodeJS.Timeout | null =
      parts.timeoutMs > 0
        ? setTimeout(() => {
            safeReject(
              new SightCliTimeoutError(`Sight CLI timed out after ${parts.timeoutMs}ms`, {
                timeoutMs: parts.timeoutMs,
                command: commandString
              })
            );
            if (typeof child.kill === 'function' && !child.killed) {
              child.kill('SIGTERM');
            }
          }, parts.timeoutMs)
        : null;

    child.stdout?.on('data', chunk => {
      stdoutChunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    });

    child.stderr?.on('data', chunk => {
      stderrChunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    });

    child.on('error', error => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === 'ENOENT') {
        safeReject(
          new SightCliNotFoundError(
            `Sight CLI binary "${parts.binary}" not found. Install with "pnpm add @imd/sight-cli --registry http://npm.imile-inc.com" or update SIGHT_BINARY.`
          )
        );
      } else {
        safeReject(error);
      }
    });

    child.on('close', code => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      const stdout = Buffer.concat(stdoutChunks).toString('utf8').trim();
      const stderr = Buffer.concat(stderrChunks).toString('utf8').trim();

      if (stderr) {
        console.error('[sight-mcp] sight stderr:', stderr);
      }
      if (stdout) {
        console.info('[sight-mcp] sight stdout:', stdout);
      }

      if (code !== 0) {
        const firstLine = stderr.split('\n').find(Boolean) ?? 'Sight CLI exited with an error';
        safeReject(
          new SightCliExecutionError(`Sight CLI exited with code ${code}: ${firstLine}`, {
            exitCode: code ?? undefined,
            stderr,
            command: commandString
          })
        );
        return;
      }

      if (!stdout) {
        safeReject(
          new SightCliExecutionError('Sight CLI succeeded but produced no output', {
            exitCode: code ?? undefined,
            stderr,
            command: commandString
          })
        );
        return;
      }

      try {
        const metrics = JSON.parse(stdout) as Record<string, unknown>;
        const summary = buildSummary(metrics, safeParams.target);
        const content: SightComplexityResult['content'] = [
          {
            type: 'text',
            text: summary
          }
        ];

        if (safeParams.includeRawReport) {
          content.push({
            type: 'text',
            text: stdout
          });
        }

        safeResolve({
          content,
          structuredContent: metrics
        });
      } catch {
        safeReject(
          new SightCliExecutionError('Failed to parse Sight CLI output as JSON', {
            exitCode: code ?? undefined,
            stderr,
            command: commandString
          })
        );
      }
    });
  });
}

export interface SightComplexityTool {
  slug: string;
  title: string;
  description: string;
  inputSchema: typeof inputSchema;
  outputSchema: z.ZodTypeAny;
  handler: (params: SightComplexityInput) => Promise<SightComplexityResult>;
}

export function createSightComplexityTool(
  config: SightConfig,
  options: ExecuteOptions = {}
): SightComplexityTool {
  const { spawnImpl } = options;
  return {
    slug: 'sight-complexity',
    title: 'Sight Complexity',
    description: 'Analyse code complexity metrics using the Sight CLI',
    inputSchema: inputSchema.strict(),
    outputSchema: z.object({}).passthrough(),
    handler: async params => {
      try {
        return await executeSightComplexity(config, params, { spawnImpl });
      } catch (error) {
        if (
          error instanceof ToolValidationError ||
          error instanceof SightCliNotFoundError ||
          error instanceof SightCliExecutionError ||
          error instanceof SightCliTimeoutError
        ) {
          throw error;
        }
        throw new SightCliExecutionError((error as Error).message, {});
      }
    }
  };
}

export const __testables__ = {
  extractFlagName,
  collectRequestFlags,
  commandParts,
  buildSummary
};
