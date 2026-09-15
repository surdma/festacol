export type AdminTopbarNotificationIcon = "book" | "clock" | "shield" | "qr";
export type AdminTopbarNotificationTone = "amber" | "blue" | "red" | "neutral";

export interface AdminTopbarNotification {
  href: string;
  title: string;
  detail: string;
  icon: AdminTopbarNotificationIcon;
  tone: AdminTopbarNotificationTone;
}
