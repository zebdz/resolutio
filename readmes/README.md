# Documentation index

Start here to find current work and task-relevant documentation. Read linked documents as needed;
this index does not require loading every reference or historical plan.

## Active work

| Feature                    | Design                                                       | Implementation plan                                        | Status                                         |
| -------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------- | ---------------------------------------------- |
| Poll sealing and anchoring | [Approved design](2026-09-11-poll-seal-and-anchor-design.md) | [Phased plan](../plans/2026-09-15-poll-seal-and-anchor.md) | Decisions resolved; implementation not started |

## Reference documents

These are entry points, not a claim that every document has been audited against the current code.
Verify commands and implementation details against the relevant source, tests and configuration.

| Topic                            | Start here                                                             |
| -------------------------------- | ---------------------------------------------------------------------- |
| Product overview and local setup | [Project README](../README.md)                                         |
| Repository conventions           | [AGENTS.md](../AGENTS.md)                                              |
| Testing                          | [Testing guide](Testing.md)                                            |
| Database changes                 | [Prisma migration workflow](Prisma-Migration-Workflow.md)              |
| Deployment                       | [Deployment summary](DEPLOYMENT-SUMMARY.md)                            |
| Request limits                   | [Rate limiting](Rate-Limiting.md)                                      |
| OTP behavior                     | [OTP throttle](OTP-Throttle.md), [Russian version](OTP-Throttle-ru.md) |

## Designs and history

- Other feature designs are in this directory, usually named `YYYY-MM-DD-<feature>-design.md`.
  Find the relevant feature by filename first. A design records intended behavior; its presence
  does not establish that the feature shipped or still behaves exactly as described.
- [Active plans](../plans/) describe ongoing implementation work and review gates.
- [Archived plans](../plans/archive/) preserve historical proposals and reasoning. Their completion
  and currency are unverified unless explicitly documented. Read them when the task needs history;
  do not treat their instructions as current requirements.

## Keeping this index useful

Add active work with its design, plan and status. Update the entry when scope or status changes.
When work finishes, update its durable design/reference docs, record deviations and remaining
limitations, archive the plan, and move the entry out of active work. Archived plans stay historical;
new requirements belong in current documentation.
