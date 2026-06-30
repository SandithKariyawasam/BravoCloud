"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

interface ConfirmContextType {
  confirm: (options: string | ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({ message: "" });
  const [resolver, setResolver] = useState<{ resolve: (value: boolean) => void } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const confirm = useCallback((opts: string | ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      const formattedOptions = typeof opts === "string" ? { message: opts } : opts;
      setOptions({
        title: "Confirm Action",
        confirmText: "Confirm",
        cancelText: "Cancel",
        destructive: true,
        ...formattedOptions,
      });
      setResolver({ resolve });
      setIsOpen(true);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    if (resolver) resolver.resolve(true);
  }, [resolver]);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    if (resolver) resolver.resolve(false);
  }, [resolver]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {mounted && createPortal(
        <AnimatePresence>
          {isOpen && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-md bg-[#0a0a0a] border border-[#27272a] rounded-2xl shadow-2xl overflow-hidden"
              >
                <div className="p-6 pb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-rose-500/10 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-rose-500" />
                    </div>
                    <h3 className="text-xl font-semibold text-white">{options.title}</h3>
                  </div>
                  <p className="text-gray-400 mt-3 text-[15px] leading-relaxed">
                    {options.message}
                  </p>
                </div>
                
                <div className="px-6 py-5 bg-[#18181b]/50 border-t border-[#27272a] flex justify-end gap-3 mt-2">
                  <button
                    onClick={handleCancel}
                    className="px-5 py-2.5 text-sm font-medium text-gray-300 hover:text-white bg-transparent hover:bg-white/5 rounded-xl transition-colors"
                  >
                    {options.cancelText}
                  </button>
                  <button
                    onClick={handleConfirm}
                    className={`px-5 py-2.5 text-sm font-semibold text-white rounded-xl shadow-lg transition-all ${
                      options.destructive 
                        ? "bg-rose-600 hover:bg-rose-500 shadow-rose-500/20" 
                        : "bg-white text-black hover:bg-gray-200"
                    }`}
                  >
                    {options.confirmText}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (context === undefined) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context.confirm;
}
