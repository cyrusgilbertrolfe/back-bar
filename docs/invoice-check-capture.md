# Invoice check: the daily capture run

The brief for the scheduled Claude task on the Mini that feeds `/finances/invoice-check`. Decisions and the design live in Lifemaxxing: Domains/Cocktails/Back Bar, "2026-10-21 Invoice price check slice 1 [Design]". This file is the code-level contract only.

**Read-only on the mailbox.** Nothing is sent, labelled, moved or marked read. Nothing is written to a component's price: the run only writes proposals, which Cyrus approves in the Cocktails Weekly.

## Steps

1. **Find new supplier mail.** List cocktails@myattsfields.london threads through the Superhuman connector (`acting_email: cocktails@myattsfields.london`), starting from the newest `received_at` in `inbound_messages`. Keep messages from suppliers: the senders in Lifemaxxing `Projects/Cocktails/Back Bar/supplier-contacts.md`, plus any sender whose message is plainly a supplier's invoice, quote, order confirmation or delivery note.

2. **Write one capture per message**, as JSON in the shape `parseCapture` accepts (`src/lib/erp/invoice-check/extraction.ts`). Record every supplier message, not only invoices, because purchase tracking reads quotes, confirmations and delivery notes from the same table.

3. **For an invoice, read the PDF straight away.** Its download link expires after an hour.
   - Copy every printed line with its `lineTotal` ex VAT. Always use the line total, never the price each, which suppliers print per 1, 100 or 1,000.
   - Copy the printed net as `netTotal`. The lines must add up to it, or the invoice is not proposed.
   - Classify each line:
     - `goods`
     - `fee`: delivery, carriage, freight, surcharges
     - `pallet`
     - `duty`: excise printed as its own line; it lands in the goods cost of what it is printed against
     - `epr`
     - `zero`: £0 lines, FOC and promo freebies; Bumbu is always `zero`
     - `other`: discounts, credits, deposits, anything else
   - For a fee, a pallet or duty, set `feeAppliesTo`:
     - the line numbers it is printed against ("Freight - glass and corks" → those lines);
     - `null` when it names nothing in particular;
     - `"unclear"` when you can't tell.
   - For goods, propose `match`:
     - the component id;
     - `packsPerUnit`: component packs in one invoice unit;
     - `packSize`: the pack as bought, in the component's UOM;
     - a one-line reason.
   - Leave `match` out when you are unsure. An unmatched line goes to Cyrus; a wrong match costs more.
   - Set `disputeNote` if the order's thread or a related one shows a problem: wrong goods, a short delivery, a promised credit.

4. **Run the propose step:**
   ```bash
   npm run invoice-check -- <captures dir>
   ```
   Run it with `--dry-run` first if anything looks odd. It skips invoices already on the list and leaves a `cron_runs` row (`job = invoice-check`) either way.

5. **Report the urgent items for the Sweep.** These are the URGENT lines in the output: risen 10% or more, a changed pack size, an invoice that does not reconcile, or a dispute. Give one line each, e.g. "Pattesons 248118: query before paying, wrong bottles thread".
