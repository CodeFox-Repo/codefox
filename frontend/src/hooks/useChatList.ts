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
    previousData,
    loading,
    error,
    refetch,
  } = useQuery<{ getUserChats: Chat[] }>(GET_USER_CHATS, {
    // Serve the cache instantly, refresh behind it: the invalidation flag
    // this used to key on died with the sidebar, so a cache-first list went
    // stale the moment a project was created or renamed elsewhere.
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
    skip: !isAuthorized,
  });

  const handleRefetch = useCallback(async () => {
    try {
      return await refetch();
    } catch {
      // Apollo exposes the failure through error; callers can safely retry
      // without also creating an unhandled promise rejection.
      return undefined;
    }
  }, [refetch]);

  const handleChatListUpdate = useCallback((value: boolean) => {
    setChatListUpdated(value);
  }, []);

  const sortedChats = useMemo(() => {
    const chats = chatData?.getUserChats ?? previousData?.getUserChats ?? [];
    return [...chats].sort(
      (a: Chat, b: Chat) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [chatData?.getUserChats, previousData?.getUserChats]);

  return {
    chats: sortedChats,
    loading,
    error,
    chatListUpdated,
    setChatListUpdated: handleChatListUpdate,
    refetchChats: handleRefetch,
  };
}
