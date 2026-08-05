import {
  CheckCircleFilled,
  CloseCircleFilled,
  CloseOutlined,
  ExclamationCircleFilled,
  InfoCircleFilled
} from "@ant-design/icons";
import type { CSSProperties, ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type NotificationType = "success" | "error" | "warning" | "info";

type NotificationItem = {
  id: string;
  type: NotificationType;
  title?: string;
  message: string;
  duration: number;
  closing: boolean;
};

type NotificationOptions = {
  title?: string;
  duration?: number;
};

type NotificationApi = {
  success: (message: string, title?: string) => string;
  error: (message: string, title?: string) => string;
  warning: (message: string, title?: string) => string;
  info: (message: string, title?: string) => string;
  show: (type: NotificationType, message: string, options?: NotificationOptions) => string;
  dismiss: (id: string) => void;
};

const DEFAULT_DURATION: Record<NotificationType, number> = {
  success: 3000,
  error: 5000,
  warning: 4000,
  info: 3000
};

const EXIT_DURATION = 240;
const MAX_VISIBLE_NOTIFICATIONS = 5;
const NotificationContext = createContext<NotificationApi | null>(null);

function clearNotificationTimer(timers: Map<string, number>, id: string) {
  const timer = timers.get(id);
  if (timer !== undefined) {
    window.clearTimeout(timer);
    timers.delete(id);
  }
}

function NotificationIcon({ type }: { type: NotificationType }) {
  switch (type) {
    case "success":
      return <CheckCircleFilled />;
    case "error":
      return <CloseCircleFilled />;
    case "warning":
      return <ExclamationCircleFilled />;
    default:
      return <InfoCircleFilled />;
  }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const sequence = useRef(0);
  const expiryTimers = useRef(new Map<string, number>());
  const removalTimers = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    if (removalTimers.current.has(id)) {
      return;
    }

    clearNotificationTimer(expiryTimers.current, id);
    setNotifications((current) => current.map((notification) => (
      notification.id === id ? { ...notification, closing: true } : notification
    )));

    const timer = window.setTimeout(() => {
      removalTimers.current.delete(id);
      setNotifications((current) => current.filter((notification) => notification.id !== id));
    }, EXIT_DURATION);
    removalTimers.current.set(id, timer);
  }, []);

  const show = useCallback((
    type: NotificationType,
    message: string,
    options: NotificationOptions = {}
  ) => {
    const id = `notification-${Date.now()}-${++sequence.current}`;
    const duration = options.duration ?? DEFAULT_DURATION[type];
    const notification: NotificationItem = {
      id,
      type,
      title: options.title,
      message,
      duration,
      closing: false
    };

    setNotifications((current) => {
      const next = [...current, notification];
      if (next.length <= MAX_VISIBLE_NOTIFICATIONS) {
        return next;
      }

      const [oldest, ...visible] = next;
      clearNotificationTimer(expiryTimers.current, oldest.id);
      clearNotificationTimer(removalTimers.current, oldest.id);
      return visible;
    });

    const timer = window.setTimeout(() => dismiss(id), duration);
    expiryTimers.current.set(id, timer);
    return id;
  }, [dismiss]);

  useEffect(() => () => {
    expiryTimers.current.forEach((timer) => window.clearTimeout(timer));
    removalTimers.current.forEach((timer) => window.clearTimeout(timer));
    expiryTimers.current.clear();
    removalTimers.current.clear();
  }, []);

  const api = useMemo<NotificationApi>(() => ({
    success: (message, title) => show("success", message, { title }),
    error: (message, title) => show("error", message, { title }),
    warning: (message, title) => show("warning", message, { title }),
    info: (message, title) => show("info", message, { title }),
    show,
    dismiss
  }), [dismiss, show]);

  return (
    <NotificationContext.Provider value={api}>
      {children}
      {createPortal(<div className="notification-center" aria-live="polite" aria-atomic="false">
        {notifications.map((notification) => (
          <article
            key={notification.id}
            className={`notification-card notification-${notification.type}${notification.title ? " has-title" : ""}${notification.closing ? " is-closing" : ""}`}
            role={notification.type === "error" ? "alert" : "status"}
            style={{ "--notification-duration": `${notification.duration}ms` } as CSSProperties}
          >
            <span className="notification-icon" aria-hidden="true">
              <NotificationIcon type={notification.type} />
            </span>
            <div className="notification-copy">
              {notification.title && <div className="notification-title">{notification.title}</div>}
              <div className="notification-message">{notification.message}</div>
            </div>
            <button
              type="button"
              className="notification-close"
              onClick={() => dismiss(notification.id)}
              aria-label="Close notification"
            >
              <CloseOutlined />
            </button>
            <div className="notification-progress" aria-hidden="true">
              <span className="notification-progress-value" />
            </div>
          </article>
        ))}
      </div>, document.body)}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used inside NotificationProvider");
  }
  return context;
}
