import { db } from "@/db";
import { applicationEvents, interviews } from "@/db/schema";

export type NotificationType =
  | "new_match"
  | "application_submitted"
  | "application_status_change"
  | "interview_scheduled"
  | "interview_reminder"
  | "offer_received"
  | "rejection"
  | "captcha_detected"
  | "automation_error"
  | "daily_summary";

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: Date;
};

// In-memory notification store (would be DB table in production)
const notifications: Notification[] = [];

export function createNotification(
  type: NotificationType,
  title: string,
  message: string,
  link?: string
): Notification {
  const notification: Notification = {
    id: crypto.randomUUID(),
    type,
    title,
    message,
    link,
    read: false,
    createdAt: new Date(),
  };
  notifications.unshift(notification);

  // Keep only last 100
  if (notifications.length > 100) notifications.pop();

  return notification;
}

export function getNotifications(limit: number = 20): Notification[] {
  return notifications.slice(0, limit);
}

export function getUnreadCount(): number {
  return notifications.filter((n) => !n.read).length;
}

export function markAsRead(id: string): boolean {
  const n = notifications.find((n) => n.id === id);
  if (n) {
    n.read = true;
    return true;
  }
  return false;
}

export function markAllAsRead(): void {
  notifications.forEach((n) => (n.read = true));
}

// Helper to send notifications for common events
export async function notifyApplicationStatusChange(
  applicationId: string,
  oldStatus: string,
  newStatus: string,
  jobTitle: string,
  company: string
) {
  const typeMap: Record<string, NotificationType> = {
    submitted: "application_submitted",
    interview: "interview_scheduled",
    offer: "offer_received",
    rejected: "rejection",
  };

  const notifType = typeMap[newStatus] || "application_status_change";

  createNotification(
    notifType,
    `Application ${newStatus.replace("_", " ")}`,
    `Your application for ${jobTitle} at ${company} is now: ${newStatus.replace("_", " ")}`,
    `/applications/${applicationId}`
  );
}

export async function notifyCaptchaDetected(
  applicationId: string,
  jobTitle: string,
  captchaType: string
) {
  createNotification(
    "captcha_detected",
    "CAPTCHA Detected - Manual Action Required",
    `CAPTCHA (${captchaType}) detected while applying for ${jobTitle}. Please complete it manually.`,
    `/applications/${applicationId}`
  );
}