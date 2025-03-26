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
      className="w-[360px] p-4 rounded-xl bg-green-50 dark:bg-green-900 text-green-800 dark:text-green-100 shadow-lg flex flex-col gap-2 relative"
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 30, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
    >
      {/* Close button */}
      <button
        onClick={close}
        className="absolute top-2 right-2 text-green-500 hover:text-green-700 dark:hover:text-green-300"
      >
        <X size={18} />
      </button>

      {/* Title */}
      <p className="text-base font-semibold text-center mt-2">
        🎉 Project is ready!
      </p>

      {/* Centered Button */}
      <div className="flex justify-center mt-2">
        <button
          onClick={() => {
            redirectChatPage(chatId, setCurrentChatid, setChatId, router);
            close();
          }}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-all"
        >
          Open Chat
        </button>
      </div>
    </motion.div>
  );
};
