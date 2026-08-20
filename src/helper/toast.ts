export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
    id: number;
    type: ToastType;
    message: string;
    duration: number;
}

type ToastListener = (toast: ToastItem) => void;

let nextId = 0;
const listeners = new Set<ToastListener>();

function push(type: ToastType, message: string, duration: number) {
    if (!message) return;
    const trimmed = String(message).trim();
    if (!trimmed) return;

    const item: ToastItem = { id: ++nextId, type, message: trimmed, duration };
    listeners.forEach((listener) => listener(item));
}

export function subscribeToasts(listener: ToastListener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export const toast = {
    success: (message: string, duration = 3500) => push("success", message, duration),
    error: (message: string, duration = 5000) => push("error", message, duration),
    warning: (message: string, duration = 4000) => push("warning", message, duration),
    info: (message: string, duration = 3500) => push("info", message, duration),
};
