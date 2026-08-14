# Macro-events source review

Reviewed 14 August 2026 for the eight curated context markers in `src/data/snapshot.json`.

The descriptions are intentionally short and descriptive. They identify a dated macro or policy context without claiming that one event alone caused a repo-rate decision. Every citation is hosted on RBI, RBI Docs, the Ministry of Home Affairs, or CBIC.

| Event | Source-backed wording | Primary source |
| --- | --- | --- |
| 15 Sep 2008 — Global financial crisis | RBI’s 2008–09 Annual Report describes the sharp deterioration in global financial conditions, the September 2008 crisis, and the subsequent shift toward easing and preserving orderly markets. | [RBI Annual Report 2008–09](https://rbi.org.in/scripts/AnnualReportPublications.aspx?Id=896) |
| 22 May 2013 — Tapering shock | RBI records the US Federal Reserve’s tapering signal, capital outflows, pressure on the rupee, and reserve depletion during 2013. | [RBI publication on the 2013 tapering episode](https://systemhealth.rbi.org.in/Scripts/PublicationsView.aspx_id%3D15709.html) |
| 8 Nov 2016 — Currency withdrawal | RBI’s notice records the withdrawal of legal-tender character for existing ₹500 and ₹1,000 notes under the 8 November 2016 notification. | [RBI notice on withdrawal of legal tender](https://www.rbi.org.in/commonman/english/Scripts/Notification.aspx?Id=1938) |
| 1 Jul 2017 — GST rollout | CBIC records that GST was introduced on 1 July 2017. | [CBIC GST press note](https://cbic-gst.gov.in/pdf/press-release/press-relese-gst-02092017.pdf) |
| 24 Mar 2020 — National lockdown | The MHA/PIB release records the 24 March order and a 21-day nationwide lockdown effective from 25 March 2020. | [MHA national lockdown order](https://www.mha.gov.in/sites/default/files/PR_NationalLockdown_26032020.pdf) |
| 24 Feb 2022 — War in Ukraine | RBI’s 2022–23 Annual Report links the war in Ukraine with higher food, energy, and other commodity prices and sustained inflation pressure. | [RBI Annual Report 2022–23](https://www.rbi.org.in/scripts/AnnualReportPublications.aspx?Id=1373) |
| 4 May 2022 — Off-cycle tightening | RBI’s notification records a 40 bps increase in the policy repo rate to 4.40% with immediate effect. | [RBI standing liquidity facility notification](https://www.rbi.org.in/scripts/FS_Notification.aspx?Id=12311) |
| 7 Feb 2025 — Easing cycle begins | The official MPC resolution records a 25 bps cut in the policy repo rate to 6.25% and continuation of a neutral stance. | [RBI Docs MPC resolution, February 2025](https://rbidocs.rbi.org.in/rdocs/PressRelease/PDFs/PR2094189B0DF105514A28A2FA834330E94B26.PDF) |

## Validation notes

- `snapshotV2.js` validates every event’s id, date, label, description, type, and citation.
- Event citations must resolve to `rbi.org.in` or an RBI subdomain, `cbic-gst.gov.in` or a CBIC subdomain, or `mha.gov.in` or an MHA subdomain.
- The event shape remains unchanged: `{ id, date, label, description, type, citation }`.
- This is a source review for an educational interface, not a claim that the compiled context is exhaustive or a substitute for the original records.

