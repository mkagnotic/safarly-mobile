export type ToastVariant = "success" | "error" | "warning" | "info";

export type ToastPayload = {
  title: string;
  message?: string;
  variant?: ToastVariant;
  /** Auto-dismiss ms (default 3400). */
  duration?: number;
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
