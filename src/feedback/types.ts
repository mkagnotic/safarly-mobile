export type ToastVariant = "success" | "error" | "warning" | "info";

export type ToastPayload = {
  title: string;
  message?: string;
  variant?: ToastVariant;
  /** Auto-dismiss ms (default 3400). */
  duration?: number;
  /**
   * Tapping the toast runs this (after it closes). A notification toast uses it to
   * open what the notification is about, as web's toast does; without it a tap
   * only dismisses.
   */
  onPress?: () => void;
};

export type AppAlertAction = {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
};

export type AppAlertOptions = {
  title: string;
  message?: string;
  actions?: AppAlertAction[];
};
