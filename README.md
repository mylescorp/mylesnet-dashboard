# MylesNet Dashboard

MylesNet is a multi-tenant ISP billing and subscriber-operations SaaS for MylesCorp Technologies Ltd. One deployed web application serves the public site, platform control plane, tenant billing workspace, subscriber portal, and delegated reseller surfaces.

## 🏗️ Repository Structure

```text
mylesnet-dashboard/
├── apps/
│   ├── web/              # Next.js web product (main application)
│   └── mobile/           # Reserved for future Expo mobile applications
├── convex/               # Convex backend (schema, functions, auth)
├── packages/             # Shared packages
│   ├── ui/              # Shared UI components
│   ├── schemas/         # Shared TypeScript schemas
│   ├── api-contracts/   # API contracts and types
│   └── config/          # Shared configuration (TS, ESLint, Tailwind)
├── services/            # Future private services
│   ├── network-worker/  # Go device and RADIUS-control worker
│   ├── radius/          # FreeRADIUS configuration
│   └── communications/  # SMS/email adapter gateway
├── infrastructure/      # Infrastructure and operational runbooks
├── docs/                # Product documentation and vault mirrors
└── vendor/              # Third-party skills and dependencies
```

## 🚀 Quick Start

### Prerequisites

- **Node.js**: >= 24 (required by package.json engines)
- **pnpm**: 10.33.0 (packageManager is pinned)
- **Convex account**: For backend deployment
- **WorkOS account**: For authentication

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/mylescorp/mylesnet-dashboard.git
   cd mylesnet-dashboard
   ```

2. **Install dependencies**
   ```bash
   pnpm install --frozen-lockfile
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` with your actual values. Key variables needed:
   - Convex: `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOY_KEY`
   - WorkOS: `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, `WORKOS_COOKIE_PASSWORD`
   - Site: `NEXT_PUBLIC_SITE_URL`
   
   See `.env.example` for complete variable list with descriptions.

4. **Start development server**
   ```bash
   pnpm dev
   ```
   
   The application will be available at `http://localhost:3000`

## 🛠️ Technology Stack

### Core Technologies

| Layer | Technology |
|-------|------------|
| **Monorepo** | pnpm, Turborepo, TypeScript |
| **Web Framework** | Next.js 16.3.4, React 19.2.8 |
| **Styling** | Tailwind CSS 4, shadcn/ui, Radix UI |
| **Backend** | Convex (queries, mutations, actions, HTTP routes, crons) |
| **Authentication** | WorkOS AuthKit (workforce), Auth0 (subscribers - future) |
| **Hosting** | Vercel (web), Convex (backend) |
| **Forms** | React Hook Form, Zod |
| **Data Tables** | TanStack Table |
| **Charts** | Recharts |
| **Icons** | Lucide React |

### Architecture Principles

- **Single Next.js App**: Serves multiple panels (Platform, Admin, Dashboard, Reseller, Agency, Partner, Subscriber Portal) through route scoping
- **Tenant Isolation**: Every tenant-owned record carries `tenantId` with strict enforcement
- **No Technology Drift**: All additions must be approved and documented in `docs/technology-stack.md`
- **Security First**: No secrets in code, proper RBAC, audit logging, CSRF protection

## 📁 Panel Structure

The web application is organized into panels:

| Panel | Route | Purpose | Location |
|-------|-------|---------|----------|
| **Landing** | `/` | Public marketing site | `apps/web/landing/` |
| **Platform** | `/platform` | MylesCorp platform control | `apps/web/platform/` |
| **Admin** | `/admin` | Tenant administration | `apps/web/admin/` |
| **Dashboard** | `/dashboard` | Tenant billing & subscriber workspace | `apps/web/dashboard/` |
| **Reseller** | `/reseller` | Reseller management | `apps/web/reseller/` |
| **Agency** | `/agency` | Agency panel (gated) | `apps/web/agency/` |
| **Partner** | `/partner` | Partner panel (gated) | `apps/web/partner/` |
| **Subscriber Portal** | `/subscriber-portal` | Subscriber self-service | `apps/web/subscriber-portal/` |
| **Captive Portal** | `/hotspot` | T-HOT captive portal (deferred) | `apps/web/captive-portal/` |

## 🔐 Authentication & Authorization

### Workforce Identity (WorkOS AuthKit)

- **Platform Org**: MylesCorp staff access
- **Network Org**: Network operations access  
- **Tenant Orgs**: One per ISP tenant for administrators
- **MFA**: Mandatory for platform_owner, platform_admin, ops_manager, finance_manager
- **Session Management**: httpOnly, Secure, SameSite=Lax cookies

### Subscriber Identity (Auth0 - Future)

- Phone-OTP-first sign-in with password fallback
- Tenant-selected SMS providers through communications adapter
- Never grants staff/network privileges

### RBAC System

- **Roles**: Defined in Convex `roles` table with permissions
- **Panel Access**: Role-based panel requirements (see `apps/web/shared/auth/panelAccess.ts`)
- **Authorization**: Enforced in Convex functions, not just UI
- **Audit Trail**: All actions logged in `auditLog` table with hash chain verification

## 🗄️ Database Schema (Convex)

Key tables include:

- **tenants**: Multi-tenant organization records
- **users**: User profiles with WorkOS sync
- **roles**: Role definitions with permissions
- **markets**: Geographic markets
- **subscribers**: Subscriber records
- **services**: Service plans and packages
- **invoices**: Billing invoices
- **payments**: Payment records
- **auditLog**: Audit trail with hash chain verification

See `convex/schema.ts` for complete schema definition.

## 🎨 Design System

### Design Tokens

- **Primary**: Orange `#FA8200` (Centipid parity)
- **Neutrals**: Graphite `#0E1116` (no navy)
- **Typography**: Inter (UI), JetBrains Mono (code), Space Grotesk (display)
- **Components**: shadcn/ui primitives with custom token mapping

See `docs/design/tokens.md` for complete token system.

### Styling Rules

- Use semantic tokens, not hardcoded colors
- Follow `--primary`, `--surface`, `--danger` semantic system
- Component tokens for repeated patterns (`--sidebar-*`, `--chart-*`)
- Enforced by `pnpm tokens:check`

## 🧪 Testing & Verification

### Run Tests

```bash
# Run all tests
pnpm test

# Run UI tests
pnpm test:ui

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Design token validation
pnpm tokens:check
```

### Build Verification

```bash
# Build the application
pnpm build
```

## 🚢 Deployment

### Pre-deployment Checklist

Before deploying, run the release gate:

```powershell
npm ci
npm run lint
npx tsc --noEmit
npm test
npm run build
git diff --check
```

All commands must pass before deployment.

### Deployment Order

1. **Deploy Convex Backend**
   ```bash
   npx convex deploy --env-file .env.deploy --typecheck try --message "<change summary>"
   ```

2. **Deploy Next.js Frontend**
   ```bash
   npx vercel --prod --yes
   ```

3. **Verify Deployment**
   - Confirm frontend points to production Convex URL
   - Verify WorkOS callback URLs match deployed hostname
   - Test authentication flow
   - Verify role-based access

### Production Environment

- **Vercel Project**: https://vercel.com/mylescorp/mylesnet-dashboard
- **Convex Production**: `precious-chipmunk-720`
- **Production Host**: `https://mylesnetisp.mylescorptech.com`
- **WorkOS Environment**: MylesCorp Technologies — MylesNet (sandbox)

## 📚 Documentation

### Key Documentation Files

| File | Purpose |
|------|---------|
| `AGENTS.md` | Agent rules and skills reference |
| `docs/technology-stack.md` | **Canonical technology contract** |
| `docs/decisions.md` | Build decisions and change log |
| `docs/architecture/MylesNet_Multi_Tenant_ISP_Radius_SaaS_Technical_Specification_v3.md` | Master technical specification |
| `docs/auth/README.md` | Authentication implementation notes |
| `docs/design/tokens.md` | Design token system |
| `docs/production-deployment.md` | Deployment procedures |
| `docs/no-technology-stack-exposure.md` | Security requirements for UI |

### Vault System

The canonical documentation lives in the MylesCorp Brain vault:
- **Vault Path**: `C:\Users\Admin\MylesCorp-Brain\products\mylesnet\`
- **Sync Rule**: Repository docs are byte-identical mirrors of vault files
- **Drift Control**: Any divergence must be resolved immediately

## 🔒 Security Standards

### Mandatory Requirements

- **No Secrets in Code**: All secrets in environment variables or secret stores
- **No Hardcoded Values**: All configuration via environment variables
- **No Placeholder Data**: Never use fake data or example values
- **TypeScript Strict Mode**: No `any` types, no type casting shortcuts
- **Input Validation**: All Convex functions must validate inputs
- **Audit Logging**: All mutations must be auditable
- **Error Handling**: Explicit error handling, never silent failures
- **Rate Limiting**: On all public-facing API routes

### Authentication Requirements

- All Convex functions must authenticate the caller
- Role-based authorization on all protected routes
- CSRF protection on all mutating routes
- Secure cookie handling (httpOnly, Secure, SameSite)
- MFA enforcement for privileged roles

## 🌐 Development Workflow

### Branch Strategy

- `main`: Production-ready code
- Feature branches: For new features
- Always create Linear issues before starting work

### Commit Standards

- Reference Linear issue ID in commit messages: `[MYL-XXX] description`
- Follow conventional commit format
- Never leave uncommitted changes

### Pre-commit Checks

- Type checking: `pnpm typecheck`
- Linting: `pnpm lint`
- Testing: `pnpm test`
- Build: `pnpm build`

## 📦 Package Management

### pnpm Configuration

- **Version**: 10.33.0 (pinned in package.json)
- **Workspace**: Turborepo monorepo structure
- **Lockfile**: Single pnpm-lock.yaml at root
- **Installation**: Always use `--frozen-lockfile` in CI

### Adding Dependencies

1. Check if the package is in `docs/technology-stack.md`
2. If not, it requires approval and documentation
3. Add to appropriate workspace (`apps/web/` or root)
4. Run `pnpm install` to update lockfile
5. Test thoroughly before committing

## 🐛 Troubleshooting

### Common Issues

**Port 3000 already in use**
```bash
# Kill process on port 3000 (Windows)
netstat -ano | findstr :3000
taskkill //F //PID <PID>
```

**Convex connection issues**
- Verify `NEXT_PUBLIC_CONVEX_URL` in `.env.local`
- Check Convex deployment is running
- Ensure Convex deploy key is valid

**WorkOS authentication failures**
- Verify `WORKOS_CLIENT_ID` and `WORKOS_API_KEY`
- Check redirect URIs match in WorkOS dashboard
- Ensure cookie password is set correctly

**TypeScript errors**
- Run `pnpm typecheck` to see full error list
- Check for stale `.next` build artifacts
- Restart dev server after schema changes

## 🤝 Contributing

### For Developers

1. Read `AGENTS.md` for agent rules and skills
2. Read `docs/technology-stack.md` before any architecture decisions
3. Check `docs/decisions.md` for recent decisions
4. Follow the coding standards in `AGENTS.md`
5. Always test before committing
6. Update documentation with any changes

### Code Standards

- **No comments added or removed** unless asked
- **Compact code** — collapse duplicate else branches
- **Idiomatic conventions** for the language
- **Explicit error handling** — no silent failures
- **Production-ready** from first write — no dev shortcuts

## 📞 Support

For project-specific questions:
- **Linear**: https://linear.app/mylesoft (team: Mylesoft Technologies)
- **Vault**: `C:\Users\Admin\MylesCorp-Brain\products\mylesnet\`
- **Author**: Jonathan Myles, MylesCorp Technologies Ltd

## 📄 License

Proprietary - MylesCorp Technologies Ltd

---

**Note**: This is a production SaaS platform handling sensitive ISP operations data. Follow all security standards and never commit secrets or expose internal implementation details to users.