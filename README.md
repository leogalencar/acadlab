# AcadLab

AcadLab is a web platform for integrated management of academic laboratories, built on Next.js (App Router) with strict role-based access control for professors, technicians, and administrators.

## Overview
- **User Management**: NextAuth credentials authentication plus an admin/technician-facing module to create, update, and remove user accounts.
- **Laboratories & Scheduling**: Foundations for managing lab resources, reservations, and software requests (with “coming soon” placeholders where features are still under construction).
- **User Experience**: React UI using shadcn/ui components and Tailwind CSS v4.

Check the [`docs/`](docs/) directory for module-specific quick-start and testing guides.

## Tech Stack
- **Framework**: Next.js 15.5.4 (App Router, Server Components, Turbopack)
- **Languages**: TypeScript, React 19
- **UI**: Tailwind CSS v4 + shadcn/ui (New York theme)
- **Auth**: NextAuth with Prisma Adapter (credentials provider)
- **Database**: Prisma ORM targeting MySQL
- **Data Bootstrapping**: Seeded mock accounts (admin, technician, professor)

## Architecture
```
src/
├── app/                 # App Router pages (public + protected)
├── features/            # Feature-first modules
│   ├── auth/            # Authentication flows and profile management
│   ├── dashboard/       # Protected shell, navigation, module cards
│   └── user-management/ # Admin/technician user management
├── components/ui/       # Shared UI pieces (shadcn/ui)
├── lib/                 # Utilities (e.g., `prisma`, helpers)
├── middleware.ts        # Auth guard for routes
└── auth.ts              # NextAuth configuration
```

### Access Levels
- **Professor**: Manage own account, view labs, create/cancel reservations, submit software requests.
- **Technician**: Inherits professor permissions + manage labs, software catalog, and professor accounts; handle software requests.
- **Administrator**: Inherits technician permissions + manage technician/admin accounts and system-wide rules.

Read more in [`docs/user-management.md`](docs/user-management.md).

## Prerequisites
- Node.js **v20+**
- pnpm **v9+**
- MySQL database reachable via `DATABASE_URL`

## Local Setup
1. **Clone the repository** and `cd` into it.
2. **Configure environment variables** (copy `.env.example` if available or define values such as `DATABASE_URL`, `ADMIN_EMAIL`, etc.).
3. **Install dependencies**:
   ```bash
   pnpm install
   ```
4. **Prepare the database**:
   ```bash
   pnpm prisma db push    # or pnpm prisma migrate deploy (depending on your workflow)
   pnpm prisma db seed    # creates mock admin, technician, and professor accounts
   ```
5. **Start the development server**:
   ```bash
   pnpm dev
   ```
6. Visit `http://localhost:3000`.

### Mock Accounts (Seed)
| Role          | Email                 | Default password* |
|---------------|-----------------------|-------------------|
| Administrator | `admin@acadlab.local` | `ChangeMe123!`    |
| Technician    | `tech@acadlab.local`  | `ChangeMe123!`    |
| Professor     | `prof@acadlab.local`  | `ChangeMe123!`    |

> \*Set `ADMIN_PASSWORD`, `TECHNICIAN_PASSWORD`, or `PROFESSOR_PASSWORD` in `.env` before running the seed to override the fallback password.

## Available Scripts
| Command                | Description                                                                     |
|------------------------|---------------------------------------------------------------------------------|
| `pnpm dev`             | Starts the development server (Turbopack)                                      |
| `pnpm lint`            | Runs ESLint using the flat configuration                                       |
| `pnpm build`           | Creates a production build (`--turbopack`) **⚠️ fails without access to Google Fonts** |
| `pnpm start`           | Serves the production build (requires `pnpm build`)                            |
| `pnpm prisma studio`   | Opens Prisma Studio for database inspection                                    |
| `pnpm prisma db seed`  | Reapplies mock users (and future seed data)                                    |

### Known Limitation
`pnpm build` may fail in network-restricted environments because Next.js attempts to fetch Geist fonts from `fonts.googleapis.com`. Use `pnpm dev` instead or adjust the font configuration when running offline.

## Module Directory
- **Dashboard Overview** (`/dashboard`): role-filtered list of modules. See [`docs/dashboard-overview.md`](docs/dashboard-overview.md).
- **User Management** (`/users`): CRUD for professor/technician/admin accounts (acessível para técnicos e administradores). Veja [`docs/user-management.md`](docs/user-management.md).
- **Laboratory Management** (`/laboratories`): tabela com filtros, cadastro e manutenção dos laboratórios. Detalhes em [`docs/laboratory-resources.md`](docs/laboratory-resources.md).
- **Software Catalog** (`/software`): registro e edição do catálogo de softwares instaláveis. Veja [`docs/software-maintenance.md`](docs/software-maintenance.md).

## Contributing
1. Review [`GIT_GUIDELINES.md`](GIT_GUIDELINES.md) and [`AGENTS.md`](AGENTS.md).
2. Follow the feature-first structure: place new functionality under `src/features/<feature>`.
3. Update or add documentation in `docs/` when introducing new flows or modules.
4. Run `pnpm lint` before submitting changes.
5. Highlight any adjustments to seeds (`prisma/seed.ts`) or environment variables in pull requests.

## References
- [Next.js Docs](https://nextjs.org/docs)  
- [Prisma ORM](https://www.prisma.io/docs)  
- [shadcn/ui](https://ui.shadcn.com)  
- [Tailwind CSS v4](https://tailwindcss.com/blog/tailwindcss-v4-alpha)
