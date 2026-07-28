import { useQuery } from '@apollo/client';
import { GET_USER_CHATS } from '@/graphql/request';
import { Chat } from '@/graphql/type';
import { useState, useCallback, useMemo } from 'react';
import { useAuthContext } from '@/providers/AuthProvider';

export function useChatList() {
  const [chatListUpdated, setChatListUpdated] = useState(false);
  const { isAuthorized } = useAuthContext();
  const {
    data: chatData,
    loading,
    error,
    refetch,
  } = useQuery<{ getUserChats: Chat[] }>(GET_USER_CHATS, {
    // Serve the cache instantly, refresh behind it: the invalidation flag
    // this used to key on died with the sidebar, so a cache-first list went
    // stale the moment a project was created or renamed elsewhere.
    fetchPolicy: 'cache-and-network',
    skip: !isAuthorized,
  });

  const handleRefetch = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleChatListUpdate = useCallback((value: boolean) => {
    setChatListUpdated(value);
  }, []);

  const sortedChats = useMemo(() => {
    const chats = chatData?.getUserChats || [];
    return [...chats].sort(
      (a: Chat, b: Chat) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
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
