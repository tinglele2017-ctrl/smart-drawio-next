import { beforeEach, describe, expect, it, vi } from 'vitest';

import { callLLM, fetchModels, getBaseUrlCandidates } from '@/lib/llm-client';

function createSseStream(chunks) {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

describe('llm-client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('adds Docker host aliases for loopback base URLs', () => {
    expect(getBaseUrlCandidates('http://localhost:11434/v1/')).toEqual([
      'http://localhost:11434/v1',
      'http://host.docker.internal:11434/v1',
      'http://gateway.docker.internal:11434/v1',
    ]);
  });

  it('retries model requests through Docker host aliases after a loopback fetch failure', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'gpt-4.1-mini', name: 'gpt-4.1-mini' }],
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const models = await fetchModels('openai', 'http://localhost:11434/v1', 'sk-test');

    expect(models).toEqual([{ id: 'gpt-4.1-mini', name: 'gpt-4.1-mini' }]);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'http://localhost:11434/v1/models',
      'http://host.docker.internal:11434/v1/models',
    ]);
  });

  it('retries streaming generation requests through Docker host aliases after a loopback fetch failure', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce({
        ok: true,
        body: createSseStream([
          'data: {"choices":[{"delta":{"content":"<mxfile>"}}]}\n',
          'data: {"choices":[{"delta":{"content":"</mxfile>"},"finish_reason":"stop"}]}\n',
          'data: [DONE]\n\n',
        ]),
      });

    vi.stubGlobal('fetch', fetchMock);

    const onChunk = vi.fn();
    const result = await callLLM(
      {
        type: 'openai',
        baseUrl: 'http://localhost:11434/v1',
        apiKey: 'sk-test',
        model: 'gpt-4.1-mini',
      },
      [{ role: 'user', content: 'generate a diagram' }],
      onChunk
    );

    expect(result).toEqual({ text: '<mxfile></mxfile>', stopReason: 'stop' });
    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'http://localhost:11434/v1/chat/completions',
      'http://host.docker.internal:11434/v1/chat/completions',
    ]);
  });
});
