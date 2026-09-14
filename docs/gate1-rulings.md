# Gate 1 rulings — 5–6 September 2026

Cyrus's rulings on the twelve current recipes whose computed ABV sits more than
0.3 points from their declared label figure. Recorded here because they are
business decisions, and a decision that lives only in a tool is a decision
waiting to be lost.

**None of these have been applied.** See §3 — the ABV audit has to land first.

## 1. The rulings

| Drink | Gap | Ruling | Cyrus's note |
|---|---|---|---|
| Naked & Famous | 6.4 | Label wrong | — |
| Corpse Reviver | 5.8 | Label wrong | — |
| Gibson Martini | 4.7 | Label wrong | — |
| Baby Otis | 3.9 | Label wrong | "We've never added water to this drink — the client is encouraged to pour over ice" |
| Sakura Martini | 3.2 | Label wrong | — |
| Vesper Martini | 2.8 | Label wrong | — |
| Lychee Martini | 1.9 | Label wrong | — |
| Red Hook | 1.7 | Label wrong | — |
| Espresso Martini | 1.3 | Label wrong | "We changed vodka, and that hasn't been reflected in the label ABV — I'm not comfortable with sub-20% on this, so will need a discussion at a future board meeting" |
| Tuxedo | 1.2 | **Recipe wrong** | "First bug — this vermouth is 18% ABV and Hayman's is bottled at 41.2%. I'm afraid we need to do a complete audit of all Back Bar ABVs" |
| Margarita | 1.0 | Dilution missing | — |
| Trident | 0.5 | Dilution missing | — |

Nine "label wrong", two "dilution missing", one "recipe wrong".

## 2. What the notes settle

**Baby Otis kills the dilution hypothesis.** The strongest arithmetic case in the
whole set was Baby Otis: add 13.7% water and the computed figure lands on the
label figure almost exactly. Cyrus's answer is that no water is ever added — the
drink is poured over ice by the customer. So the coincidence was a coincidence,
and a tidy-looking piece of arithmetic was about to be mistaken for evidence.
Worth remembering the next time a number lands suspiciously well.

**Espresso Martini is a business decision, not a data one.** The vodka changed
and the label never followed. Cyrus is not comfortable declaring sub-20% on this
product, which makes the fix a board conversation about the recipe rather than a
correction to either figure. Flagged, not actioned.

## 3. Why none of this has been applied

Nine of the twelve rulings say "the label is wrong". Each of those was reached by
comparing a label against a **computed** figure — and every computed figure is
built from `components.abv`.

The Tuxedo note is the reason to stop. It is not one wrong number; it is evidence
that the component ABVs have never been checked. The audit that followed found:

- **46 of 52 alcoholic components carry a round number.** Ten different products
  are recorded at exactly 40.00%; five at 17.00%; five at 16.50%. Only six values
  in the whole set look like they were read off a bottle — 41.2, 41.4, 40.1,
  44.7, 20.3 and 1.7 — and one of those six is the one Cyrus says is wrong.
- **Eleven components name a category rather than a product** — "Rye", "Mezcal",
  "Calvados", "Triple Sec", "Tequila Reposado", "Manzanilla" and others. These
  cannot be verified against a bottle, because the record does not say which
  bottle.
- **`components.abv` has no source and no date.** See §4.
- **Six of the twelve ruled drinks depend on a flagged component.**

Correcting a label to match a computed figure that is itself wrong would print a
wrong number on a bottle. That is a worse outcome than the disagreement we
started with, and it is exactly the class of mistake `declared_abv` was created
to prevent — so the rulings wait.

## 4. The structural finding

`skus.declared_abv` carries `declared_abv_source` and `declared_abv_noted`,
with a long comment on the column explaining why: a figure without provenance is
a figure waiting to be silently overwritten, as seventeen of them were on
14 August 2026.

`components.abv` is a bare `numeric(5,2)`. No source. No date. Nothing recording
whether a value was read off a bottle, copied from a supplier sheet, or assumed
from the category.

So Gate 1 compares a **sourced** figure against an **unsourced** one. The
foundation is weaker than the thing standing on it, and the same lesson applies
one level down. The fix — `abv_source` and `abv_noted` on `components`, and a
verification pass that fills them — is the work of week 2.

## 5. Resolved 12 Sept 2026 — and it changed the answers

**Old Tom Gin: 41.4% is right.** Confirmed against Hayman's own product page.
The value never needed changing; what it lacked was a source, and it has one now.

**The in-house gin was wrong: 41.2% should be 43.0%.** Every 58 & Co invoice
since November 2025 states "58 and Co London Dry Gin 43% 1L", product code
`LDG/43/1L/CORE/DP` — the strength is in the product code. Where 41.2% came
from was never recorded; it matches Hayman's London Dry, which may be how it
got there. Cyrus confirmed on 13 Sept that the house gin is 58 & Co's standard
London Dry — the database note calling it an "in-house Fusion blend" was
unsourced and wrong. Cyrus confirmed from an invoice
independently before the inbox was searched, so this is two sources agreeing.

That component is in **eleven current recipes**, so correcting it moved Gate 1
substantially — and it vindicates holding the rulings:

| Drink | Ruling given | Gap before | Gap after | |
|---|---|---|---|---|
| Gibson Martini | Label wrong | 4.7 | **3.3** | computed was wrong by 1.4 |
| Vesper Martini | Label wrong | 2.8 | **1.6** | computed was wrong by 1.2 |
| Lychee Martini | Label wrong | 1.9 | **1.0** | computed was wrong by 0.9 |
| Corpse Reviver | Label wrong | 5.8 | 6.2 | worse |
| Sakura Martini | Label wrong | 3.2 | 3.6 | worse |

**Three of the nine "label wrong" rulings rested on computed figures that were
wrong by around a point.** Had those labels been corrected to match, three
wrong numbers would have gone onto bottles. The rule held.

Four drinks that were *passing* now fail — Dempsey, Pisco Martini, Negroni and
Cold Brew Negroni — because two errors had been cancelling each other out.
Total failures went from 16 to 20.

## 6. The finding underneath: some labels are echoes of the recipe

Checking the drinks that passed Gate 1 *before* the gin correction:

| Drink | Label | Old computed | Difference | Recorded source |
|---|---|---|---|---|
| Negroni | 27.6 | 27.59 | **0.01** | Cyrus, 30 Aug 2026 |
| Cold Brew Negroni | 27.6 | 27.57 | **0.03** | 14 Aug 2026 correction record |
| Manhattan | 35.5 | 35.31 | 0.19 | Cyrus, 30 Aug 2026 |
| Rum Old Fashioned | 35.0 | 35.20 | 0.20 | 14 Aug 2026 correction record |
| Desert Negroni | 26.9 | 27.16 | 0.26 | Cyrus, 30 Aug 2026 |
| Pisco Martini | 28.6 | 28.93 | 0.33 | Cyrus, 30 Aug 2026 |
| Dempsey | 40.0 | 40.34 | 0.34 | Cyrus, 30 Aug 2026 |

A figure read off a printed label cannot agree with a recipe computation to
0.01 points. Labels are printed to one decimal place; landing on 27.6 against a
computed 27.59 is only possible if the label figure came *from* the computation.

So some `declared_abv` values are not independent evidence — they are the
computed figure wearing a label's clothes. **Gate 1 was passing those drinks by
comparing a number to itself.** This is precisely what the column comment on
`skus.declared_abv` warned against: *"it must NEVER be filled by copying the
computed value — that single act is the mistake the column exists to prevent."*

No blame attaches to the 30 August entries. The most likely explanation is
entirely innocent: filling in missing declared values from the only place a
number existed at the time, which was the app. It is still not evidence.

**Consequence:** Gate 1 cannot currently be trusted in either direction, because
one side of the comparison is of unknown independence. `declared_abv_source` is
free text and does not distinguish "read off the bottle" from "taken from the
system", so the distinction cannot be queried — only re-established.

That makes the next pass a **label audit**: physically read the printed ABV on
one bottle of each drink and record it with `source: bottle`. Until that exists,
the twelve rulings stay held.

## 7. Open question

Cyrus's note says "Hayman's is bottled at 41.2%". The database holds two gins
that could be meant:

- `Gin (in-house)` at **41.2%** — used in 11 current recipes
- `Old Tom Gin` at **41.4%** — used only in Tuxedo

Hayman's London Dry is 41.2% and Hayman's Old Tom is 41.4%, so both recorded
values may be right for their respective products. Either the Tuxedo recipe
points at the wrong component, or the Old Tom figure is wrong. **Needs Cyrus.**

Note that this correction alone does not close Tuxedo: swapping 41.4 for 41.2
moves the computed figure from 30.3 to 30.2 against a label of 29.1. Something
else in that recipe is also out.

## 8. 13 Sept 2026 — invoices name the bottles, and correct the rum

Going to source rather than typing produced three things.

**The most influential component in the range was wrong.** Matthew Clark invoice
4103269 (25 Mar 2026) prints the strength in its own product line:
`MOUNTGAY ECLIPSE RUM 37.5%70X6`, at £17.46 — exactly the pack cost Back Bar
holds for "Mount Gay Rum". Back Bar had it at 40%, unsourced. It is 86% of the
Rum Old Fashioned, so the correction moves that drink from 35.2% computed to
**33.0%**, against a label of 35.0.

That label was already on the echo list in §6 — it sat 0.20 from the old
computed figure and came from the 14 August correction record. A label that
agreed with a recipe built on a wrong rum is further evidence those recovered
figures were derived, not read. Gate 1 failures: 20 → 22.

**Six components now name a product.** Aalborg Taffel Akvavit and La Guita
Manzanilla come from the same PDF; Bulleit Rye, Espolòn Reposado and Kwai Feh
Lychee from Matthew Clark order emails, each unit price matching Back Bar's
pack cost to the penny; Tio Pepe from Cyrus's own July note. Their ABVs stay
`assumed` — naming the bottle makes a figure checkable, it does not make it
checked.

**One source was caught being unreliable.** The inbox search assistant reported
ABVs for Kahlúa (16.0%), Espolòn Reposado (40.0%) and Cointreau (40.0%) "from
attached invoice PDFs". Opening those emails found order confirmations with no
attachment and no ABV. None of those figures has been recorded. Price matches
from the same assistant were accepted only because it never saw Back Bar's
prices, so a penny-exact match is corroboration it could not have manufactured.

Still unnamed: Calvados (three candidates across old orders, none matching the
recorded £18.95), Mezcal (Del Maguey Vida is ordered, at £34.75 against £35.80
recorded), Blue Curaçao (Bols, £11.55 against £11.73), Triple Sec (Cointreau on
a 2022 order, no current price match).

---

*Rulings collected 5–6 September 2026 via the Gate 1 decision sheet. Recorded
here 6 September 2026. Nothing applied to the database.*

## 9. 13 Sept 2026 — Ginger Amalthea is 50%, agreed in writing

Recorded at **50%** (was 46%, `assumed`), sourced to the distillery's own
commitment. Adam Lock, Lead Distiller, 12 Sept 2026: *"We'll then be ready to
dilute them down to 50% and get them ready for transfer over to you."* The
thread "Christmas Gingertini Gin ABV%?" shows how it was agreed: the sample was
50%, the drink was tested at 50% (Cyrus, 7 Sept), and the distillery preferred
50% (Arnold Harrison, 9 Sept). 46% had been quoted for order PU215780 in August,
and the distillery now thinks that figure belongs to the Vesper gin.

This is a specification, not a measurement. Batch AGG-001 is due w/c 5 Oct 2026;
check the delivered paperwork on arrival.

Christmas Gingertini's computed ABV moves from 20.0% to **21.4%**. It carries no
declared label figure, so Gate 1 still cannot check it — but any figure given to
Fortnum & Mason for that label should be the 21.4%, not the old 20.0%.

The component note, which ended "46 stands" after a 46 -> 42 -> 46 reversal on
23 Aug made from recollection, has been replaced. The price, borrowed from
standard Amalthea at £16.67/L, is now marked `placeholder` pending a real quote;
if that rate is duty-inclusive, the real one will be higher, because duty scales
with strength.

One quantity worth checking with the distillery, from Adam's own figures: 75 L
at 75% dilutes to about 122 L at 46% but about 112 L at 50%, against 124 L
ordered.

## 10. 13 Sept 2026 — the Matthew Clark price letter, and the last four names

Cyrus supplied the four remaining product names, and Matthew Clark's
price-change letter to account 50900601 (11 Feb 2026, effective 2 Mar 2026)
corroborated three of them to the penny: **Del Maguey Vida** mezcal (£35.80),
**Bols** Blue Curaçao (£11.73), **Cointreau** (£21.62). **Avallen** Calvados is
not on the letter. With those, every category-named component now names a
product. Their ABVs remain `assumed`.

**Chinotto Nero is a liqueur.** The letter lists it as `MUYU CHINOTTO NERO LIQU
50X6`. Back Bar records its ABV as blank, which every recipe reads as 0%, and it
is in all three Clementini recipes — so the F&M flagship's computed ABV is
understated by however strong it is. It is now the most consequential missing
figure in the range.

The same letter was then misused as a cost source, and the misuse was undone
the same evening.

A price list says what a supplier would charge. It is not evidence of where
Myatt's Fields buys or what it pays. Cyrus: *"Just because we have a price from
Matthew Clark doesn't mean we buy from them"* — and there are better prices
elsewhere. The first reconciliation script's own header said a price list is
not evidence of what was paid, and it wrote four rows anyway:

- **#119 Rye, #121 Lillet Blanc, #122 Campari** — `manual` rows citing the
  letter, which made three unsourced costs look sourced.
- **#120 Chinotto Nero** — moved the cost from £22.57 to the letter's £23.67.

All four were deleted by `fix-mc-letter-misuse-20260913.ts`, guarded so it
could touch only those rows. Rye, Campari and Lillet Blanc are back to
unsourced, which is the truth. Chinotto Nero is back to £22.57 and marked
`placeholder`, because £22.57 is itself only Matthew Clark's pre-March list
price. The writing script is replaced by a read-only report.

What the letter legitimately shows is where recorded costs came from: 19 of 21
equal a Matthew Clark list price (18 the March price, 1 the pre-March), which
ties those components to those products. It does not show the price actually
paid for any of them. Carpano Antica (Back Bar £27.36) and Cocchi Americano
(£18.42) match neither list price, plausibly because they are bought elsewhere.

Still open on cost:

- **Calvados.** Recorded 700 ml at £18.95. An inbox summary reports Avallen
  bought as a 4.5 L at £152.38 — about 25% more per ml. Pack or price is wrong.
- **Kahlúa.** Recorded £13.43 (the Matthew Clark price), but the most recent
  orders — 60 in August, 90 in September 2026 — were from Master of Malt at
  £15.36, about 14% more. If that is now the supplier, the cost is understated.
- **"Epsolon Blanco Tequila"** is misspelt; the product is Espolòn.

## 11. 13 Sept 2026 — Chinotto Nero is 24%

Recorded at **24%** (was blank, which every recipe read as 0%), under a new
source label, `retailer_listing`, ranked below a producer's spec and below an
invoice because a retailer can copy an error. Cyrus cited The Whisky
Exchange's listing; Royal Mile Whiskies' own listing is titled "Muyu Chinotto
Nero Liqueur 24% 50cl". Neither page body could be read from here, so it rests
on a listing title and Cyrus's reading. All three Clementini recipes are
corrected. None carries a label figure yet, so Gate 1 still cannot check them.
