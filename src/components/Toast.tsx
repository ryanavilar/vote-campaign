"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { CheckCircle, XCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
});

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-20 sm:bottom-6 right-4 z-[200] flex flex-col gap-2 max-w-sm">
        {toasts.map((toast) => {
          const icons = {
            success: <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />,
            error: <XCircle className="w-4 h-4 text-red-500 shrink-0" />,
            info: <Info className="w-4 h-4 text-[#0B27BC] shrink-0" />,
          };

          const bgColors = {
            success: "bg-emerald-50 border-emerald-200",
            error: "bg-red-50 border-red-200",
            info: "bg-blue-50 border-[#0B27BC]/20",
          };

          return (
            <div
              key={toast.id}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl border shadow-lg animate-in slide-in-from-right ${bgColors[toast.type]}`}
            >
              {icons[toast.type]}
              <p className="text-sm font-medium text-foreground flex-1">{toast.message}</p>
              <button onClick={() => removeToast(toast.id)} className="shrink-0">
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
