# Safarly Mobile: architecture

This doc covers the mobile client. The backend (edge functions, the deal state machine,
payments and escrow, auth and RLS, moderation, notifications) is described in the
**web repo's** `docs/ARCHITECTURE.md`. This app owns no business rules of its own.
It calls the same edge functions as the web app and renders what they return.

```
             ┌───────────────────────────── App.tsx ─────────────────────────────┐
 launch ───► │ useVersionGate ──(below floor)──► UpdateRequiredScreen (nothing else │
             │      │                             mounts: no auth, no data)         │
             │      ▼ ok                                                           │
             │ SafeAreaProvider → AuthProvider → AppFeedbackProvider               │
             │   → NavigationContainer (linking) → RootNavigator (stack + tabs)    │
             └────────────────────────────────────────────────────────────────────┘
   screens (src/features/*) ──► hooks/api/* ──► services/api/* ──► HTTPS
                     ▲                                  ${SUPABASE_URL}/functions/v1/<fn>
                     │ refetch                          Bearer <access token>
   realtimeBus ◄── useRealtimeSync (one channel rt:user:{uid}) ◄── Supabase Realtime
```

## Layers

| Layer | Where | Notes |
|---|---|---|
| Boot | `App.tsx`, `hooks/useVersionGate.ts` | The force-update gate sits above everything. It reads the public `app-config` function and blocks builds below the server's version floor. |
| Auth | `context/AuthContext.tsx`, `integrations/supabase/*`, `services/auth/*` | Supabase Auth session persisted in AsyncStorage. Email + password, Google, and Apple (iOS). `authFetch.ts` keeps a 5xx on token refresh from signing the user out (mirrors the web). |
| API | `services/api/client.ts` + one module per edge function | Mirrors the web's `services/api` surface. It builds auth headers in one place, does a single `401 → refreshSession → retry`, and every call takes an optional `AbortSignal`. |
| Data hooks | `hooks/api/use*.ts` | Plain React hooks (no TanStack Query). They subscribe to `realtimeBus` topics and refetch when those topics change. |
| Realtime | `hooks/realtime/useRealtimeSync.ts`, `store/realtimeBus.ts` | One multiplexed channel per user. Each `postgres_changes` event bumps a topic counter, and subscribed hooks refetch. This fills the role of `invalidateQueries` on the web, and the topic taxonomy matches the web's. |
| State | `store/` (Zustand) | App-wide client state, such as the active conversation. Server data is not cached here. |
| Navigation | `navigation/RootNavigator.tsx`, `linking.ts`, `hooks/usePendingDeepLink.ts` | Native stack + bottom tabs. A cold-start deep link is parked and replayed once the target stack is mounted. Universal links come from `mysafarly.com` / `app.mysafarly.com`. |
| Push | `services/notifications/push.ts`, `hooks/notifications/usePushNotifications.ts`, `services/notifications/notificationRoute.ts` | Registers the Expo push token through `user-handler /me/push-token`. Tapping a notification routes through `resolveNotificationRoute`. Full detail is in [PUSH_NOTIFICATIONS.md](PUSH_NOTIFICATIONS.md). |
| Feedback | `feedback/appFeedback.ts`, `context/AppFeedbackContext.tsx` | `showToast` / `showAppAlert`, callable from anywhere. These replace `Alert.alert`. |
| UI kit | `components/ui/*` | Shared primitives and the platform-difference components. See the README's "Platform differences" section. |

## Rules carried over from the backend

- **The server decides.** Price (`bookings.agreed_amount`), payment gateway, deal
  state and the pinned chat CTA (`active-deal`), and blocked-user filtering all come
  from the API. Don't re-derive them in the client.
- **Payments** open a hosted page (Stripe Checkout or a Razorpay Payment Link) that the
  server creates. The app holds no payment keys.
- **Dates**: SQL `date` columns are parsed as local dates (`utils/`, fenced by
  `utils/dateOnlyColumns.test.ts`).
- **Errors** reach the user only through `lib/userFacingError.js`, which is byte-identical
  with the web copy.

## Docs

- [../README.md](../README.md): setup, environments, EAS builds, platform differences
- [PUSH_NOTIFICATIONS.md](PUSH_NOTIFICATIONS.md): push architecture, credentials, testing.
  Its TL;DR, which says push is blocked on `eas init`, predates the setup: `extra.eas.projectId`
  is now set in `app.json`. Check the EAS credentials before trusting the rest of that status.
- Web repo `README.md` and `docs/ARCHITECTURE.md`: backend, CI/CD, deal lifecycle
