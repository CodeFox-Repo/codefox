import { useQuery } from '@apollo/client';
import { GET_USER_CHATS } from '@/graphql/request';
import { Chat } from '@/graphql/type';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useAuthContext } from '@/providers/AuthProvider';
import { EventEnum } from '@/const/EventEnum';

export function useChatList() {
  const [chatListUpdated, setChatListUpdated] = useState(false);
  const { isAuthorized, user } = useAuthContext();
  const {
    data: chatData,
    loading,
    error,
    refetch,
  } = useQuery<{ getUserChats: Chat[] }>(GET_USER_CHATS, {
    fetchPolicy: chatListUpdated ? 'network-only' : 'cache-first',
    skip: !isAuthorized,
  });

  const handleRefetch = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleChatListUpdate = useCallback((value: boolean) => {
    setChatListUpdated(value);
  }, []);

  // 监听用户变化和新聊天事件
  useEffect(() => {
    const handleNewChat = () => {
      handleRefetch();
    };

    window.addEventListener(EventEnum.NEW_CHAT, handleNewChat);
    return () => {
      window.removeEventListener(EventEnum.NEW_CHAT, handleNewChat);
    };
  }, [handleRefetch]);

  // 当用户ID变化时，强制刷新聊天列表
  useEffect(() => {
    if (user?.id) {
      handleRefetch();
    }
  }, [user?.id, handleRefetch]);

  const sortedChats = useMemo(() => {
    const chats = chatData?.getUserChats || [];
    // Sort chats by createdAt in descending order (newest first)
    return [...chats].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [chatData?.getUserChats]);

  return {
    chats: sortedChats,
    loading,
    error,
    chatListUpdated,
    setChatListUpdated: handleChatListUpdate,
    refetchChats: handleRefetch,
  };
}
