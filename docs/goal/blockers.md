---
title: Tenant Panel Program Blockers
status: active
date: 2026-10-10
---

# Blockers

Items that need something only the owner can provide. Each shows the exact
action and information required. Features that depend on these ship fully built
but disabled behind tenant-level configuration.

## B-001 Production deploy target and verification access - OPEN

- What is needed: the approved production Convex deployment name/target and a
  deploy credential (the runbook expects an approved `.env.deploy`), plus a real
  test tenant account and sign-in credentials for post-deploy verification. Do
  not paste secrets into chat; place them in the approved secret store or the
  approved deployment environment file.
- Impact: production deploy and live verification cannot run. This repository's
  own records state that production Convex functions/schema remain undeployed
  pending an approved target and credential.
- Workaround applied: all code is built and verified locally (typecheck, lint,
  tests). Deployment stays pending.

## B-002 Payment gateway credentials - OPEN

- What is needed: sandbox credentials for M-Pesa Daraja (Kenya), Airtel Money
  (Uganda/Tanzania) and the chosen pan-African aggregator, plus confirmation of
  the per-country aggregator choice (decision D-004).
- Impact: PAY-01/PAY-02/PAY-03 and reconciliation (PAY-02, PAY-03) ship
  disabled. Real charges must never run in tests.

## B-003 Messaging provider credentials - OPEN

- What is needed: Africa's Talking (SMS/USSD) API key, sender ID, and WhatsApp
  Cloud API credentials/number.
- Impact: COM channels (COM-01, COM-03, COM-04) ship disabled. Tests use test
  recipients only.

## B-004 Tax authority integration credentials - OPEN

- What is needed: the certified-provider credentials for Kenya eTIMS, Uganda
  URA EFRIS and Tanzania TRA VFMS, or a decision on which provider to use
  (D-006).
- Impact: CPL-01 tax e-invoicing ships disabled.

## B-005 Paid services approval - OPEN

- What is needed: approval to purchase any paid service required (for example a
  WhatsApp Business number or a paid aggregator account). The program will not
  enter payment details.
- Impact: affected features ship disabled until credentials exist.

## B-006 Retention period confirmation - OPEN

- What is needed: confirmed per-country retention periods for session and CGNAT
  logs (D-008).
- Impact: no retention deletion jobs are enabled until confirmed.
