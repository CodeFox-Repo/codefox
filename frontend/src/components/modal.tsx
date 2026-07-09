'use client';

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function StableModal({
  isOpen,
  onClose,
  title,
  children,
  className = '',
}: ModalProps) {
  // Use ref to track if modal is mounted
  const modalRoot = useRef<HTMLElement | null>(null);

  // Handle clicks outside to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (isOpen && e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Use useEffect to get or create portal container
  useEffect(() => {
    if (typeof window !== 'undefined') {
      let element = document.getElementById('modal-root');

      if (!element) {
        element = document.createElement('div');
        element.id = 'modal-root';
        document.body.appendChild(element);
      }

      modalRoot.current = element;

      // Clean up when component unmounts
      return () => {
        if (element && element.childNodes.length === 0) {
          document.body.removeChild(element);
        }
      };
    }
  }, []);

  // Don't render anything on server side
  if (typeof window === 'undefined' || !modalRoot.current) {
    return null;
  }

  // Use createPortal to render modal content at the end of body
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Background overlay */}
          <motion.div
            className="absolute inset-0 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleBackdropClick}
          />

          {/* Modal content */}
          <motion.div
            className={`relative bg-white dark:bg-gray-900 rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-auto z-10 ${className}`}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
          >
            {/* Title bar (if provided) */}
            {title && (
              <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
                <h2 className="text-lg font-semibold">{title}</h2>
                <button
                  onClick={onClose}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            )}

            {/* Content area */}
            <div className={!title ? 'pt-4' : ''}>{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    modalRoot.current
  );
}
