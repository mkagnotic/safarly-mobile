/**
 * Admin-only accounts never sign in to the app (client, 4 Nov 2026). The app has
 * no admin console, so an admin account fell through to customer onboarding.
 * Same rule as the web customer login (RoleLogin.tsx): an account holding the
 * admin role and NOT the customer ("user") role is refused and signed out.
 * Pure, so it can be tested without the Supabase client.
 */
export const ADMIN_ACCOUNT_MESSAGE = "This account is an admin account. Please use the admin login on the website.";

export function isAdminOnlyAccount(roles: ReadonlyArray<string | null | undefined>): boolean {
  const set = new Set(roles.filter(Boolean));
  return set.has("admin") && !set.has("user");
}
