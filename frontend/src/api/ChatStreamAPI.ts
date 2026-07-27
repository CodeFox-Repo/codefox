import { ChatInputType } from '@/graphql/type';
import authenticatedFetch from '@/lib/authenticatedFetch';

export const startChatStream = async (
  input: ChatInputType,
  token: string,
  stream: boolean = false, // Default to non-streaming for better performance
  onChunk?: (delta: string) => void
): Promise<string> => {
  if (!token) {
    throw new Error('Not authenticated');
  }
  const { chatId, message, model } = input;
  const response = await authenticatedFetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      chatId,
      message,
      model,
      stream,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Network response was not ok: ${response.status} ${response.statusText}`
    );
  }

  // The backend answers with streamText().toTextStreamResponse() — a raw text
  // stream, not JSON. Drain it and hand callers the assembled text.
  // onChunk lets a caller render deltas as they land.
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body to read');
  }

  const decoder = new TextDecoder();
  let content = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const delta = decoder.decode(value, { stream: true });
    if (!delta) continue;
    content += delta;
    onChunk?.(delta);
  }
  content += decoder.decode();

  return content;
};
