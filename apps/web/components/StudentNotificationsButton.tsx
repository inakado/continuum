"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Bell, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { studentApi, type StudentNotification } from "@/lib/api/student";
import { contentQueryKeys } from "@/lib/query/keys";
import styles from "./student-dashboard-shell.module.css";

type PopoverPosition = {
  left: number;
  top: number;
};

const getPayloadString = (payload: Record<string, unknown>, key: string) => {
  const value = payload[key];
  return typeof value === "string" ? value : null;
};

const getNotificationMeta = (notification: StudentNotification) => {
  if (notification.type !== "photo_reviewed") {
    return {
      title: "Событие в курсе",
      description: "Откройте курс, чтобы посмотреть детали.",
      icon: Clock3,
      tone: "neutral" as const,
    };
  }

  const status = getPayloadString(notification.payload, "status");
  const hasFeedback = Boolean(getPayloadString(notification.payload, "teacherFeedbackBoardAssetKey"));

  if (status === "accepted") {
    return {
      title: "Задача принята",
      description: hasFeedback ? "Учитель оставил разбор на доске." : "Ответ проверен учителем.",
      icon: CheckCircle2,
      tone: "success" as const,
    };
  }

  return {
    title: "Задача требует правок",
    description: hasFeedback ? "Откройте разбор и исправьте недочеты." : "Ответ отклонен учителем.",
    icon: XCircle,
    tone: "danger" as const,
  };
};

const getNotificationHref = (notification: StudentNotification) => {
  const unitId = getPayloadString(notification.payload, "unitId");
  if (!unitId) return "/student";

  const taskId = getPayloadString(notification.payload, "taskId");
  const search = taskId ? `?taskId=${encodeURIComponent(taskId)}` : "";
  return `/student/units/${unitId}${search}`;
};

const getToneClassName = (tone: "neutral" | "success" | "danger") => {
  if (tone === "success") return styles.notificationToneSuccess;
  if (tone === "danger") return styles.notificationToneDanger;
  return styles.notificationToneNeutral;
};

const formatNotificationTime = (value: string) =>
  new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function StudentNotificationsButton() {
  const [open, setOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const popoverId = useId();
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: contentQueryKeys.studentNotifications(),
    queryFn: () => studentApi.listNotifications(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) => studentApi.markNotificationRead(notificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: contentQueryKeys.studentNotifications(),
        exact: true,
      });
    },
  });

  const notifications = notificationsQuery.data?.items ?? [];
  const activeCount = notificationsQuery.data?.activeCount ?? 0;
  const badgeLabel = activeCount > 9 ? "9+" : String(activeCount);

  const updatePopoverPosition = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const gap = 12;
    const width = Math.min(360, Math.max(280, window.innerWidth - 24));
    const opensRight = rect.right + gap + width <= window.innerWidth;
    const left = opensRight ? rect.right + gap : Math.max(12, window.innerWidth - width - 12);
    const top = Math.min(Math.max(12, rect.top), Math.max(12, window.innerHeight - 520 - 12));
    setPopoverPosition({ left, top });
  }, []);

  const handleToggle = useCallback(() => {
    setOpen((value) => !value);
  }, []);

  const handleNotificationClick = useCallback(
    (notification: StudentNotification) => {
      setOpen(false);
      if (!notification.readAt) {
        markReadMutation.mutate(notification.id);
      }
    },
    [markReadMutation],
  );

  useEffect(() => {
    if (!open) return;
    updatePopoverPosition();

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
      if (target && popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [open, updatePopoverPosition]);

  const content = useMemo(() => {
    if (notificationsQuery.isError) {
      return (
        <div className={styles.notificationsState}>
          <span>Не удалось загрузить события.</span>
          <button
            type="button"
            className={styles.notificationsRetry}
            onClick={() => void notificationsQuery.refetch()}
          >
            Повторить
          </button>
        </div>
      );
    }

    if (notificationsQuery.isPending) {
      return <div className={styles.notificationsState}>Загрузка событий...</div>;
    }

    if (notifications.length === 0) {
      return <div className={styles.notificationsState}>Новых событий нет.</div>;
    }

    return notifications.map((notification) => {
      const meta = getNotificationMeta(notification);
      const Icon = meta.icon;
      return (
        <Link
          key={notification.id}
          href={getNotificationHref(notification)}
          className={`${styles.notificationItem} ${!notification.readAt ? styles.notificationItemUnread : ""}`}
          onClick={() => handleNotificationClick(notification)}
        >
          <span className={`${styles.notificationItemIcon} ${getToneClassName(meta.tone)}`}>
            <Icon size={17} strokeWidth={2} aria-hidden="true" />
          </span>
          <span className={styles.notificationItemBody}>
            <span className={styles.notificationItemTitle}>{meta.title}</span>
            <span className={styles.notificationItemText}>{meta.description}</span>
            <span className={styles.notificationItemTime}>{formatNotificationTime(notification.createdAt)}</span>
          </span>
        </Link>
      );
    });
  }, [handleNotificationClick, notifications, notificationsQuery]);

  const popover =
    open && popoverPosition
      ? createPortal(
          <div
            ref={popoverRef}
            id={popoverId}
            className={styles.notificationsPopover}
            style={{ left: popoverPosition.left, top: popoverPosition.top }}
            role="dialog"
            aria-label="События"
          >
            <div className={styles.notificationsHeader}>
              <span>События</span>
              {activeCount > 0 ? <span>{activeCount} новых</span> : <span>Все прочитано</span>}
            </div>
            <div className={styles.notificationsList}>{content}</div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={styles.notificationRoot}>
      <button
        type="button"
        className={`${styles.sidebarIconAction} ${styles.notificationButton}`}
        aria-label={activeCount > 0 ? `События, непрочитанных: ${activeCount}` : "События"}
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={handleToggle}
        title="События"
      >
        <Bell className={styles.navIcon} aria-hidden="true" strokeWidth={1.8} />
        {activeCount > 0 ? <span className={styles.notificationBadge}>{badgeLabel}</span> : null}
      </button>
      {popover}
    </div>
  );
}
