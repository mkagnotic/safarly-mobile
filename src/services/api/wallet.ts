import { api } from "./client";

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  currency: string;
  updated_at: string;
}

export interface SavedCard {
  id: string;
  last4: string;
  brand: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
}

export interface Earnings {
  total_earned: number;
  available_balance: number;
  pending_payouts: number;
  currency: string;
}

export const walletApi = {
  getBalance: () => api.get<Wallet>("/wallet-handler/"),

  addFunds: (amount: number) =>
    api.post<{ new_balance: number }>("/wallet-handler/add-funds", { amount }),

  withdraw: (amount: number) =>
    api.post<{ payout_id: string; status: string }>("/wallet-handler/withdraw", { amount }),

  listCards: () => api.get<SavedCard[]>("/wallet-handler/cards"),

  addCard: (payment_method_id: string) =>
    api.post<SavedCard>("/wallet-handler/cards", { payment_method_id }),

  removeCard: (id: string) =>
    api.delete<{ removed: boolean }>(`/wallet-handler/cards/${id}`),

  setDefaultCard: (id: string) =>
    api.put<{ is_default: boolean }>(`/wallet-handler/cards/${id}/default`),

  getEarnings: () => api.get<Earnings>("/wallet-handler/earnings"),
};
