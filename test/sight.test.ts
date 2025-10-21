import { describe, expect, it } from 'vitest';
import { PassThrough } from 'node:stream';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import { loadConfig, type ConfigEnvironment } from '../src/config.js';
import {
  executeSightComplexity,
  mergeArgs,
  validateArgs,
  type SpawnImplementation
} from '../src/sight.js';
import {
  SightCliExecutionError,
  SightCliNotFoundError,
  SightCliTimeoutError,
  ToolValidationError
} from '../src/errors.js';

type SpawnMockOptions = {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  delay?: number;
};

function createSpawnMock(options: SpawnMockOptions = {}): SpawnImplementation {
  const { stdout = '', stderr = '', exitCode = 0, delay = 0 } = options;
  return () => {
    const child = new EventEmitter() as EventEmitter & {
      stdout: PassThrough;
      stderr: PassThrough;
      kill: (signal?: NodeJS.Signals) => boolean;
      killed: boolean;
    };
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.killed = false;
    child.kill = () => {
      child.killed = true;
      child.emit('close', exitCode ?? 0);
      return true;
    };

    setTimeout(() => {
      if (stdout) {
        child.stdout.write(stdout);
      }
      child.stdout.end();
      if (stderr) {
        child.stderr.write(stderr);
      }
      child.stderr.end();
    }, delay);

    setTimeout(() => {
      child.emit('close', exitCode ?? 0);
    }, delay);

    return child;
  };
}

function baseConfig(overrides: {
  binary?: string;
  workingDir?: string;
  defaultArgsEnv?: string;
  allowedFlagsEnv?: string;
  timeoutMsEnv?: string;
} = {}) {
  const env: ConfigEnvironment = {
    SIGHT_BINARY: overrides.binary,
    SIGHT_WORKDIR: overrides.workingDir ?? process.cwd(),
    SIGHT_DEFAULT_ARGS: overrides.defaultArgsEnv,
    SIGHT_ALLOWED_FLAGS: overrides.allowedFlagsEnv,
    SIGHT_TIMEOUT_MS: overrides.timeoutMsEnv
  };
  const config = loadConfig(env);
  return Object.assign(config, overrides.extra ?? {});
}

describe('argument helpers', () => {
  it('deduplicates default flags when request overrides them', () => {
    const merged = mergeArgs(['--output', 'json', '--threshold', '10'], ['--threshold', '5']);
    expect(merged).toEqual(['--output', 'json', '--threshold', '5']);
  });

  it('validates unsupported flags', () => {
    const config = baseConfig();
    expect(() => validateArgs(['--output', 'json', '--not-real'], config.allowedFlags)).toThrow(
      ToolValidationError
    );
  });
});

describe('executeSightComplexity', () => {
  it('returns parsed metrics and summary text on success', async () => {
    const config = baseConfig();
    const spawnImpl = createSpawnMock({
      stdout: JSON.stringify({
        totalFiles: 2,
        summary: {
          averageComplexity: 3.4,
          thresholdBreaches: 1
        }
      })
    });

    const result = await executeSightComplexity(
      config,
      {
        target: './src',
        args: ['--threshold', '20'],
        includeRawReport: true
      },
      { spawnImpl }
    );

    expect((result.structuredContent as { totalFiles: number }).totalFiles).toBe(2);
    expect(result.content[0].text).toContain('Sight complexity completed for ./src');
    expect(JSON.parse(result.content[1].text).totalFiles).toBe(2);
  });

  it('throws ToolValidationError when args include unsupported flags', async () => {
    const config = baseConfig();
    await expect(
      executeSightComplexity(config, { target: '.', args: ['--unknown'] })
    ).rejects.toBeInstanceOf(ToolValidationError);
  });

  it('throws SightCliNotFoundError when binary path is invalid', async () => {
    const missingBinary = path.join(process.cwd(), 'non-existent', 'sight');
    const config = baseConfig({
      binary: missingBinary
    });

    await expect(executeSightComplexity(config, { target: '.' })).rejects.toBeInstanceOf(
      SightCliNotFoundError
    );
  });

  it('propagates non-zero exit codes with stderr context', async () => {
    const config = baseConfig();
    const spawnImpl = createSpawnMock({
      stderr: 'threshold exceeded\nSee docs',
      exitCode: 1
    });

    await expect(
      executeSightComplexity(config, { target: '.', args: ['--threshold', '10'] }, { spawnImpl })
    ).rejects.toBeInstanceOf(SightCliExecutionError);
  });

  it('times out when the process exceeds configured timeout', async () => {
    const config = baseConfig({
      timeoutMsEnv: '10'
    });

    const spawnImpl: SpawnImplementation = () => {
      const child = new EventEmitter() as EventEmitter & {
        stdout: PassThrough;
        stderr: PassThrough;
        kill: (signal?: NodeJS.Signals) => boolean;
        killed: boolean;
      };
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.killed = false;
      child.kill = () => {
        child.killed = true;
        child.emit('close', 0);
        return true;
      };
      return child;
    };

    await expect(
      executeSightComplexity(config, { target: '.' }, { spawnImpl })
    ).rejects.toBeInstanceOf(SightCliTimeoutError);
  });
});
