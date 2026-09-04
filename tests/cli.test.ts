import { describe, it, expect } from 'vitest';
import { runCli } from '../src/cli/index';

describe('CLI Runner', () => {
  it('should print help and return 0 on help flag', async () => {
    const code = await runCli(['--help']);
    expect(code).toBe(0);
  });

  it('should return 0 on empty command (help default)', async () => {
    const code = await runCli([]);
    expect(code).toBe(0);
  });

  it('should return error code on unknown command', async () => {
    const code = await runCli(['nonexistent-command-xyz']);
    expect(code).toBe(1);
  });
});
