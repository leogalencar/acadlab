# Logging & Audit Policy

This document describes how Acadlab captures, stores, and surfaces audit logs.

## Importance Levels

Every audit span now receives an `importance` flag:

- `high`: Sensitive mutations (auth, user management, laboratory changes, etc.). Always logged and persisted.
- `normal`: Default for other mutations. Logged when `AUDIT_LOG_LEVEL` allows it and persisted unless disabled.
- `low`: Read operations and page renders. Skips start/success logs by default to reduce noise and never persists unless explicitly requested.

### Environment Controls

| Variable | Default | Description |
| --- | --- | --- |
| `AUDIT_LOG_LEVEL` | `high` | Minimum importance that produces console logs (`low`, `normal`, `high`). Failures are always logged. |
| `AUDIT_LOG_PERSISTENCE` | `true` | Set to `false` to disable writing to the `AuditLog` table (not recommended). |

Set `AUDIT_LOG_LEVEL=normal` if you need more verbose logging temporarily and revert to
`high` to minimize noise.

## Persistence

Important audit events are written to the `AuditLog` table. Run the new migration after pulling these changes:

```bash
pnpm prisma migrate dev -n "add_audit_logs"
```

Use `pnpm prisma generate` if your editor requires updated types.

The new `/logs` admin page lets administrators review recent entries with filters for level, module, action, and text search. Only administrators can access this view.

### Retention & Cleanup

Logs are stored indefinitely by default. To prune old entries, schedule a periodic job (cron, Prisma script, etc.) that deletes rows older than your retention policy.

Example cleanup script:

```ts
await prisma.auditLog.deleteMany({
  where: { createdAt: { lt: subMonths(new Date(), 3) } },
});
```

## When to Persist Logs

High-level guidelines:

- **Must persist**: authentication events, role changes, CRUD actions on laboratories/software/users/system rules, scheduling mutations.
- **Optional**: background notifications, list queries, dashboard/page renders (keep `importance: "low"`).
- **Never**: UI-only events (focus, hover) — these should not trigger server actions.

If you add a new mutation, initialize its audit span with `{ importance: "high", persist: true }` to ensure it is captured.

## Viewing Logs & Saúde do Sistema

- Navigate to `/logs` (admin only) to inspect the raw feed. Use the filters to narrow by severity,
  module, action, or search for specific text/IDs. Click a row to expand the structured payload.
- Visit `/system-health` for a high-level "Saúde do sistema" dashboard that aggregates counts,
  recent errors, trend lines, and top modules so administrators can quickly assess the state of the
  platform. Legacy bookmark `/dashboard/admin` now redirects here.

Keep this policy updated when new modules or logging requirements are introduced.
