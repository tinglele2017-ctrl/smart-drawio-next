import { describe, expect, it, vi } from 'vitest';

import { isAllowedBaseUrl, shouldAllowLocalBaseUrls } from '@/lib/url-validator';

describe('url-validator', () => {
  it('rejects local HTTP endpoints by default', () => {
    expect(isAllowedBaseUrl('http://localhost:11434/v1')).toEqual({
      valid: false,
      reason: 'Only HTTPS URLs are allowed',
    });
  });

  it('allows local HTTP endpoints when explicitly enabled', () => {
    expect(isAllowedBaseUrl('http://localhost:11434/v1', { allowLocal: true })).toEqual({
      valid: true,
      reason: 'Local/internal base URL allowed by configuration',
    });
  });

  it('reads the allow-local toggle from the environment', () => {
    vi.stubEnv('ALLOW_LOCAL_LLM_BASE_URLS', 'true');
    expect(shouldAllowLocalBaseUrls()).toBe(true);
    vi.unstubAllEnvs();
  });
});
