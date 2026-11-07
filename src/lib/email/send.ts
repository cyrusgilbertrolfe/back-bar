/**
 * Order mail, through Resend. It goes from trade@, the address the trade portal
 * has proven on this domain, with replies and a copy to cocktails@, so the thread
 * lives in that mailbox (Cyrus, 7 Nov 2026).
 */

const FROM = "Myatt's Fields <trade@myattsfields.com>";
const COCKTAILS = "cocktails@myattsfields.com";

type Mail = { to: string; subject: string; text: string; attachment: { filename: string; content: Uint8Array } };

/** Sends, and returns what went wrong in words, or null if it went. */
export async function sendOrderMail(mail: Mail): Promise<string | null> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return "email is not set up here (RESEND_API_KEY is missing).";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [mail.to],
        bcc: [COCKTAILS],
        reply_to: COCKTAILS,
        subject: mail.subject,
        text: mail.text,
        attachments: [{ filename: mail.attachment.filename, content: Buffer.from(mail.attachment.content).toString("base64") }],
      }),
      cache: "no-store",
    });
    if (res.ok) return null;
    console.error("[email] Resend refused", res.status, await res.text());
    return `the mail service refused it (${res.status}).`;
  } catch (err) {
    console.error("[email] could not reach Resend", err);
    return "the mail service could not be reached.";
  }
}
