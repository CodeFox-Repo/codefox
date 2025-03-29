'use client';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { redirectChatPage } from './chat-page-navigation';

interface ProjectReadyToastProps {
  chatId: string;
  close: () => void;
  router: AppRouterInstance;
  setCurrentChatid: (id: string) => void;
  setChatId: (id: string) => void;
}

export const ProjectReadyToast = ({
  chatId,
  close,
  router,
  setCurrentChatid,
  setChatId,
}: ProjectReadyToastProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 40, scale: 0.95 }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 20,
        duration: 0.4,
      }}
      className="fixed bottom-24 right-6 z-[9999] w-[360px] px-5 py-4 
                 bg-white dark:bg-zinc-900 text-gray-800 dark:text-gray-100 
                 border border-gray-200 dark:border-zinc-700 
                 rounded-lg shadow-2xl flex items-center justify-between gap-4"
    >
      {/* Left: Icon + Text */}
      <div className="flex items-center gap-2">
        <div className="bg-green-100 dark:bg-green-800 text-green-600 dark:text-green-300 rounded-full p-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <span className="text-sm font-medium">Project is ready!</span>
      </div>

      {/* Right: Open Chat + Close */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            redirectChatPage(chatId, setCurrentChatid, setChatId, router);
            close();
          }}
          className="text-sm px-3 py-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white transition"
        >
          Open Chat
        </button>
        <button
          onClick={close}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X size={16} />
        </button>
      </div>
    </motion.div>
  );
};
