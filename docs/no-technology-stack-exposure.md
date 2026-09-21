---
title: MylesNet No Technology Stack Exposure
status: active
date: 2026-09-17
---

# MylesNet No Technology Stack Exposure

This repository standard implements the vault policies [[No Technology Stack Exposure Standards]] and [[no-tech-stack-exposure|MylesNet No Technology Stack Exposure]]. It is mandatory for every panel, route, API response, authenticated flow, integration, and user-visible state.

## Required practice

- Use business language such as workspace, subscriber, invoice, payment, plan, voucher, ticket, and report.
- Never render framework or provider names, exceptions, stack traces, source paths, raw payloads, endpoint URLs, environment values, internal IDs, or deployment details.
- Translate every untrusted failure through `apps/web/shared/lib/user-facing-error.ts` before it is rendered.
- Keep detailed diagnostics in protected server logging only. API failures return safe `{ success: false, message: "..." }` responses.
- Keep raw operational configuration, credentials, organization identifiers, and integration responses out of ordinary product screens.

## Required boundaries

Recovery behavior must exist at the application root, authenticated shell, panel section, widget, modal or drawer, and form or mutation level. Each boundary preserves the product shell where possible, provides a safe retry or return action, and never displays diagnostics.

## Safe categories

| Category | Safe outcome |
|---|---|
| Authentication | Ask the user to sign in again. |
| Permission | Explain that access is restricted and direct the user to an administrator. |
| Validation | Identify the field in business language and retain entered values. |
| Network | Explain that the service cannot be reached and offer retry. |
| Provider | Explain that the action could not be completed without naming the provider. |
| Unexpected | Explain that the action could not be completed and offer safe recovery. |

## Verification

Before merge or release, confirm that:

- Failure-path tests prove raw exception text and provider details are not rendered.
- Loading, empty, offline, toast, confirmation, and validation copy uses product language.
- Screens do not reveal raw IDs, request URLs, environment configuration, JSON payloads, or implementation names.
- Authorized operational views mask sensitive data by default and do not expose secrets.

## Canonical records

- Vault cross-product policy: `C:\Obsidian\MylesCorp-Brain\No Technology Stack Exposure Standards.md`.
- Vault product policy: `C:\Obsidian\MylesCorp-Brain\products\mylesnet\no-tech-stack-exposure.md`.
- Local enforcement: `AGENTS.md` and the Daily Agenda Rule in `docs/technology-stack.md`.
