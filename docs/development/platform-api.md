# Platform API v1

This document describes the first API-key-protected external platform endpoint. API keys are bearer credentials; keep them in a secret manager and transmit them only over HTTPS.

## `GET /api/platform/v1/organizations`

Requires an active platform API key with the `organizations:read` scope.

Query parameters:

- `limit`: optional page size, clamped to 1–50 (default 20).
- `cursor`: optional opaque cursor returned by the previous response.

The response contains a `data` page with organization ID, name, slug, country, currency, status, and provisioning timestamp, plus a `pagination` object with `nextCursor` and `isDone`. It omits tenant settings, contact details, subscriber records, and WorkOS organization IDs.

Missing, invalid, expired, revoked, or insufficient-scope credentials return HTTP 401. Convex/backend unavailability returns HTTP 503. Responses are marked `Cache-Control: no-store`.

Tokens are generated with 256 bits of cryptographic randomness. The platform stores only SHA-256 digests; the cleartext token is returned only from key creation. Key rotation is performed by issuing a replacement then revoking the old key. Additional scopes must not be enabled until their corresponding endpoint and authorization tests exist.
