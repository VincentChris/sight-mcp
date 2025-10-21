import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface SightConfig {
  binary: string;
  workingDir: string;
  defaultArgs: string[];
  allowedFlags: Set<string>;
  timeoutMs: number;
}

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_ARGS = ['--output', 'json'];
const DEFAULT_ALLOWED_FLAGS = [
  '-o',
  '--output',
  '--output-file',
  '-i',
  '--include',
  '-e',
  '--exclude',
  '-j',
  '--concurrency',
  '-t',
  '--threshold',
  '--min-complexity',
  '--filter',
  '--min-file',
  '--top-files',
  '--top-functions',
  '-c',
  '--config',
  '--no-config',
  '--jsx-analysis',
  '--jsx-props-in-cognitive',
  '--fast-mode',
  '--memory-limit',
  '--timeout',
  '--max-file-size',
  '--skip-minified-js',
  '--no-color',
  '--include-details',
  '--pretty',
  '--respect-gitignore',
  '--use-global-gitignore',
  '--algorithms',
  '--progress',
  '--tui',
  '--json-view',
  '--view-output-file',
  '--events',
  '--events-file'
];

function splitArgs(value?: string | null): string[] {
  if (!value) {
    return [];
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
        return parsed;
      }
    } catch {
      // fall through to whitespace split
    }
  }
  return trimmed.split(/\s+/);
}

function parseAllowedFlags(value?: string | null): Set<string> {
  if (!value) {
    return new Set(DEFAULT_ALLOWED_FLAGS);
  }
  return new Set(
    value
      .split(',')
      .map(token => token.trim())
      .filter(Boolean)
  );
}

function resolveWorkingDir(dirPath?: string | null): string {
  const finalPath = dirPath ? dirPath : process.cwd();
  const normalized = path.resolve(finalPath);
  if (!fs.existsSync(normalized)) {
    throw new Error(`Configured working directory "${normalized}" does not exist`);
  }
  return normalized;
}

function buildDefaultArgs(envValue?: string | null): string[] {
  const args = DEFAULT_ARGS.slice();
  const extras = splitArgs(envValue);
  for (const arg of extras) {
    if (!args.includes(arg)) {
      args.push(arg);
    }
  }
  return args;
}

function parseTimeoutMs(value?: string | null): number {
  if (!value) {
    return DEFAULT_TIMEOUT_MS;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid timeout "${value}". Provide a positive integer in milliseconds.`);
  }
  return parsed;
}

function resolveBundledBinary(): string | null {
  const binaryName = process.platform === 'win32' ? 'sight.cmd' : 'sight';
  const binaryPath = path.resolve(MODULE_DIR, '..', 'node_modules', '.bin', binaryName);
  if (fs.existsSync(binaryPath)) {
    return binaryPath;
  }
  return null;
}

export interface ConfigEnvironment {
  SIGHT_BINARY?: string;
  SIGHT_WORKDIR?: string;
  SIGHT_DEFAULT_ARGS?: string;
  SIGHT_ALLOWED_FLAGS?: string;
  SIGHT_TIMEOUT_MS?: string;
}

export function loadConfig(envInput: ConfigEnvironment | NodeJS.ProcessEnv = process.env): SightConfig {
  const env = envInput as ConfigEnvironment;
  const binary = env?.SIGHT_BINARY?.trim() ?? resolveBundledBinary() ?? 'sight';
  const workingDir = resolveWorkingDir(env?.SIGHT_WORKDIR);
  const defaultArgs = buildDefaultArgs(env?.SIGHT_DEFAULT_ARGS);
  const allowedFlags = parseAllowedFlags(env?.SIGHT_ALLOWED_FLAGS);
  const timeoutMs = parseTimeoutMs(env?.SIGHT_TIMEOUT_MS);

  return {
    binary,
    workingDir,
    defaultArgs,
    allowedFlags,
    timeoutMs
  };
}

export const __testables__ = {
  splitArgs,
  parseAllowedFlags,
  resolveWorkingDir,
  buildDefaultArgs,
  parseTimeoutMs,
  resolveBundledBinary
};
