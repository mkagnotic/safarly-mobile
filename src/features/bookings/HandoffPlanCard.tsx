import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppInput } from "@/components/ui/AppInput";
import { CountryPicker } from "@/components/ui/CountryPicker";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { showToast } from "@/feedback/appFeedback";
import type { Booking, HandoffAddress, HandoffMode, HandoffPlanInput } from "@/services/api/bookings";
import { colors, primaryTint } from "@/theme/colors";
import { journeyStepLabel, journeyStepRef } from "@/utils/journeySteps";
import { parseOrigin } from "@/utils/originAddress";
import {
  RETURN_COUNTRIES,
  countryCode,
  labelForCountry,
  labelForState,
  postalHint,
  sanitisePhone,
  sanitisePostal,
  statesFor,
  validateCourierAddress,
} from "@/utils/addressOptions";

/**
 * Step 1 of 6 - Handoff (numbering lives in utils/journeySteps). The parcel has
 * to physically reach the CARRIER in the
 * origin city before they travel, and that used to be a single unexplained
 * "Accept Handoff" button: no way to tell the sender where to send it, no record
 * that it had been sent, and nothing to inspect against. Which is why carriers
 * read the handoff phase as the delivery phase.
 *
 * Renders whichever of the three sub-steps the booking is actually in, per role:
 *   1. Coordinate  carrier picks courier-to-my-address or in-person, and shares it
 *   2. Dispatch    sender sends it (with optional tracking) and marks it sent
 *   3. Inspection  carrier checks it over, then accepts/declines (in BookingsScreen)
 *
 * Web parity: `src/customer/components/HandoffPlanCard.tsx`.
 */
export interface HandoffPlanCardProps {
  booking: Booking;
  role: "sender" | "carrier" | "unknown";
  /** Which action is in flight, so the right button spins. */
  pending: "set-handoff-plan" | "mark-handoff-sent" | null;
  onSubmitPlan: (plan: HandoffPlanInput) => void;
  onMarkSent: (args: { tracking_reference?: string; courier?: string }) => void;
}

function formatAddress(address: HandoffAddress | null | undefined): string {
  if (!address) return "";
  // Country/state are stored as codes now (US / IN / MH), same as the return
  // address. Addresses saved before the pickers existed hold free text and pass
  // straight through - a label must never lose a line because the form changed.
  return [
    address.line1,
    address.line2,
    address.city,
    labelForState(address.country ?? "", address.state ?? "") || address.state,
    address.postal_code,
    labelForCountry(address.country ?? "") || address.country,
  ]
    .filter((part) => !!part && String(part).trim().length > 0)
    .join(", ");
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function HandoffPlanCard({
  booking,
  role,
  pending,
  onSubmitPlan,
  onMarkSent,
}: Readonly<HandoffPlanCardProps>) {
  const mode = booking.handoff_mode ?? null;
  const dispatchedAt = booking.handoff_dispatched_at ?? null;
  const address = booking.handoff_address ?? null;
  const isOnlineOrder = Boolean(booking.parcel?.is_online_order);
  const originCity = booking.parcel?.from_city?.trim() || null;
  const carrierName = booking.carrier?.name || "your carrier";
  const senderName = booking.sender?.name || "your sender";
  // The carrier's real name, for pre-filling "Name for the parcel". Falls back
  // to empty rather than the "your carrier" placeholder, which must never end
  // up printed on a shipping label.
  const carrierProfileName = booking.carrier?.name?.trim() ?? "";
  // The listing already knows the route, so pre-fill from it rather than making
  // the carrier retype it. `from_city` is one string ("Mumbai, MH"), which is
  // why the City box used to show the region too and State/Country sat empty.
  const origin = parseOrigin(booking.parcel?.from_city, booking.parcel?.from_country);

  // CountryPicker takes {code,name}; addressOptions speaks {value,label}.
  const countryOptions = useMemo(
    () => RETURN_COUNTRIES.map((c) => ({ code: c.value, name: c.label })),
    [],
  );

  const [editing, setEditing] = useState(false);
  // An online order is normally couriered straight from the seller. The mode is
  // DERIVED until the carrier picks one: a `useState` initialiser only runs on
  // first mount, so freezing it meant a card that mounted before `handoff_mode`
  // arrived kept the wrong default forever.
  const [pickedMode, setPickedMode] = useState<HandoffMode | null>(null);
  const draftMode: HandoffMode = pickedMode ?? mode ?? (isOnlineOrder ? "shipped" : "in_person");
  const setDraftMode = setPickedMode;
  const [line1, setLine1] = useState(address?.line1 ?? "");
  const [line2, setLine2] = useState(address?.line2 ?? "");
  const [city, setCity] = useState(address?.city ?? origin.city);
  const [stateRegion, setStateRegion] = useState(address?.state ?? origin.state);
  const [postal, setPostal] = useState(address?.postal_code ?? "");
  // Codes, not display names: the picker needs "IN", and `parseOrigin` hands
  // back "India" for a label. `countryCode` accepts either.
  const [country, setCountry] = useState(countryCode(address?.country ?? origin.country));
  const [contactName, setContactName] = useState(address?.contact_name ?? carrierProfileName);
  const [contactPhone, setContactPhone] = useState(address?.contact_phone ?? "");
  const stateOptions = useMemo(
    () => statesFor(country).map((st) => ({ code: st.value, name: st.label })),
    [country],
  );
  const [touched, setTouched] = useState(false);
  const [instructions, setInstructions] = useState(booking.handoff_instructions ?? "");
  const [courier, setCourier] = useState(booking.handoff_courier ?? "");
  const [tracking, setTracking] = useState(booking.handoff_tracking_reference ?? "");

  const isCarrier = role === "carrier";

  // Re-seed the form from the CURRENT booking whenever the editor opens.
  const startEditing = () => {
    setPickedMode(mode ?? (isOnlineOrder ? "shipped" : "in_person"));
    setLine1(address?.line1 ?? "");
    setLine2(address?.line2 ?? "");
    setCity(address?.city ?? origin.city);
    setStateRegion(address?.state ?? origin.state);
    setPostal(address?.postal_code ?? "");
    setCountry(countryCode(address?.country ?? origin.country));
    setContactName(address?.contact_name ?? carrierProfileName);
    setContactPhone(address?.contact_phone ?? "");
    setInstructions(booking.handoff_instructions ?? "");
    setTouched(false);
    setEditing(true);
  };

  // `!dispatchedAt` closes the form the moment the sender ships, even if the carrier
  // already had it open - realtime can deliver the dispatch mid-edit, and a form that
  // stays open there invites a submit the server will refuse.
  const showPlanForm = isCarrier && !dispatchedAt && (!mode || editing);

  // A courier label needs all of these to actually reach the carrier, and it
  // needs them to be REAL: the fields used to be free text with a bare presence
  // check, so "test" in every box was a valid address for a parcel someone was
  // about to post. Same rules, same shared module and same messages as the
  // return address on Send Parcel (web parity: `lib/addressOptions.ts`).
  const addressErrors =
    draftMode === "shipped"
      ? validateCourierAddress({
          line1,
          city,
          state: stateRegion,
          postal,
          country,
          contactName,
          contactPhone,
        })
      : {};
  const hasAddressErrors = Object.keys(addressErrors).length > 0;
  // Errors surface only once the carrier has tried to submit.
  const fieldError = (key: keyof typeof addressErrors) =>
    touched ? addressErrors[key] : undefined;

  const submitPlan = () => {
    setTouched(true);
    if (hasAddressErrors) {
      showToast({
        title: "Check the delivery address",
        message: "The highlighted fields need fixing so the parcel can reach you.",
        variant: "error",
      });
      return;
    }
    onSubmitPlan({
      mode: draftMode,
      address:
        draftMode === "shipped"
          ? {
              line1: line1.trim(),
              line2: line2.trim() || undefined,
              city: city.trim(),
              state: stateRegion.trim() || undefined,
              postal_code: postal.trim() || undefined,
              country: country.trim() || undefined,
              contact_name: contactName.trim() || undefined,
              contact_phone: contactPhone.trim() || undefined,
            }
          : undefined,
      instructions: instructions.trim() || undefined,
    });
    setEditing(false);
  };

  const copyAddress = async () => {
    const text = formatAddress(address);
    if (!text) return;
    await Clipboard.setStringAsync(text);
    showToast({ title: "Address copied", variant: "success" });
  };

  const header = (subtitle: string) => (
    <>
      <View style={styles.headerRow}>
        <Ionicons name="location-outline" size={14} color={colors.primary} />
        <Text style={styles.eyebrow}>{journeyStepLabel("handoff")}</Text>
      </View>
      <Text style={styles.title}>{subtitle}</Text>
    </>
  );

  // ── Carrier, sub-step 1: share the plan ────────────────────────────────────
  if (showPlanForm) {
    return (
      <View style={styles.card}>
        {header("Tell your sender how to get the parcel to you")}
        <Text style={styles.body}>
          You receive the parcel first, before you travel. Pick how it reaches you -
          {` ${senderName}`} sees this immediately and the chat records it.
        </Text>

        <View style={styles.modeRow}>
          <Pressable
            onPress={() => setDraftMode("shipped")}
            style={[styles.modeOption, draftMode === "shipped" && styles.modeOptionActive]}
            accessibilityRole="radio"
            accessibilityState={{ selected: draftMode === "shipped" }}
            accessibilityLabel="Courier it to me"
          >
            <Ionicons name="cube-outline" size={16} color={colors.primary} />
            <Text style={styles.modeTitle}>Courier it to me</Text>
            <Text style={styles.modeHint}>
              {isOnlineOrder
                ? "The seller ships straight to your address."
                : "The sender posts it to your local address."}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setDraftMode("in_person")}
            style={[styles.modeOption, draftMode === "in_person" && styles.modeOptionActive]}
            accessibilityRole="radio"
            accessibilityState={{ selected: draftMode === "in_person" }}
            accessibilityLabel="Hand it to me in person"
          >
            <Ionicons name="people-outline" size={16} color={colors.primary} />
            <Text style={styles.modeTitle}>In person</Text>
            <Text style={styles.modeHint}>
              Meet {originCity ? `in ${originCity}` : "in the origin city"} and collect it.
            </Text>
          </Pressable>
        </View>

        {draftMode === "shipped" ? (
          <View style={styles.formBlock}>
            <AppInput
              label={`Your local address${originCity ? ` in ${originCity}` : ""}`}
              value={line1}
              onChangeText={setLine1}
              placeholder="Street address *"
              error={fieldError("line1")}
            />
            <AppInput
              value={line2}
              onChangeText={setLine2}
              placeholder="Apartment, building, landmark (optional)"
            />
            {/* Country first: it decides which states are offered and how the
                postal code is validated. */}
            <CountryPicker
              value={country}
              onChange={(v) => {
                setCountry(v);
                // A state from the previous country would no longer be valid.
                setStateRegion("");
              }}
              placeholder="Country *"
              options={countryOptions}
              invalid={!!fieldError("country")}
            />
            {fieldError("country") ? (
              <Text style={styles.inlineError}>{fieldError("country")}</Text>
            ) : null}

            <CountryPicker
              value={stateRegion}
              onChange={setStateRegion}
              placeholder={country ? "State / region *" : "Select a country first"}
              disabled={!country}
              options={stateOptions}
              invalid={!!fieldError("state")}
            />
            {fieldError("state") ? (
              <Text style={styles.inlineError}>{fieldError("state")}</Text>
            ) : null}

            <AppInput
              value={city}
              // Digits stripped as you type - a city is never a number, and
              // blocking it here beats an error on submit.
              onChangeText={(v) => setCity(v.replace(/[0-9]/g, ""))}
              placeholder="City *"
              autoCapitalize="words"
              error={fieldError("city")}
            />
            <AppInput
              value={postal}
              // Filtered, not just hinted: `keyboardType` only picks the default
              // keyboard - a paste or a hardware keyboard still gets through.
              onChangeText={(v) => setPostal(sanitisePostal(v))}
              placeholder={country === "IN" ? "PIN code *" : "Postal code *"}
              keyboardType="number-pad"
              maxLength={10}
              error={fieldError("postal")}
            />
            {!fieldError("postal") && postalHint(country) ? (
              <Text style={styles.helperText}>{postalHint(country)}</Text>
            ) : null}
            <AppInput
              value={contactName}
              onChangeText={setContactName}
              placeholder="Name for the parcel *"
              autoCapitalize="words"
              maxLength={120}
              error={fieldError("contactName")}
            />
            <AppInput
              value={contactPhone}
              onChangeText={(v) => setContactPhone(sanitisePhone(v))}
              placeholder={country === "IN" ? "Phone, e.g. +91 98765 43210 *" : "Phone for the courier *"}
              keyboardType="phone-pad"
              maxLength={40}
              error={fieldError("contactPhone")}
            />
          </View>
        ) : null}

        <View style={styles.formBlock}>
          <AppInput
            label={draftMode === "shipped" ? "Delivery notes (optional)" : "Where and when to meet"}
            value={instructions}
            onChangeText={setInstructions}
            placeholder={
              draftMode === "shipped"
                ? "e.g. Reception takes parcels 9am-7pm, ring flat 4B"
                : "e.g. Saturday afternoon near Chennai Central"
            }
            multiline
            numberOfLines={3}
            maxLength={1000}
            textAlignVertical="top"
          />
        </View>

        <Pressable
          onPress={submitPlan}
          disabled={pending !== null}
          style={[styles.primaryButton, pending !== null && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel="Share handoff details with your sender"
        >
          {pending === "set-handoff-plan" ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Ionicons name="send" size={14} color={colors.white} />
              <Text style={styles.primaryButtonText}>Share with {senderName}</Text>
            </>
          )}
        </Pressable>
        {mode ? (
          <Pressable
            onPress={() => setEditing(false)}
            style={styles.ghostButton}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.ghostButtonText}>Cancel</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  // ── Sender, sub-step 1: nothing to do yet ──────────────────────────────────
  if (!isCarrier && !mode) {
    return (
      <View style={styles.card}>
        {header(`Waiting for ${carrierName} to say where to send the parcel`)}
        <Text style={styles.body}>
          Your payment is safe in escrow. The parcel has to reach your carrier
          {originCity ? ` in ${originCity}` : ""} before they travel, so they will share
          either a local address to courier it to, or a meetup. You will be notified the
          moment they do - nudge them in the chat if it is urgent.
        </Text>
        <Text style={styles.footnote}>
          No code at handoff. The 6-digit code belongs to {journeyStepRef("delivery")}, and
          goes to whoever receives the parcel.
        </Text>
      </View>
    );
  }

  const addressText = formatAddress(address);
  const planBlock = (
    <View style={styles.planBlock}>
      <View style={styles.headerRow}>
        <Ionicons name={mode === "shipped" ? "cube-outline" : "people-outline"} size={12} color={colors.subtleText} />
        <Text style={styles.planLabel}>
          {mode === "shipped" ? "Courier it to this address" : "Hand it over in person"}
        </Text>
      </View>
      {mode === "shipped" && addressText ? (
        <>
          <Text style={styles.planAddress}>{addressText}</Text>
          <Pressable
            onPress={copyAddress}
            style={styles.copyButton}
            accessibilityRole="button"
            accessibilityLabel="Copy address"
          >
            <Ionicons name="copy-outline" size={12} color={colors.text} />
            <Text style={styles.copyButtonText}>Copy address</Text>
          </Pressable>
        </>
      ) : null}
      {mode === "shipped" && (address?.contact_name || address?.contact_phone) ? (
        <Text style={styles.planMeta}>
          For the courier: {[address?.contact_name, address?.contact_phone].filter(Boolean).join(" · ")}
        </Text>
      ) : null}
      {booking.handoff_instructions ? (
        <Text style={styles.planMeta}>{booking.handoff_instructions}</Text>
      ) : null}
      {booking.handoff_expected_by ? (
        <Text style={styles.planMetaStrong}>Needed by {formatDate(booking.handoff_expected_by)}</Text>
      ) : null}
    </View>
  );

  const trackingLine =
    booking.handoff_tracking_reference || booking.handoff_courier ? (
      <Text style={styles.planMeta}>
        Tracking: {[booking.handoff_courier, booking.handoff_tracking_reference].filter(Boolean).join(" · ")}
      </Text>
    ) : null;

  // ── Sub-step 3: parcel sent. Accept/decline live in BookingsScreen below. ──
  if (dispatchedAt) {
    return (
      <View style={styles.card}>
        {header(
          isCarrier
            ? "The parcel is on its way to you - inspect it when it arrives"
            : `You marked the parcel as sent - ${carrierName} will inspect it on arrival`,
        )}
        {planBlock}
        <Text style={styles.planMetaStrong}>Marked sent {formatDateTime(dispatchedAt)}</Text>
        {trackingLine}
        {!isCarrier ? (
          <Text style={styles.footnote}>
            If they accept, this booking moves to {journeyStepRef("payment")} — you will
            have 48 hours to pay. If they decline after inspecting, you are refunded in full
            {booking.parcel?.return_eligible
              ? " and can have it returned to the seller."
              : " and arrange collection of the parcel."}
          </Text>
        ) : null}
        {/* No edit here, deliberately. The sender has already shipped to this address -
            a label exists and the parcel is in transit - so changing it would leave them
            having sent it somewhere the app no longer shows. The server refuses it too
            (booking-handler, POST /:id/handoff/plan). Say why, rather than offering a
            button that 409s. Web's HandoffPlanCard carries the same block. */}
        {isCarrier ? (
          <View style={styles.lockedNote}>
            <Ionicons name="lock-closed-outline" size={12} color={colors.subtleText} />
            <Text style={styles.lockedNoteText}>
              These details are locked now that the parcel is on its way here. If something
              is wrong, message {senderName} in the chat.
            </Text>
          </View>
        ) : null}
      </View>
    );
  }

  // ── Sub-step 2: plan shared, parcel not sent yet ───────────────────────────
  if (!isCarrier) {
    return (
      <View style={styles.card}>
        {header(mode === "shipped" ? `Send the parcel to ${carrierName}` : `Hand the parcel to ${carrierName}`)}
        {planBlock}
        {mode === "shipped" ? (
          <View style={styles.formBlock}>
            <AppInput value={courier} onChangeText={setCourier} placeholder="Courier (optional)" />
            <AppInput value={tracking} onChangeText={setTracking} placeholder="Tracking number (optional)" />
          </View>
        ) : null}
        <Pressable
          onPress={() =>
            onMarkSent({
              courier: courier.trim() || undefined,
              tracking_reference: tracking.trim() || undefined,
            })
          }
          disabled={pending !== null}
          style={[styles.primaryButton, pending !== null && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel={mode === "shipped" ? "I have sent the parcel" : "I have handed it over"}
        >
          {pending === "mark-handoff-sent" ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Ionicons name="send" size={14} color={colors.white} />
              <Text style={styles.primaryButtonText}>
                {mode === "shipped" ? "I've sent the parcel" : "I've handed it over"}
              </Text>
            </>
          )}
        </Pressable>
        <Text style={styles.footnote}>
          Marking it sent tells {carrierName} to expect it and to inspect it on arrival.
          Your payment stays in escrow until they deliver it.
        </Text>
      </View>
    );
  }

  // Carrier, sub-step 2 - waiting on the sender.
  return (
    <View style={styles.card}>
      {header(`Waiting for ${senderName} to send the parcel`)}
      {planBlock}
      <Text style={styles.footnote}>
        They have been notified. Once they mark it as sent you will be prompted to
        inspect it and then accept or decline - you can also accept right away if it is
        already in your hands.
      </Text>
      <Pressable
        onPress={startEditing}
        style={styles.ghostButton}
        accessibilityRole="button"
        accessibilityLabel="Change the handoff details"
      >
        <Ionicons name="pencil-outline" size={13} color={colors.text} />
        <Text style={styles.ghostButtonText}>Change the handoff details</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Same inline-error / helper treatment as the return address on Send Parcel.
  inlineError: { color: colors.danger, fontSize: 12, lineHeight: 17, fontWeight: "600", marginTop: -4 },
  helperText: { color: colors.mutedText, fontSize: 12, lineHeight: 17, fontWeight: "500", marginTop: -4 },
  card: {
    width: "100%",
    backgroundColor: primaryTint.fill08,
    borderWidth: 1,
    borderColor: primaryTint.stroke20,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  title: { color: colors.text, fontSize: 14, fontWeight: "800", lineHeight: 19 },
  body: { color: colors.mutedText, fontSize: 12, lineHeight: 17, fontWeight: "500" },
  footnote: { color: colors.subtleText, fontSize: 11, lineHeight: 15, fontWeight: "500" },

  modeRow: { gap: 8, marginTop: 4 },
  modeOption: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  modeOptionActive: { borderColor: colors.primary, backgroundColor: primaryTint.fill12 },
  modeTitle: { color: colors.text, fontSize: 13, fontWeight: "800" },
  modeHint: { color: colors.mutedText, fontSize: 11, lineHeight: 15, fontWeight: "500" },

  formBlock: { gap: 2, marginTop: 4 },

  planBlock: {
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
    marginTop: 2,
  },
  planLabel: {
    color: colors.subtleText,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  planAddress: { color: colors.text, fontSize: 12, lineHeight: 17, fontWeight: "600" },
  planMeta: { color: colors.mutedText, fontSize: 11, lineHeight: 16, fontWeight: "500" },
  planMetaStrong: { color: colors.text, fontSize: 11, lineHeight: 16, fontWeight: "700" },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  copyButtonText: { color: colors.text, fontSize: 11, fontWeight: "700" },

  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: colors.ctaAccent,
    marginTop: 6,
  },
  primaryButtonText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  ghostButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    marginTop: 6,
  },
  ghostButtonText: { color: colors.text, fontSize: 12, fontWeight: "800" },
  // Opaque surface: an elevated card with a translucent child bleeds its shadow
  // through as a grey box on Android.
  lockedNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
  },
  lockedNoteText: { flex: 1, color: colors.subtleText, fontSize: 11, lineHeight: 15, fontWeight: "500" },
  disabled: { opacity: 0.5 },
});

export default HandoffPlanCard;
