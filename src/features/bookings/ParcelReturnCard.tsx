import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import * as Clipboard from "expo-clipboard";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppInput } from "@/components/ui/AppInput";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { showToast } from "@/feedback/appFeedback";
import type { Booking, HandoffAddress, ReturnResolution } from "@/services/api";
import { colors } from "@/theme/colors";

/**
 * The parcel hand-back, after a carrier declines it at handoff or cancels
 * mid-trip. Money is already settled - this is purely about the physical parcel,
 * which is sitting at the carrier's address.
 *
 * Before this existed both paths just refunded the sender and stopped: the chat
 * showed a terminal "cancelled" notice while a real parcel sat with the carrier
 * and nobody was told what to do with it. The return address the sender declared
 * when posting an online order was written at creation time and never read.
 *
 * Two steps, one each: the SENDER picks where it goes, then the CARRIER confirms
 * they sent it. Web parity: `src/customer/components/ParcelReturnCard.tsx`.
 */
export interface ParcelReturnCardProps {
  booking: Booking;
  role: "sender" | "carrier" | "unknown";
  pending: "set-return-resolution" | "complete-return" | null;
  onSetResolution: (args: { resolution: ReturnResolution; note?: string; address?: HandoffAddress }) => void;
  onCompleteReturn: (args: { tracking_reference?: string }) => void;
}

const RESOLUTION_LABEL: Record<ReturnResolution, string> = {
  return_to_seller: "Send it back to the seller",
  return_to_sender: "Post it back to me",
  sender_collects: "I'll arrange collection from the carrier",
  sender_has_parcel: "I already have the parcel",
};

const RESOLUTION_ICON: Record<ReturnResolution, keyof typeof Ionicons.glyphMap> = {
  return_to_seller: "storefront-outline",
  return_to_sender: "mail-outline",
  sender_collects: "hand-left-outline",
  sender_has_parcel: "home-outline",
};

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function ParcelReturnCard({
  booking,
  role,
  pending,
  onSetResolution,
  onCompleteReturn,
}: Readonly<ParcelReturnCardProps>) {
  const plan = booking.return_plan ?? null;
  const resolution = booking.return_resolution ?? null;
  const completedAt = booking.return_completed_at ?? null;

  const address = plan?.return_address ?? null;
  const addressText = address
    ? [address.line1, address.line2, address.city, address.state, address.postal_code, address.country]
        .filter((part) => !!part && String(part).trim().length > 0)
        .join(", ")
    : "";
  const canReturnToSeller = !!addressText;

  // Default-from-props must be derived, not frozen: a `useState` initialiser only
  // runs on the first mount, so if this card ever mounts before `return_plan`
  // settles it keeps the wrong default forever. `null` means "user hasn't
  // chosen", so the server's suggestion always wins until they do. (Web hit this
  // for real: it pre-selected "I already have the parcel", the one option that
  // closes the return and strands the parcel.)
  const [picked, setPicked] = useState<ReturnResolution | null>(null);
  const choice: ReturnResolution =
    picked ?? plan?.suggested ?? (canReturnToSeller ? "return_to_seller" : "sender_collects");
  const setChoice = setPicked;
  const [note, setNote] = useState("");
  const [tracking, setTracking] = useState("");
  // Where to post it back to, for `return_to_sender`. Nothing is stored for a
  // personal item (only online orders declare a seller address), so the sender
  // supplies this now.
  const [myLine1, setMyLine1] = useState("");
  const [myLine2, setMyLine2] = useState("");
  const [myCity, setMyCity] = useState("");
  const [myState, setMyState] = useState("");
  const [myPostal, setMyPostal] = useState("");
  const [myCountry, setMyCountry] = useState("");
  const [myContact, setMyContact] = useState("");
  const [myPhone, setMyPhone] = useState("");

  // `needed: false` means the carrier declined at a meetup and the sender never
  // let go of the parcel - there is nothing to hand back, so no card.
  if (!plan || plan.needed === false) return null;

  const isCarrier = role === "carrier";
  const carrierName = booking.carrier?.name || "your carrier";
  const senderName = booking.sender?.name || "the sender";

  const header = (subtitle: string) => (
    <>
      <View style={styles.headerRow}>
        <Ionicons name="arrow-undo-outline" size={14} color={colors.warning} />
        <Text style={styles.eyebrow}>Parcel return</Text>
      </View>
      <Text style={styles.title}>{subtitle}</Text>
    </>
  );

  const addressBlock = addressText ? (
    <View style={styles.addressBlock}>
      <View style={styles.headerRow}>
        <Ionicons name="storefront-outline" size={12} color={colors.subtleText} />
        <Text style={styles.addressLabel}>Seller return address</Text>
      </View>
      <Text style={styles.addressText}>{addressText}</Text>
      <Pressable
        onPress={() => {
          void Clipboard.setStringAsync(addressText);
          showToast({ title: "Address copied", variant: "success" });
        }}
        style={styles.copyButton}
        accessibilityRole="button"
        accessibilityLabel="Copy return address"
      >
        <Ionicons name="copy-outline" size={12} color={colors.text} />
        <Text style={styles.copyButtonText}>Copy address</Text>
      </Pressable>
      {plan.return_reference ? (
        <Text style={styles.meta}>Order / RMA: {plan.return_reference}</Text>
      ) : null}
    </View>
  ) : null;

  const dest = booking.return_destination_address ?? null;
  const destText = dest
    ? [dest.line1, dest.line2, dest.city, dest.state, dest.postal_code, dest.country]
        .filter((part) => !!part && String(part).trim().length > 0)
        .join(", ")
    : "";
  const destinationBlock = destText ? (
    <View style={styles.addressBlock}>
      <View style={styles.headerRow}>
        <Ionicons name="mail-outline" size={12} color={colors.subtleText} />
        <Text style={styles.addressLabel}>Post it back to</Text>
      </View>
      <Text style={styles.addressText}>{destText}</Text>
      <Pressable
        onPress={() => {
          void Clipboard.setStringAsync(destText);
          showToast({ title: "Address copied", variant: "success" });
        }}
        style={styles.copyButton}
        accessibilityRole="button"
        accessibilityLabel="Copy return address"
      >
        <Ionicons name="copy-outline" size={12} color={colors.text} />
        <Text style={styles.copyButtonText}>Copy address</Text>
      </Pressable>
      {dest?.contact_name || dest?.contact_phone ? (
        <Text style={styles.meta}>
          For the courier: {[dest?.contact_name, dest?.contact_phone].filter(Boolean).join(" \u00b7 ")}
        </Text>
      ) : null}
    </View>
  ) : null;

  // ── Done ──────────────────────────────────────────────────────────────────
  if (completedAt) {
    return (
      <View style={styles.card}>
        {header(
          resolution === "sender_has_parcel"
            ? "Closed - the parcel never left the sender"
            : "The parcel is on its way back",
        )}
        <Text style={styles.body}>
          {resolution ? RESOLUTION_LABEL[resolution] : "Resolved"} · {formatDateTime(completedAt)}
        </Text>
        {booking.return_tracking_reference ? (
          <Text style={styles.meta}>Return tracking: {booking.return_tracking_reference}</Text>
        ) : null}
        {booking.return_resolution_note ? (
          <Text style={styles.meta}>&quot;{booking.return_resolution_note}&quot;</Text>
        ) : null}
      </View>
    );
  }

  // ── Step 1: the sender decides ────────────────────────────────────────────
  if (!resolution) {
    if (!isCarrier) {
      const options: ReturnResolution[] = [
        "return_to_seller",
        "return_to_sender",
        "sender_collects",
        "sender_has_parcel",
      ];
      return (
        <View style={styles.card}>
          {header(`Tell ${carrierName} what to do with the parcel`)}
          <Text style={styles.body}>
            You have been refunded in full. The parcel itself is still with your carrier,
            so it needs somewhere to go before this is finished.
          </Text>
          {addressBlock}
          <View style={styles.optionList}>
            {options.map((value) => {
              const disabled = value === "return_to_seller" && !canReturnToSeller;
              const selected = choice === value && !disabled;
              return (
                <Pressable
                  key={value}
                  onPress={() => !disabled && setChoice(value)}
                  disabled={disabled}
                  style={[styles.option, selected && styles.optionActive, disabled && styles.optionDisabled]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, disabled }}
                  accessibilityLabel={RESOLUTION_LABEL[value]}
                >
                  <Ionicons name={RESOLUTION_ICON[value]} size={15} color={colors.warning} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.optionTitle}>{RESOLUTION_LABEL[value]}</Text>
                    <Text style={styles.optionHint}>
                      {value === "return_to_seller"
                        ? canReturnToSeller
                          ? "The carrier posts it to the return address you gave when listing the parcel."
                          : "You did not declare a return address - pick another option, or add one in the note."
                        : value === "return_to_sender"
                          ? "The carrier posts it to an address you give below - the usual choice for a personal item."
                          : value === "sender_collects"
                            ? "You book a courier or collect it yourself. Agree the details in chat."
                            : "Nothing to move - close this off."}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          {choice === "return_to_sender" ? (
            <View style={styles.destForm}>
              <AppInput label="Post it back to" value={myLine1} onChangeText={setMyLine1} placeholder="Street address" />
              <AppInput value={myLine2} onChangeText={setMyLine2} placeholder="Apartment, building, landmark (optional)" />
              <AppInput value={myCity} onChangeText={setMyCity} placeholder="City" />
              <AppInput value={myState} onChangeText={setMyState} placeholder="State / region" />
              <AppInput value={myPostal} onChangeText={setMyPostal} placeholder="Postal code" />
              <AppInput value={myCountry} onChangeText={setMyCountry} placeholder="Country" />
              <AppInput value={myContact} onChangeText={setMyContact} placeholder="Name for the parcel" />
              <AppInput value={myPhone} onChangeText={setMyPhone} placeholder="Phone for the courier" keyboardType="phone-pad" />
            </View>
          ) : null}
          <AppInput
            label="Anything the carrier needs to know (optional)"
            value={note}
            onChangeText={setNote}
            placeholder="e.g. I've emailed you a prepaid return label"
            multiline
            numberOfLines={3}
            maxLength={1000}
            textAlignVertical="top"
          />
          <Pressable
            onPress={() => {
              if (choice === "return_to_sender" && (!myLine1.trim() || !myCity.trim())) {
                showToast({ title: "Add the street address and city to post the parcel back to", variant: "error" });
                return;
              }
              onSetResolution({
                resolution: choice,
                note: note.trim() || undefined,
                address:
                  choice === "return_to_sender"
                    ? {
                        line1: myLine1.trim(),
                        line2: myLine2.trim() || undefined,
                        city: myCity.trim(),
                        state: myState.trim() || undefined,
                        postal_code: myPostal.trim() || undefined,
                        country: myCountry.trim() || undefined,
                        contact_name: myContact.trim() || undefined,
                        contact_phone: myPhone.trim() || undefined,
                      }
                    : undefined,
              });
            }}
            disabled={pending !== null}
            style={[styles.primaryButton, pending !== null && styles.disabled]}
            accessibilityRole="button"
            accessibilityLabel={`Send this to ${carrierName}`}
          >
            {pending === "set-return-resolution" ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Ionicons name="send" size={14} color={colors.white} />
                <Text style={styles.primaryButtonText}>Send this to {carrierName}</Text>
              </>
            )}
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.card}>
        {header(`You still have the parcel - ${senderName} is deciding where it goes`)}
        <Text style={styles.body}>
          You have been refunded out of it and the booking is closed, but the parcel is
          physically with you. {senderName} has been asked whether it goes back to the
          seller or they arrange collection. Keep it safe until then.
        </Text>
        {addressBlock}
      </View>
    );
  }

  // ── Step 2: the carrier sends it back ─────────────────────────────────────
  if (isCarrier) {
    return (
      <View style={styles.card}>
        {header(RESOLUTION_LABEL[resolution])}
        <Text style={styles.body}>
          {resolution === "return_to_seller"
            ? "Post the parcel to the seller's return address below, then confirm it here."
            : "The sender is arranging collection. Once you have handed the parcel over, confirm it here."}
        </Text>
        {resolution === "return_to_seller" ? addressBlock : null}
        {resolution === "return_to_sender" ? destinationBlock : null}
        {booking.return_resolution_note ? (
          <View style={styles.addressBlock}>
            <Text style={styles.meta}>
              {senderName}: {booking.return_resolution_note}
            </Text>
          </View>
        ) : null}
        <AppInput
          value={tracking}
          onChangeText={setTracking}
          placeholder="Return tracking number (optional)"
          maxLength={120}
        />
        <Pressable
          onPress={() => onCompleteReturn({ tracking_reference: tracking.trim() || undefined })}
          disabled={pending !== null}
          style={[styles.primaryButton, pending !== null && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel="I have sent it back"
        >
          {pending === "complete-return" ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={14} color={colors.white} />
              <Text style={styles.primaryButtonText}>I&apos;ve sent it back</Text>
            </>
          )}
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {header(`Waiting for ${carrierName} to send the parcel back`)}
      <Text style={styles.body}>
        You asked them to {RESOLUTION_LABEL[resolution].toLowerCase()}. They have been
        notified and will confirm here once it is done.
      </Text>
      {resolution === "return_to_seller" ? addressBlock : null}
      {resolution === "return_to_sender" ? destinationBlock : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    backgroundColor: "rgba(245,159,10,0.08)",
    borderWidth: 1,
    borderColor: "rgba(245,159,10,0.32)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  eyebrow: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  title: { color: colors.text, fontSize: 14, fontWeight: "800", lineHeight: 19 },
  body: { color: colors.mutedText, fontSize: 12, lineHeight: 17, fontWeight: "500" },
  meta: { color: colors.mutedText, fontSize: 11, lineHeight: 16, fontWeight: "500" },

  addressBlock: {
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
    marginTop: 2,
  },
  addressLabel: {
    color: colors.subtleText,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  addressText: { color: colors.text, fontSize: 12, lineHeight: 17, fontWeight: "600" },
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

  destForm: { gap: 2, marginTop: 4 },
  optionList: { gap: 8, marginTop: 4 },
  option: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionActive: { borderColor: colors.warning, backgroundColor: "rgba(245,159,10,0.14)" },
  optionDisabled: { opacity: 0.55 },
  optionTitle: { color: colors.text, fontSize: 13, fontWeight: "800" },
  optionHint: { color: colors.mutedText, fontSize: 11, lineHeight: 15, fontWeight: "500" },

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
  disabled: { opacity: 0.5 },
});

export default ParcelReturnCard;
