# Web feature ownership

This is the developer-facing map for every web surface. `app/` owns URLs,
layouts, and thin entrypoints only; panel implementation belongs here.

| Folder | Owns |
| --- | --- |
| `landing/` | Public landing, marketing content, legal, resources, and conversion UI |
| `captive-portal/` | Future hostname-resolved hotspot portal |
| `dashboard/` | Tenant dashboard and workspace |
| `admin/` | Tenant administration entry surface |
| `platform/` | Platform-owner administration |
| `reseller/` | Reseller panel |
| `agency/` | Agency panel |
| `partner/` | Partner panel |
| `subscriber-portal/` | Future subscriber self-service portal |

Do not add substantive UI to `app/` route folders. Add it to the appropriate
feature folder, then expose it with a thin route file.
