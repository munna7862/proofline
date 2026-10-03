# Go to market

## Who buys
- **User:** SDETs and QA engineers on Playwright.
- **Buyer:** QA lead, QA manager, engineering manager. They need to answer "Is our automation worth what we spend on it?" and "Can we trust AI-written tests?"
- **Best first customers:** product companies with 50–1,000 Playwright tests, a real backend, CI on GitHub Actions. Startups and mid-size SaaS move faster than large enterprises.

## Positioning
"Coverage tells you what your tests ran. Proofline tells you what they'd catch."

## Validation (week 1–2)

**Template A, LinkedIn DM to a QA lead (edit, keep it short):**
> Hi <name>, I'm an SDET building a small tool for Playwright suites. It breaks your APIs on purpose during a test run and shows which tests still pass. On a demo app, one test "passed" through 8 different faults. Screenshot attached. Would you try it on your suite if it took one import change? Not selling anything yet, just checking if this is useful.

**Questions for calls (15 minutes):**
1. How do you decide today whether a test is a good test?
2. When did a bug last reach production even though tests were green? What happened?
3. If this ran in CI, who would look at the report? What would make them act?
4. What would a team like yours expect to pay for this per month?

Signal to proceed: 3 of 10 say "I'd run it on my suite this week".

## Pricing (hypothesis; validate in calls)
| Plan | Price | For | Includes |
|---|---|---|---|
| Community | Free, MIT | Individuals | Coverage, fault check, HTML report, CLI gate, VS Code lens |
| Pro | $29 / ₹1,999 per repo per month | Teams starting out | PR gate vs main baseline, trend history, shard merge, AI fix suggestions |
| Team | $199 / ₹14,999 per month | Several repos | Hosted dashboard (TestPulse), Slack/Teams alerts, 10 repos |
| Enterprise | Custom | Regulated orgs | Self-hosted, audit export, SSO, support SLA |

## Launch (week 6)
1. Write up findings from one public suite, shared with maintainers first. Lead with what they do well.
2. Post on LinkedIn (your network is your best channel), dev.to, r/QualityAssurance, r/softwaretesting, Playwright community channels.
3. 60-second video: one import change, run, open report, replay a slipped fault.
4. Offer free "suite check" calls to the first 20 teams: you run it with them, they tell you what's wrong with the tool.

## First 10 paying customers playbook
- Every free user who runs a scan gets a personal message within 24 hours.
- Ask the happy ones: "What would make this worth paying for at work?" Build only what 3+ ask for.
- Invoice manually at first. Add self-serve payments when manual invoicing takes more than an hour a week.
