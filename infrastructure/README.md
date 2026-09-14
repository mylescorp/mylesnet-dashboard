# infrastructure/

Infrastructure-as-Code, container, monitoring, and operations runbooks (per
`docs/technology-stack.md` Monorepo Shape). Skeletons only — no live infra yet.
Terraform controls all AWS/Cloudflare infrastructure; no infra change is applied
by hand. See `docs/technology-stack.md` (CI/CD, IaC, and supply-chain security).

- `terraform/` — VPC, ECS Fargate, RDS Multi-AZ, Redis, SQS/EventBridge/DLQ, S3,
  Secrets Manager, KMS, CloudWatch, Cloudflare.
- `docker/` — reproducible worker/radius images (multi-arch, minimal base).
- `monitoring/` — OpenTelemetry, CloudWatch, Prometheus/Grafana, Sentry.
- `runbooks/` — tenant onboarding, RADIUS node failure, connector compromise,
  data restore, security incident, etc.
