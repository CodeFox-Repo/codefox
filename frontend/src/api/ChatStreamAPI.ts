import { ChatInputType } from '@/graphql/type';
import authenticatedFetch from '@/lib/authenticatedFetch';

export const startChatStream = async (
  input: ChatInputType,
  token: string,
  stream: boolean = false // Default to non-streaming for better performance
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
  // TODO: Handle streaming responses properly
  // if (stream) {
  //   // For streaming responses, aggregate the streamed content
  //   let fullContent = '';
  //   const reader = response.body?.getReader();
  //   if (!reader) {
  //     throw new Error('No reader available');
  //   }

  //   while (true) {
  //     const { done, value } = await reader.read();
  //     if (done) break;

  //     const text = new TextDecoder().decode(value);
  //     const lines = text.split('\n\n');

  //     for (const line of lines) {
  //       if (line.startsWith('data: ')) {
  //         const data = line.slice(5);
  //         if (data === '[DONE]') break;
  //         try {
  //           const { content } = JSON.parse(data);
  //           if (content) {
  //             fullContent += content;
  //           }
  //         } catch (e) {
  //           console.error('Error parsing SSE data:', e);
  //         }
  //       }
  //     }
  //   }
  //   return fullContent;
  // } else {
  //   // For non-streaming responses, return the content directly
  //   const data = await response.json();
  //   return data.content;
  // }

  const data = await response.json();
  return data.content;
};
