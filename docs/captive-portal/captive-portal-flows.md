---
type: design
status: active
date: 2026-09-10
tags:
  - mylesnet
  - captive-portal
  - flows
  - design
---

# MylesNet Captive Portal — User Flows

Companion to [[captive-portal-specification|MylesNet Captive Portal Specification]].
All flows are canonical; implementation must match these transitions. Repo mirror:
`docs/captive-portal/captive-portal-flows.md`.

## 1. Arrival and detection

```mermaid
flowchart TD
    A[Device connects to WiFi] --> B{MikroTik hotspot?}
    B -- no --> Z[IP Binding / direct access<br/>no portal]
    B -- yes --> C[OS captive-portal probe<br/>or hotspot redirect]
    C --> D[Portal host resolves tenant<br/>server-side from hostname]
    D --> E{Device recognized?}
    E -- MAC-cookie / HTTP-cookie valid --> F[Reauthorize instantly]
    E -- registered device hash --> G[Reauthorize instantly]
    E -- no --> H[Manual fallback set]
    F --> I[Welcome-back dashboard]
    G --> I
    H --> J[Choose login path]
```

## 2. Reconnection decision tree (returning subscriber)

```mermaid
flowchart TD
    A[Portal visit - returning device] --> B[Run detection ladder]
    B --> C{Active entitlement<br/>for this device/phone?}
    C -- yes, device matched --> D[Welcome-back dashboard<br/>one-tap continue -> reauthorize]
    C -- yes, device unknown --> E{Choose manual path}
    C -- no --> F[Top-up / buy flow]
    E --> E1[Enter phone + OTP]
    E --> E2[Re-enter voucher]
    E --> E3[Scan voucher QR]
    E --> E4[Username / password]
    E --> E1v{Verified?}
    E1v -- yes --> D
    E1v -- no --> E1s[Join expire/retry path]
    E2 --> D
    E3 --> D
    E4 --> D
    F --> G[Plan discovery + in-portal payment]
```

> Requirement: a returning subscriber must always have **several** equivalent paths back
> online. No single disabled path can strand an active customer.

## 3. New user registration and trial

```mermaid
flowchart TD
    A[First visit] --> B[Terms + privacy acceptance<br/>recorded incl. version/device/IP]
    B --> C{Free trial available?}
    C -- yes --> D[Claim trial<br/>phone verify optional per tenant]
    D --> E{Already claimed on this device?}
    E -- inside reset window --> F[Show wait message<br/>time remaining until reclaimableAt]
    E -- reset passed or first claim --> G[Grant trial plan]
    F --> H[Offer top-up packages]
    G --> I[Provision network + connect]
    C -- no --> O[Register: phone + consent (progressive profiling)]
    O --> P[Verify phone via OTP]
    P --> Q[Plan discovery]
```

## 4. In-portal payment and activation

```mermaid
flowchart TD
    A[Select package / top-up] --> B[Payment intent created]
    B --> C{Payment method}
    C -- M-Pesa STK Push --> D[STK prompt on phone]
    C -- Mobile Money (Airtel) --> E[Airtel Money flow]
    C -- voucher / promo credit --> F[Voucher redemption]
    D --> G[Wait for provider callback]
    E --> G
    F --> G2[Server validates voucher]
    G --> H[Verify callback server-side<br/>signature + idempotency]
    H -- success --> I[Reconcile: amount/currency/tenant/ref]
    I --> J[Create or update entitlement]
    J --> K[Provision network<br/>MikroTik user/profile / RADIUS policy]
    K --> L[CoA or reauthentication]
    L --> M{Network verified active?}
    M -- yes --> N[connected + success + receipt + SMS]
    M -- no --> O[payment_confirmed / provisioning<br/>or reconnection_failed + retry]
    G -- user cancelled or error --> P[Show state: cancelled / failed / expired<br/>offer retry]
```

## 5. Free trial claim and reset

```mermaid
flowchart TD
    A[Device connects - no entitlement] --> B[Check freeTrialClaims<br/>deviceHash + phone]
    B --> C{Existing claim?}
    C -- no --> D[Create claim + grant trial<br/>set reclaimableAt = now + resetPeriod]
    C -- yes, inside window --> E[Show wait:<br/>available at reclaimableAt]
    C -- yes, window passed --> F[Allow new claim<br/>per tenant configuration]
    D --> G[Provision + connect (trial plan)]
    E --> H[Offer top-up]
    F --> D
```

## 6. Terms and consent

```mermaid
flowchart TD
    A[First connect] --> B{Current terms version<br/>accepted for device?}
    B -- no --> C[Show terms + privacy inline]
    C --> D[Accept]
    D --> E[Record termsAcceptances<br/>type terms/privacy/marketing]
    E --> F[Continue auth / trial path]
    B -- yes --> G[Continue]
```