import { useCallback, useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { FiAlertTriangle, FiCheckCircle, FiInfo, FiX, FiXCircle } from "react-icons/fi";

import { subscribeToasts, type ToastItem, type ToastType } from "../helper/toast";

import "../style/toast.css";

const TOAST_EXIT_MS = 250;

const TOAST_ICONS: Record<ToastType, ReactNode> = {
    success: <FiCheckCircle aria-hidden="true" />,
    error: <FiXCircle aria-hidden="true" />,
    warning: <FiAlertTriangle aria-hidden="true" />,
    info: <FiInfo aria-hidden="true" />,
};

const TOAST_TITLES: Record<ToastType, string> = {
    success: "Success",
    error: "Error",
    warning: "Warning",
    info: "Heads up",
};

interface ToastCardProps {
    item: ToastItem;
    onRemove: (id: number) => void;
}

function ToastCard({ item, onRemove }: ToastCardProps) {
    const [leaving, setLeaving] = useState(false);

    const remove = useCallback(() => {
        setLeaving(true);
        window.setTimeout(() => onRemove(item.id), TOAST_EXIT_MS);
    }, [item.id, onRemove]);

    // Auto-dismiss after the toast duration, then animate out.
    useEffect(() => {
        const timer = window.setTimeout(remove, item.duration);
        return () => window.clearTimeout(timer);
    }, [item.duration, remove]);

    return (
        <div
            className={`toast toast--${item.type}${leaving ? " toast--leaving" : ""}`}
            role="status"
            style={{ "--toast-duration": `${item.duration}ms` } as CSSProperties}
        >
            <span className="toast__icon">{TOAST_ICONS[item.type]}</span>
            <div className="toast__content">
                <p className="toast__title">{TOAST_TITLES[item.type]}</p>
                <p className="toast__message">{item.message}</p>
            </div>
            <button type="button" className="toast__close" onClick={remove} aria-label="Dismiss notification">
                <FiX aria-hidden="true" />
            </button>
            <span className="toast__progress" aria-hidden="true" />
        </div>
    );
}

export default function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    useEffect(() => {
        return subscribeToasts((item) => {
            setToasts((prev) => [...prev, item]);
        });
    }, []);

    const removeToast = useCallback((id: number) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    return (
        <>
            {children}
            <div className="toast-container" aria-live="polite" aria-label="Notifications">
                {toasts.map((item) => (
                    <ToastCard key={item.id} item={item} onRemove={removeToast} />
                ))}
            </div>
        </>
    );
}
