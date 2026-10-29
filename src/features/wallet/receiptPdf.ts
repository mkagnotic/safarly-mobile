import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";

import { safarlyMarkXml } from "@/assets/brand/safarlyMark";
import type { Transaction } from "@/services/api";
import { penaltyView, txStatusLabel, txTypeMeta } from "@/features/wallet/transactionDisplay";
import { COMPANY_JURISDICTION, COMPANY_NAME, PLATFORM_NAME, SUPPORT_EMAIL } from "@/constants/company";
import { receiptDate, receiptFooter, receiptTotals } from "@/features/wallet/receiptModel";
import { formatMoney } from "@/utils/money";
import { receiptReference } from "@/features/wallet/receiptReference";

/**
 * Native equivalent of web's `downloadTransactionReceipt`: render an HTML
 * receipt to a PDF file (expo-print) and hand it to the OS share sheet
 * (expo-sharing) so the user can Save to Files, email, or send it.
 *
 * Design mirrors the web (jsPDF) receipt — faint centred brand watermark,
 * header logo + "Safarly" wordmark, transaction details, and the totals box from
 * `receiptTotals` (shared with web) — using the same `safarlyMarkXml`
 * source of truth so both platforms produce the same-looking document. Web
 * uses jsPDF (browser-only, can't run in RN), so we build the identical layout
 * via HTML→PDF instead.
 */

/** Receipt is offered for the same statuses as web: paid, held, or refunded. */
export function canDownloadReceipt(status: string): boolean {
  return status === "completed" || status === "held" || status === "refunded";
}

// The shared formatter: the hand-rolled one printed "$" for any non-INR code.
const money = (n: number | null | undefined, currency?: string | null) => formatMoney(Number(n) || 0, currency);

/** What the document is (27 Oct 2026: every one said "PAYMENT RECEIPT", refunds and earnings too). */
export function receiptTitle(type: string): string {
  switch (type) {
    case "payment": return "PAYMENT RECEIPT";
    case "refund": return "REFUND RECEIPT";
    case "payout": return "EARNINGS STATEMENT";
    case "penalty": return "PENALTY STATEMENT";
    default: return "TRANSACTION RECEIPT";
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The brand mark, with its gradient ids suffixed so two copies (watermark +
 * header) can coexist in one document without id collisions.
 */
function markSvg(suffix: string): string {
  return safarlyMarkXml
    .replace(/mark_grad_1/g, `mg1_${suffix}`)
    .replace(/mark_grad_2/g, `mg2_${suffix}`);
}

/** Both footer lines: support address + the legal entity (constants/company). Same as web. */
export const RECEIPT_FOOTER = receiptFooter({
  platform: PLATFORM_NAME, companyName: COMPANY_NAME, jurisdiction: COMPANY_JURISDICTION, supportEmail: SUPPORT_EMAIL,
});

export function receiptHtml(tx: Transaction): string {
  const currency = tx.currency;
  const reference = receiptReference(tx);
  // Carrier fee + Platform fee (10%) = Total paid; refunds, earnings (net of any
  // penalty) and penalties each get their own lines - the web PDF's exact lines.
  const totals = receiptTotals(tx, money);

  const rows: Array<{ label: string; value: string }> = [
    { label: "Type", value: penaltyView(tx)?.label ?? txTypeMeta(tx.type).label },
    ...(tx.route_from || tx.route_to
      ? [{ label: "Route", value: `${tx.route_from ?? "—"} → ${tx.route_to ?? "—"}` }]
      : []),
    // Only when there is one (web parity): a top-up printed "Booking —".
    ...(tx.booking_id ? [{ label: "Booking", value: `#${tx.booking_id.slice(0, 8)}` }] : []),
    reference,
    { label: "Currency", value: (currency || "USD").toUpperCase() },
  ];

  const rowsHtml = rows
    .map((r) => `<tr><td class="k">${esc(r.label)}</td><td class="v">${esc(r.value)}</td></tr>`)
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif; color: #1F2937; }
  /* Faint centred watermark, behind the content. */
  .wm { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; opacity: 0.08; z-index: 0; }
  .wm .m { width: 58%; }
  .wm .m svg { width: 100%; height: auto; display: block; }
  .page { position: relative; z-index: 1; padding: 44px 40px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; }
  .brand { display: flex; align-items: center; gap: 9px; }
  .brand .logo { width: 26px; }
  .brand .logo svg { width: 100%; height: auto; display: block; }
  .brand .name { font-size: 26px; font-weight: 800; color: #A74EFF; letter-spacing: -0.5px; }
  .doc { text-align: right; color: #6B7280; }
  .doc .t { font-size: 12px; font-weight: 700; letter-spacing: 1px; }
  .doc .r { font-size: 11px; margin-top: 4px; }
  .rule { height: 1px; background: #E4E6EB; margin: 22px 0; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 22px; }
  .meta .lbl { font-size: 11px; color: #6B7280; margin-bottom: 4px; }
  .meta .val { font-size: 14px; font-weight: 700; }
  .status { text-transform: uppercase; }
  h2 { font-size: 14px; margin: 0 0 8px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 9px 0; font-size: 13px; border-bottom: 1px solid #F0F1F4; vertical-align: top; }
  tr, .totals { page-break-inside: avoid; break-inside: avoid; }
  td.k { color: #6B7280; white-space: nowrap; padding-right: 16px; }
  /* Long names, routes and references wrap instead of running off the page. */
  td.v { text-align: right; font-weight: 700; overflow-wrap: anywhere; word-break: break-word; }
  .totals { margin-top: 20px; background: rgba(247,248,250,0.85); border: 1px solid #E4E6EB; border-radius: 10px; padding: 16px 18px; }
  .totals .line { display: flex; justify-content: space-between; font-size: 13px; padding: 5px 0; }
  .totals .line.net { font-size: 15px; font-weight: 800; }
  .totals .line .lbl { color: #6B7280; }
  .totals .line.net .lbl { color: #A74EFF; }
  .foot { margin-top: 30px; text-align: center; color: #9AA1AC; font-size: 10px; line-height: 1.5; }
</style></head>
<body>
  <div class="wm"><div class="m">${markSvg("w")}</div></div>
  <div class="page">
    <div class="head">
      <div class="brand">
        <span class="logo">${markSvg("h")}</span>
        <span class="name">Safarly</span>
      </div>
      <div class="doc">
        <div class="t">${esc(receiptTitle(tx.type))}</div>
        <div class="r">Receipt #${esc(tx.id)}</div>
      </div>
    </div>
    <div class="rule"></div>
    <div class="meta">
      <div><div class="lbl">Issued</div><div class="val">${esc(receiptDate(tx.created_at) || "—")}</div></div>
      <div style="text-align:right"><div class="lbl">Status</div><div class="val status">${esc(penaltyView(tx)?.status ?? (tx.status ? txStatusLabel(tx.status) : "—"))}</div></div>
    </div>
    <h2>Transaction details</h2>
    <table>${rowsHtml}</table>
    <div class="totals">
      ${totals
        .map((l) => `<div class="line${l.strong ? " net" : ""}"><span class="lbl">${esc(l.label)}</span><span>${esc(l.value)}</span></div>`)
        .join("")}
    </div>
    <div class="foot">${RECEIPT_FOOTER.map((l) => esc(l)).join("<br />")}</div>
  </div>
</body></html>`;
}

/**
 * "shared"  — the PDF went to the share sheet (or the web print dialog).
 * "copied"  — this device has no share sheet: the receipt's details were copied
 *             to the clipboard instead, and the caller must SAY so. It used to
 *             do nothing at all, so the button looked broken.
 */
export type ReceiptOutcome = "shared" | "copied";

function receiptText(tx: Transaction): string {
  const ref = receiptReference(tx);
  return [
    "Safarly receipt",
    `Type: ${penaltyView(tx)?.label ?? txTypeMeta(tx.type).label}`,
    // The same lines as the PDF's totals box (a penalty printed "-$0.99" as the amount).
    ...receiptTotals(tx, money).map((l) => `${l.label}: ${l.value}`),
    `Date: ${receiptDate(tx.created_at)}`,
    tx.booking_id ? `Booking: #${tx.booking_id.slice(0, 8)}` : null,
    `${ref.label}: ${ref.value}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function shareTransactionReceipt(tx: Transaction): Promise<ReceiptOutcome> {
  const html = receiptHtml(tx);

  // On web (Expo Web / react-native-web), expo-print's shim ignores the `html`
  // argument and just calls window.print() on the whole app page — which prints
  // the current screen, not our receipt. So on web we render the receipt into an
  // isolated hidden iframe and print that instead, giving the same branded
  // document (watermark + logo). Native uses the real HTML→PDF + share sheet.
  if (Platform.OS === "web") {
    printReceiptOnWeb(html);
    return "shared";
  }

  if (!(await Sharing.isAvailableAsync())) {
    await Clipboard.setStringAsync(receiptText(tx));
    return "copied";
  }
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: "Safarly receipt",
    UTI: "com.adobe.pdf",
  });
  return "shared";
}

/** Web-only: print the receipt HTML in an isolated iframe (avoids popup blockers
 *  and never prints the surrounding app page). */
function printReceiptOnWeb(html: string): void {
  const g = globalThis as unknown as {
    document?: {
      body: { appendChild: (n: unknown) => void; removeChild: (n: unknown) => void };
      createElement: (tag: string) => Record<string, unknown>;
    };
  };
  const doc = g.document;
  if (!doc) throw new Error("Receipts can't be generated in this environment.");

  const iframe = doc.createElement("iframe") as Record<string, unknown> & {
    style: Record<string, string>;
    contentWindow: {
      document: { open: () => void; write: (s: string) => void; close: () => void };
      focus: () => void;
      print: () => void;
    } | null;
  };
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  doc.body.appendChild(iframe);

  const win = iframe.contentWindow;
  if (!win) {
    doc.body.removeChild(iframe);
    throw new Error("Couldn't open the receipt for printing.");
  }
  win.document.open();
  win.document.write(html);
  win.document.close();

  // Give the inline SVG + layout a beat to paint before printing, then clean up.
  setTimeout(() => {
    win.focus();
    win.print();
    setTimeout(() => doc.body.removeChild(iframe), 1000);
  }, 400);
}
