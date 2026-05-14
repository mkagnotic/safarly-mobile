import type { AppAlertOptions, ToastPayload } from "@/feedback/types";

type FeedbackApi = {
  showToast: (payload: ToastPayload) => void;
  showAlert: (options: AppAlertOptions) => void;
};

let feedback: FeedbackApi | null = null;

export function registerAppFeedback(api: FeedbackApi | null) {
  feedback = api;
}

/** Themed transient notice (replaces system Alert for simple messages). */
export function showToast(payload: ToastPayload) {
  feedback?.showToast(payload);
}

/** Themed modal with actions (replaces system Alert with multiple buttons). */
export function showAppAlert(options: AppAlertOptions) {
  feedback?.showAlert(options);
}

export type { AppAlertAction, AppAlertOptions, ToastPayload, ToastVariant } from "@/feedback/types";
