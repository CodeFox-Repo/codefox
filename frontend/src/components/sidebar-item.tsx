'use client';

import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DELETE_CHAT, DELETE_PROJECT, GET_CHAT_DETAILS } from '@/graphql/request';
import { cn } from '@/lib/utils';
import { useMutation, useLazyQuery } from '@apollo/client';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { memo, useContext, useState } from 'react';
import { toast } from 'sonner';
import { EventEnum } from '../const/EventEnum';
import { logger } from '@/app/log/logger';
import { ProjectContext } from './chat/code-engine/project-context';
import { motion } from 'framer-motion';

interface SideBarItemProps {
  id: string;
  currentChatId: string;
  title: string;
  onSelect: (id: string) => void;
  refetchChats: () => void;
}

function SideBarItemComponent({
  id,
  currentChatId,
  title,
  onSelect,
  refetchChats,
}: SideBarItemProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const router = useRouter();
  const { recentlyCompletedProjectId, setPendingProjects } = useContext(ProjectContext);
  const isGenerating = id === recentlyCompletedProjectId;
  const isSelected = currentChatId === id;
  const variant = isSelected ? 'secondary' : 'ghost';

  const [getChatDetails] = useLazyQuery(GET_CHAT_DETAILS);
  
  const [deleteProject] = useMutation(DELETE_PROJECT, {
    onCompleted: () => {
      logger.info('Project deleted successfully');
    },
    onError: (error) => {
      logger.error('Error deleting project:', error);
      toast.error('Failed to delete associated project');
    },
  });

  const [deleteChat] = useMutation(DELETE_CHAT, {
    onCompleted: () => {
      toast.success('Chat and associated project deleted successfully');
      if (isSelected) {
        router.push('/');
        const event = new Event(EventEnum.NEW_CHAT);
        window.dispatchEvent(event);
      }
      // Remove from pendingProjects
      setPendingProjects((prev) => prev.filter((p) => p.id !== id));
      // Dispatch project-deleted event
      window.dispatchEvent(new Event('project-deleted'));
      refetchChats();
    },
    onError: (error) => {
      logger.error('Error deleting chat:', error);
      toast.error('Failed to delete chat');
    },
  });

  const handleDeleteChat = async () => {
    try {
      const chatDetailsResult = await getChatDetails({
        variables: { chatId: id }
      });
      
      const projectId = chatDetailsResult?.data?.getChatDetails?.project?.id;
      
      await deleteChat({
        variables: {
          chatId: id,
        },
        update: (cache) => {
          // Remove the deleted chat from Apollo cache
          cache.evict({ id: `Chat:${id}` });
          cache.gc();
        },
      });
      
      if (projectId) {
        try {
          await deleteProject({
            variables: { projectId },
            update: (cache) => {
              // 清除项目缓存
              cache.evict({ id: `Project:${projectId}` });
              cache.gc();
            }
          });
        } catch (projectError) {
          logger.error('Error deleting associated project:', projectError);
        }
      }
      
      setIsDialogOpen(false);
    } catch (error) {
      logger.error('Error deleting chat:', error);
      toast.error('Failed to delete chat');
    }
  };

  const handleChatClick = (e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest('.dropdown-trigger')) {
      onSelect(id);
    }
  };

  return (
    <motion.div
      initial={false}
      animate={{
        backgroundColor: isGenerating
          ? 'rgba(209, 213, 219, 0.5)' // gray-300 with transparency
          : 'transparent',
      }}
      transition={{ duration: 0.3 }}
      className="relative rounded-lg"
    >
      <button
        className={cn(
          buttonVariants({ variant }),
          'relative flex w-full h-14 text-base font-normal items-center group px-2'
        )}
        onClick={handleChatClick}
      >
        <div className="flex-1 flex items-center truncate ml-2 mr-12 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-normal truncate">
              {title || 'New Chat'}
            </span>
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 w-10 h-10 rounded-md hover:bg-gray-200 dropdown-trigger"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <MoreHorizontal size={15} className="shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DialogTrigger
                asChild
                onClick={() => {
                  setIsDropdownOpen(false);
                  setIsDialogOpen(true);
                }}
              >
                <Button
                  variant="ghost"
                  className="w-full flex hover:text-red-500 text-red-500 justify-start items-center"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <Trash2 className="shrink-0 w-4 h-4" />
                  Delete chat
                </Button>
              </DialogTrigger>
            </DropdownMenuContent>
          </DropdownMenu>
          <DialogContent>
            <DialogHeader className="space-y-4">
              <DialogTitle>Delete chat?</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this chat? This action cannot be
                undone.
              </DialogDescription>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDeleteChat();
                  }}
                >
                  Delete
                </Button>
              </div>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </button>
    </motion.div>
  );
}

export const SideBarItem = memo(
  SideBarItemComponent,
  (prevProps, nextProps) => {
    return (
      prevProps.currentChatId === nextProps.currentChatId &&
      prevProps.id === nextProps.id &&
      prevProps.title === nextProps.title
    );
  }
);
