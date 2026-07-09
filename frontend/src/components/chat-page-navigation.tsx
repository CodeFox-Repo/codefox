import { EventEnum } from '@/const/EventEnum';
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

export const redirectChatPage = (
  chatId: string,
  setCurrentChatid: (id: string) => void,
  setChatId: (id: string) => void,
  router: AppRouterInstance
) => {
  setCurrentChatid(chatId);
  setChatId(chatId);
  router.push(`/chat?id=${chatId}`);
  const event = new Event(EventEnum.CHAT);
  window.dispatchEvent(event);
};
