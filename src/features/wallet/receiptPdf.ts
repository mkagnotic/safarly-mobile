import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { safarlyMarkXml } from "@/assets/brand/safarlyMark";
import type { Transaction } from "@/services/api";
import { formatTxDate, txTypeMeta } from "@/features/wallet/transactionDisplay";

/**
 * Native equivalent of web's `downloadTransactionReceipt`: render an HTML
 * receipt to a PDF file (expo-print) and hand it to the OS share sheet
 * (expo-sharing) so the user can Save to Files, email, or send it.
 *
 * Design mirrors the web (jsPDF) receipt — faint centred brand watermark,
 * header logo + "Safarly" wordmark, transaction details, and an Amount /
 * Platform fee / Net amount totals box — using the same `safarlyMarkXml`
 * source of truth so both platforms produce the same-looking document. Web
 * uses jsPDF (browser-only, can't run in RN), so we build the identical layout
 * via HTML→PDF instead.
 */

/** Receipt is offered for the same statuses as web: paid, held, or refunded. */
export function canDownloadReceipt(status: string): boolean {
  return status === "completed" || status === "held" || status === "refunded";
}

const symbolFor = (currency?: string) => (currency?.toUpperCase() === "INR" ? "₹" : "$");
const money = (n: number | null | undefined, currency?: string) =>
  `${symbolFor(currency)}${(Number(n) || 0).toFixed(2)}`;

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

function receiptHtml(tx: Transaction): string {
  const currency = tx.currency;
  const reference = tx.stripe_payment_intent_id || tx.stripe_refund_id || tx.reference || "—";
  const platformFee = tx.platform_fee ?? null;
  const netAmount =
    tx.net_amount ?? (platformFee != null ? Math.max(0, Number(tx.amount) - Number(platformFee)) : null);

  const rows: Array<{ label: string; value: string }> = [
    { label: "Type", value: txTypeMeta(tx.type).label },
    ...(tx.route_from || tx.route_to
      ? [{ label: "Route", value: `${tx.route_from ?? "—"} → ${tx.route_to ?? "—"}` }]
      : []),
    { label: "Booking", value: tx.booking_id ? `#${tx.booking_id.slice(0, 8)}` : "—" },
    { label: "Reference", value: reference },
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
  td { padding: 9px 0; font-size: 13px; border-bottom: 1px solid #F0F1F4; }
  td.k { color: #6B7280; }
  td.v { text-align: right; font-weight: 700; }
  .totals { margin-top: 20px; background: rgba(247,248,250,0.85); border: 1px solid #E4E6EB; border-radius: 10px; padding: 16px 18px; }
  .totals .line { display: flex; justify-content: space-between; font-size: 13px; padding: 5px 0; }
  .totals .line.net { font-size: 15px; font-weight: 800; }
  .totals .line.net .lbl { color: #A74EFF; }
  .foot { margin-top: 30px; text-align: center; color: #9AA1AC; font-size: 10px; }
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
        <div class="t">PAYMENT RECEIPT</div>
        <div class="r">Receipt #${esc(tx.id)}</div>
      </div>
    </div>
    <div class="rule"></div>
    <div class="meta">
      <div><div class="lbl">Issued</div><div class="val">${esc(formatTxDate(tx.created_at) || "—")}</div></div>
      <div style="text-align:right"><div class="lbl">Status</div><div class="val status">${esc(tx.status || "—")}</div></div>
    </div>
    <h2>Transaction details</h2>
    <table>${rowsHtml}</table>
    <div class="totals">
      <div class="line"><span>Amount</span><span>${money(tx.amount, currency)}</span></div>
      <div class="line"><span>Platform fee</span><span>${platformFee != null ? money(platformFee, currency) : "—"}</span></div>
      <div class="line net"><span class="lbl">Net amount</span><span>${netAmount != null ? money(netAmount, currency) : "—"}</span></div>
    </div>
    <div class="foot">This is a system-generated receipt from Safarly. For questions, contact support@safarly.com.</div>
  </div>
</body></html>`;
}

export async function shareTransactionReceipt(tx: Transaction): Promise<void> {
  const html = receiptHtml(tx);

  // On web (Expo Web / react-native-web), expo-print's shim ignores the `html`
  // argument and just calls window.print() on the whole app page — which prints
  // the current screen, not our receipt. So on web we render the receipt into an
  // isolated hidden iframe and print that instead, giving the same branded
  // document (watermark + logo). Native uses the real HTML→PDF + share sheet.
  if (Platform.OS === "web") {
    printReceiptOnWeb(html);
    return;
  }

  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: "Safarly receipt",
      UTI: "com.adobe.pdf",
    });
  }
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
