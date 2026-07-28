/**
 * complianceFooter — Shared CAN-SPAM compliant email footer.
 *
 * WHAT: Builds the marketing email footer (physical postal address + unsubscribe link).
 * WHERE: Appended by gmail-campaign-send, outlook-send, and any future bulk/marketing sender.
 * WHY: CAN-SPAM (US) requires every commercial email to include the sender's valid
 *      physical postal address AND a clear opt-out mechanism.
 */

export const SENDER_POSTAL_ADDRESS = {
  name: "CROS LLC",
  line1: "330 S 2nd Ave",
  line2: "Suite 200 #1589",
  city: "Minneapolis",
  region: "MN",
  postal: "55401",
  country: "USA",
};

export function renderPostalAddressHtml(): string {
  const a = SENDER_POSTAL_ADDRESS;
  return `${a.name} &middot; ${a.line1}, ${a.line2} &middot; ${a.city}, ${a.region} ${a.postal}`;
}

/**
 * Build the standard marketing footer. Always includes the postal address.
 * If unsubscribeUrl is provided, includes an unsubscribe link.
 */
export function renderComplianceFooterHtml(unsubscribeUrl?: string | null): string {
  const address = renderPostalAddressHtml();
  const unsub = unsubscribeUrl
    ? `To stop receiving these emails, <a href="${unsubscribeUrl}" style="color:#999;">unsubscribe here</a>.<br/>`
    : "";
  return `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#999;text-align:center;line-height:1.5;">
${unsub}<span style="color:#999;">${address}</span>
</div>`;
}
