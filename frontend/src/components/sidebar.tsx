'use client';

import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { memo, useCallback, useContext, useState } from 'react';
import SidebarSkeleton from './sidebar-skeleton';
import UserSettingsBar from './user-settings-bar';
import { SideBarItem } from './sidebar-item';
import { Chat } from '@/graphql/type';
import { EventEnum } from '../const/EventEnum';
import { useRouter } from 'next/navigation';
import { FixedSizeList, ListChildComponentProps } from 'react-window';

import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
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
import { HomeIcon } from '@radix-ui/react-icons';
import { redirectChatPage } from './chat-page-navigation';
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

interface ChatRowData {
  chats: Chat[];
  currentChatId: string;
  onSelect: (chatId: string) => void;
  onRefetch: () => void;
}

interface ChatRowProps extends ListChildComponentProps {
  data: ChatRowData;
}

// Row renderer for react-window
const ChatRow = memo(
  ({ index, style, data }: ChatRowProps) => {
    const { onSelect, chats, currentChatId, onRefetch } = data;
    const chat = chats[index];

    return (
      <div style={style}>
        <SideBarItem
          key={chat.id}
          id={chat.id}
          currentChatId={currentChatId}
          title={chat.title}
          onSelect={() => onSelect(chat.id)}
          refetchChats={onRefetch}
        />
      </div>
    );
  },
  (prevProps: ChatRowProps, nextProps: ChatRowProps) => {
    // Only re-render if chatId or currentChatId changes
    return (
      prevProps.data.chats[prevProps.index].id ===
        nextProps.data.chats[nextProps.index].id &&
      prevProps.data.currentChatId === nextProps.data.currentChatId
    );
  }
);

ChatRow.displayName = 'ChatRow';

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
  const { setChatId } = useContext(ProjectContext);

  const handleChatSelect = useCallback(
    (chatId: string) => {
      redirectChatPage(chatId, setCurrentChatid, setChatId, router);
    },
    [router, setChatId]
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
      className="relative flex flex-col h-full justify-between bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 font-sans"
    >
      <Sidebar
        collapsible="icon"
        side="left"
        // Give the sidebar a border on the right to match the rest of the layout
        className="border-r flex-col  border-gray-200 dark:border-gray-700"
      >
        {/* Header Row */}
        <div
          className={`flex items-center ${
            isCollapsed ? 'justify-center w-full px-0' : 'justify-between px-3'
          } pt-3`}
        >
          {!isCollapsed && (
            <div className="flex flex-1 items-center justify-between">
              {/* Logo + Title */}
              <Button
                onClick={() => router.push('/')}
                variant="ghost"
                className="inline-flex items-center gap-2 pl-0 rounded-md"
              >
                <Image
                  src="/codefox.svg"
                  alt="CodeFox Logo"
                  width={36}
                  height={36}
                  className="dark:invert"
                />
                <span className="text-primary-500 font-semibold text-base">
                  CodeFox
                </span>
              </Button>

              {/* Collapse Trigger */}
              <SidebarTrigger
                className="flex items-center justify-center w-10 h-10 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={() => setIsCollapsed(!isCollapsed)}
              />
            </div>
          )}

          {isCollapsed && (
            <SidebarTrigger
              className="flex items-center justify-center w-full p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              onClick={() => setIsCollapsed(!isCollapsed)}
            />
          )}
        </div>

        {/* Divider Line */}
        <div className="border-t border-gray-200 dark:border-gray-700 my-2 w-full" />

        {/* New Project Button */}
        <div
          className={`flex ${
            isCollapsed ? 'justify-center items-center w-full px-0' : ''
          } w-full mt-3`}
        >
          <Button
            onClick={() => {
              router.push('/');
              // if (isCollapsed) {
              //   router.push('/');
              // } else {
              //   setIsModalOpen(true);
              // }
            }}
            variant="ghost"
            className={cn(
              'h-9 px-5 text-sm font-medium flex justify-start items-center gap-2 rounded-sm transition-colors  w-full',
              isCollapsed &&
                'justify-center w-11 h-11 px-0 bg-white border-gray-700/30 border dark:bg-gray-800 dark:border-gray-700'
            )}
          >
            <HomeIcon className="h-4 w-4" />
            {!isCollapsed && <span>Home</span>}
          </Button>
        </div>
        {/* Chat List with Virtualization */}
        <SidebarContent className="">
          <SidebarGroup>
            <SidebarGroupContent>
              {!isCollapsed && chats.length > 0 && (
                <FixedSizeList
                  height={Math.min(
                    // Adjust the max height for your layout
                    window.innerHeight - 300,
                    chats.length * 56
                  )}
                  width="100%"
                  itemCount={chats.length}
                  itemSize={56}
                  itemData={{
                    chats,
                    currentChatId: currentChatid,
                    onSelect: handleChatSelect,
                    onRefetch,
                  }}
                >
                  {ChatRow}
                </FixedSizeList>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* Footer Settings */}
        <SidebarFooter
          className={`mt-auto border-t border-gray-200  dark:border-gray-700 ${
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
    <div className="min-h-screen flex bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 font-sans">
      {isAuthorized && (
        <motion.div
          initial={{ x: isCollapsed ? -55 : -250, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: isCollapsed ? -55 : -250, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 80, damping: 20 }}
          className="fixed left-0 top-0 h-full z-50"
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
        </motion.div>
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
