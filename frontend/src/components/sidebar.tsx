'use client';

import { FoxMark } from '@/components/root/fox-mark';
import { Wordmark } from '@/components/root/wordmark';
import { Button } from '@/components/ui/button';
import { memo, useCallback, useContext, useState } from 'react';
import SidebarSkeleton from './sidebar-skeleton';
import UserSettingsBar from './user-settings-bar';
import { SideBarItem } from './sidebar-item';
import { Chat } from '@/graphql/type';
import { EventEnum } from '../const/EventEnum';
import { useRouter } from 'next/navigation';

import {
  SidebarContent,
  SidebarTrigger,
  Sidebar,
  SidebarRail,
  SidebarFooter,
  useSidebar,
} from './ui/sidebar';
import { ProjectContext } from './chat/code-engine/project-context';
import { motion } from 'framer-motion';
import { logger } from '@/app/log/logger';
import { useChatList } from '@/hooks/useChatList';
import { cn } from '@/lib/utils';
import { PlusIcon } from 'lucide-react';

interface SidebarProps {
  setIsModalOpen: (value: boolean) => void;
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
  isMobile: boolean;
  currentChatId?: string;
  chatListUpdated: boolean;
  setChatListUpdated: (value: boolean) => void;
  chats: Chat[];
  loading: boolean;
  error: unknown;
  onRefetch: () => void;
}

function ChatSideBarComponent({
  setIsModalOpen,
  isCollapsed,
  setIsCollapsed,
  chats,
  loading,
  error,
  onRefetch,
}: SidebarProps) {
  const router = useRouter();
  const [currentChatid, setCurrentChatid] = useState('');
  const { setCurProject, pollChatProject } = useContext(ProjectContext);

  const handleChatSelect = useCallback(
    (chatId: string) => {
      setCurrentChatid(chatId);
      router.push(`/chat?id=${chatId}`);
      setCurProject(null);
      pollChatProject(chatId).then((p) => {
        setCurProject(p);
      });
      const event = new Event(EventEnum.CHAT);
      window.dispatchEvent(event);
    },
    [router, setCurProject, pollChatProject]
  );

  if (loading) return <SidebarSkeleton />;
  if (error) {
    logger.error('Error loading chats:', error);
    return null;
  }

  return (
    <div
      data-collapsed={isCollapsed}
      // Unified text & background style:
      className="relative flex flex-col h-full justify-between bg-background text-foreground font-sans"
    >
      <Sidebar
        collapsible="icon"
        side="left"
        // Give the sidebar a border on the right to match the rest of the layout
        className="flex-col border-r border-border"
      >
        {/* Header Row */}
        <div
          className={
            isCollapsed
              ? 'flex flex-col items-center gap-1 px-2 pt-3'
              : 'flex h-14 items-center justify-between gap-1 px-3'
          }
        >
          <button
            type="button"
            onClick={() => router.push('/')}
            aria-label="CodeFox home"
            tabIndex={-1}
            className="flex h-9 items-center rounded-md transition-opacity hover:opacity-80"
          >
            {isCollapsed ? (
              <FoxMark className="h-5 w-5 text-foreground" />
            ) : (
              <Wordmark />
            )}
          </button>

          {/* Always reachable — collapsing must be reversible. */}
          <SidebarTrigger
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-accent"
            onClick={() => setIsCollapsed(!isCollapsed)}
          />
        </div>

        <div className="w-full border-t border-border" />

        {/* Primary action */}
        <div
          className={`mt-2 ${isCollapsed ? 'flex justify-center px-2' : 'px-3'}`}
        >
          <button
            type="button"
            onClick={() => router.push('/')}
            title="New project"
            className={cn(
              'flex h-9 items-center rounded-md text-sm font-medium transition-colors hover:bg-accent',
              isCollapsed ? 'w-9 justify-center' : 'w-full justify-start'
            )}
          >
            <span className="flex w-5 shrink-0 justify-center">
              <PlusIcon
                className="h-5 w-5"
                style={{ color: 'hsl(var(--primary))' }}
              />
            </span>
            {!isCollapsed && <span className="ml-2">New project</span>}
          </button>
        </div>

        {/* Chat list. A plain scroll container: the virtualized version sized
            itself from `window.innerHeight - 300`, which was wrong at every
            viewport but one and never updated on resize. */}
        <SidebarContent className="mt-3">
          {!isCollapsed && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-baseline justify-between px-3 pb-1">
                <span className="font-mono text-[10px] tracking-[0.12em] text-primary">
                  RECENT
                </span>
                {chats.length > 0 && (
                  <span className="font-mono text-[10px] text-muted-foreground/70">
                    {chats.length}
                  </span>
                )}
              </div>

              {chats.length === 0 ? (
                <p className="px-3 py-2 text-[13px] text-muted-foreground">
                  No projects yet.
                </p>
              ) : (
                <div className="flex flex-col gap-px overflow-y-auto px-3">
                  {chats.map((chat) => (
                    <SideBarItem
                      key={chat.id}
                      id={chat.id}
                      currentChatId={currentChatid}
                      title={chat.title}
                      createdAt={chat.createdAt}
                      onSelect={handleChatSelect}
                      refetchChats={onRefetch}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </SidebarContent>

        {/* Footer Settings */}
        <SidebarFooter
          className={`mt-auto border-t border-border ${
            isCollapsed ? 'flex justify-center items-center  px-0' : 'px-3'
          }`}
        >
          <UserSettingsBar isSimple={false} />
        </SidebarFooter>

        <SidebarRail
          setIsSimple={() => setIsCollapsed(!isCollapsed)}
          isSimple={false}
        />
      </Sidebar>
    </div>
  );
}

export const ChatSideBar = memo(
  ChatSideBarComponent,
  (prevProps: SidebarProps, nextProps: SidebarProps) => {
    if (prevProps.isCollapsed !== nextProps.isCollapsed) return false;
    if (prevProps.loading !== nextProps.loading) return false;
    if (prevProps.error !== nextProps.error) return false;
    if (prevProps.chats.length !== nextProps.chats.length) return false;

    // Compare chat IDs only
    const prevIds = prevProps.chats.map((chat) => chat.id).join(',');
    const nextIds = nextProps.chats.map((chat) => chat.id).join(',');
    return prevIds === nextIds;
  }
);

ChatSideBar.displayName = 'ChatSideBar';

export function SidebarWrapper({
  children,
  isAuthorized,
}: {
  children: React.ReactNode;
  isAuthorized: boolean;
}) {
  const { state, setOpen } = useSidebar();
  const [isCollapsed, setIsCollapsed] = useState(state === 'collapsed');
  const {
    chats,
    loading,
    error,
    chatListUpdated,
    setChatListUpdated,
    refetchChats,
  } = useChatList();

  // Toggle sidebar collapsed
  const handleCollapsedChange = useCallback(
    (collapsed: boolean) => {
      setIsCollapsed(collapsed);
      setOpen(!collapsed);
    },
    [setOpen]
  );

  return (
    <div className="min-h-screen flex bg-background text-foreground font-sans">
      {/* Persistent chrome: it should already be there, not fly in on every
          navigation. Width still animates when you collapse it. */}
      {isAuthorized && (
        <div
          className="fixed left-0 top-0 z-50 h-full transition-[width] duration-300"
          style={{ width: isCollapsed ? '55px' : '250px' }}
        >
          <ChatSideBar
            setIsModalOpen={() => {}}
            isCollapsed={isCollapsed}
            setIsCollapsed={handleCollapsedChange}
            isMobile={false}
            currentChatId={''}
            chatListUpdated={chatListUpdated}
            setChatListUpdated={setChatListUpdated}
            chats={chats}
            loading={loading}
            error={error}
            onRefetch={refetchChats}
          />
        </div>
      )}
      <div
        className="transition-all duration-300 flex justify-center w-full"
        style={{
          marginLeft: isAuthorized ? (isCollapsed ? '55px' : '250px') : '0px',
        }}
      >
        <div className="w-full">{children}</div>
      </div>
    </div>
  );
}
