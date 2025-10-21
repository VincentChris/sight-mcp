export class ToolValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolValidationError';
  }
}

export class SightCliNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SightCliNotFoundError';
  }
}

export interface SightCliExecutionErrorOptions {
  exitCode?: number;
  stderr?: string;
  command?: string;
}

export class SightCliExecutionError extends Error {
  exitCode?: number;
  stderr?: string;
  command?: string;

  constructor(message: string, options: SightCliExecutionErrorOptions = {}) {
    super(message);
    this.name = 'SightCliExecutionError';
    this.exitCode = options.exitCode;
    this.stderr = options.stderr;
    this.command = options.command;
  }
}

export interface SightCliTimeoutErrorOptions {
  timeoutMs?: number;
  command?: string;
}

export class SightCliTimeoutError extends Error {
  timeoutMs?: number;
  command?: string;

  constructor(message: string, options: SightCliTimeoutErrorOptions = {}) {
    super(message);
    this.name = 'SightCliTimeoutError';
    this.timeoutMs = options.timeoutMs;
    this.command = options.command;
  }
}
