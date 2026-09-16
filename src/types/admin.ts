export type ApplicationNotificationIcon =
  | "book"
  | "clock"
  | "shield"
  | "qr"
  | "chart"
  | "school";
export type ApplicationNotificationTone = "amber" | "blue" | "red" | "neutral";

export interface ApplicationNotification {
  id: string;
  title: string;
  detail: string;
  icon: ApplicationNotificationIcon;
  tone: ApplicationNotificationTone;
}
