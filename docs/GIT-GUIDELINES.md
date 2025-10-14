# Git Workflow & Branching Guidelines

This document defines the **branching model** and **workflow rules** for managing code in this project.

---

## Main Branch (`main`)

### Purpose

`main` is the **production-ready branch**. It represents the latest **stable release** of the project.

### Rules

* **Allowed merges:** Only via **rebase commits** (no merge or squash) after PR review.
* **Direct pushes:** Not allowed.
* **Protected branch:** Must be configured as a **protected branch** in your Git hosting service (GitHub, GitLab, etc.).
* **Goal:** Always keep `main` deployable.

### Example

```bash
# Updating main after verifying in develop
git checkout main
git pull origin main
git rebase origin/develop
git push origin main
```

---

## Development Branch (`develop`)

### Purpose

`develop` is the **integration branch** for ongoing development.
It collects all completed features before they are promoted to `main`.

### Rules

* **Allowed merges:** Only **squash commits** from feature branches.
* **Direct pushes:** Allowed but discouraged (use feature branches).
* **Recommended flow:** Work in a feature branch, squash merge to `develop`.

### Example

```bash
# Standard feature flow
git checkout develop
git checkout -b feature/new-login
# ... work on feature ...
git add .
git commit -m "feat: implement new login"
git push origin feature/new-login
# After review
git checkout develop
git merge --squash feature/new-login
git commit -m "feat: add new login functionality"
git push origin develop
```

---

## Temporary Branches (`feature/*`, `bugfix/*`, `hotfix/*`, etc.)

### Purpose

Used for isolated development of new features, bug fixes, experiments, or urgent hotfixes.

### Naming Convention

| Type        | Description                            |
| ----------- | -------------------------------------- |
| `feature/`  | New features or enhancements           |
| `bugfix/`   | Fixes for non-critical issues          |
| `hotfix/`   | Urgent fixes for production issues     |
| `chore/`    | Maintenance or tooling updates         |
| `refactor/` | Code improvements without new features |

Example branch names:

```
feature/user-auth
bugfix/navbar-overflow
hotfix/login-crash
```

### Rules

* **Direct pushes:** Allowed.
* **Merge type:** Only **squash commits** into `develop`.
* **Cleanup:** Delete the branch after merging to `develop`.
* **Commit style:** Follow [Conventional Commits](https://www.conventionalcommits.org/).

### Example

```bash
git checkout develop
git checkout -b feature/payment-integration
# ... work ...
git add .
git commit -m "feat: integrate payment API"
git push origin feature/payment-integration
# After review and test
git checkout develop
git merge --squash feature/payment-integration
git commit -m "feat: add payment integration"
git push origin develop
git branch -d feature/payment-integration
git push origin --delete feature/payment-integration
```

---

## Summary Table

| Branch Type | Merge Type | Direct Push          | Destination        | Auto-Delete | Description                  |
| ----------- | ---------- | -------------------- | ------------------ | ----------- | ---------------------------- |
| `main`      | **Rebase** | 🚫 No                | N/A                | N/A         | Production-ready             |
| `develop`   | **Squash** | ⚠️ Yes (discouraged) | `main`             | N/A         | Integration for new features |
| `feature/*` | **Squash** | ✅ Yes                | `develop`          | ✅ Yes       | New features                 |
| `bugfix/*`  | **Squash** | ✅ Yes                | `develop`          | ✅ Yes       | Non-critical fixes           |
| `hotfix/*`  | **Squash** | ✅ Yes                | `develop` / `main` | ✅ Yes       | Urgent production fixes      |

---

## Prisma Client Automation

- `pnpm install` triggers the `postinstall` script, which runs `prisma generate` so that every local environment has an up-to-date client immediately after installing dependencies.
- `pnpm build` triggers the `prebuild` script, repeating `prisma generate` to guarantee that CI pipelines and production builds compile with the latest schema.
- Because of these hooks, running `pnpm build` is required before opening a pull request—this single command verifies both type safety and Prisma readiness.
