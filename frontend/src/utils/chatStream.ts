import { LocalStore } from '@/lib/storage';

export async function startChatStream(
  targetChatId: string,
  message: string,
  model: string,
  stream: boolean = false // Default to non-streaming for better performance
): Promise<string> {
  const token = localStorage.getItem(LocalStore.accessToken);

  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      chatId: targetChatId,
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

  if (stream) {
    // For streaming responses, aggregate the streamed content
    let fullContent = '';
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No reader available');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = new TextDecoder().decode(value);
      const lines = text.split('\n\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(5);
          if (data === '[DONE]') break;
          try {
            const { content } = JSON.parse(data);
            if (content) {
              fullContent += content;
            }
          } catch (e) {
            console.error('Error parsing SSE data:', e);
          }
        }
      }
    }
    return fullContent;
  } else {
    // For non-streaming responses, return the content directly
    const data = await response.json();
    return data.content;
  }
}
