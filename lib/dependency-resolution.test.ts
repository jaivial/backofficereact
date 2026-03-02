import { describe, expect, it } from 'vitest';

describe('dependency resolution', () => {
  it('resolves recharts peer dependency react-is', async () => {
    const reactIs = await import('react-is');
    expect(reactIs).toBeTruthy();
  });
});
