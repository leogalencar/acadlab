# Copilot Instructions for Acadlab

## Repository Overview

**Acadlab** is a Next.js 15.5.4 web application built with TypeScript, React 19, and Tailwind CSS v4. This is a modern web project using the Next.js App Router architecture with server components. The project integrates shadcn/ui component library for UI components.

**Repository Stats:**
- Project Type: Next.js web application
- Languages: TypeScript, React (TSX)
- Size: ~6 source files in `src/` directory
- Framework: Next.js 15.5.4 with Turbopack
- Styling: Tailwind CSS v4, PostCSS
- UI Components: shadcn/ui (New York style)
- Package Manager: npm (Node.js v20+, npm v10+)

## Project Structure

```
/home/runner/work/acadlab/acadlab/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── page.tsx           # Home page
│   │   ├── layout.tsx         # Root layout with fonts
│   │   ├── globals.css        # Global styles (Tailwind)
│   │   └── favicon.ico
│   ├── features/              # Feature-based modules (create as needed)
│   ├── components/
│   │   └── ui/                # shadcn/ui components
│   │       └── button.tsx     # Button component
│   └── lib/
│       └── utils.ts           # Utility functions (cn helper)
├── public/                     # Static assets (SVG icons)
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
├── next.config.ts             # Next.js configuration
├── eslint.config.mjs          # ESLint configuration (flat config)
├── postcss.config.mjs         # PostCSS configuration
├── components.json            # shadcn/ui configuration
└── .gitignore
```

**Key Configuration Files:**
- **tsconfig.json**: TypeScript configured with `@/*` path alias pointing to `./src/*`
- **components.json**: shadcn/ui configured with "new-york" style, RSC enabled, using Lucide icons
- **eslint.config.mjs**: ESLint with Next.js rules, ignores `.next/`, `node_modules/`, `out/`, `build/`
- **next.config.ts**: Default Next.js config (minimal configuration)

## Build & Development Commands

### IMPORTANT: Always run `npm install` before any other command

**Install Dependencies** (REQUIRED FIRST STEP):
```bash
npm install
```
- Takes ~2 minutes
- Must be run after cloning or when package.json changes
- Creates `package-lock.json` if not present

### Development Server (WORKS):
```bash
npm run dev
# Equivalent to: next dev --turbopack
```
- Starts server at `http://localhost:3000`
- Hot reload enabled
- Uses Turbopack for fast compilation
- Ready in ~1 second after startup
- **This command works without network issues**

### Linting (WORKS):
```bash
npm run lint
# Equivalent to: eslint
```
- Runs ESLint on entire codebase
- Uses Next.js TypeScript rules
- Currently shows 1 warning (unused Button import in page.tsx)
- Exit code 0 even with warnings

### Production Build (NETWORK RESTRICTED):
```bash
npm run build
# Equivalent to: next build --turbopack
```
- **⚠️ KNOWN ISSUE**: Build fails in network-restricted environments
- Error: Cannot fetch Google Fonts (Geist, Geist Mono) from fonts.googleapis.com
- Failure occurs during font optimization in `src/app/layout.tsx`
- This is an ENVIRONMENT limitation, not a code issue
- The build works in environments with internet access
- **Alternative**: Use `npm run dev` for development/testing instead

### Start Production Server:
```bash
npm start
# Equivalent to: next start
```
- Requires successful `npm run build` first
- Serves production build on port 3000

## Architecture Guidelines

### Feature-Based Design

**IMPORTANT**: This project follows a feature-based architecture approach.

- **Add new features in `./src/features/`** - Group all related code by feature, not by file type
- **Feature folder structure**: Each feature should be self-contained with its own components, hooks, utils, and types
- **Example structure**:
  ```
  src/features/
  ├── auth/
  │   ├── components/
  │   ├── hooks/
  │   ├── utils/
  │   └── types.ts
  └── dashboard/
      ├── components/
      ├── hooks/
      └── api/
  ```
- **Benefits**: Better code organization, easier maintenance, clearer ownership

### Code Complexity Guidelines

**Team Context**: This project is developed and maintained by **2 people only**.

- **Measure and minimize complexity**: Before adding code, consider its complexity impact
- **Keep functions small**: Aim for functions under 20 lines when possible
- **Avoid over-engineering**: Simple solutions are preferred over complex abstractions
- **Document complex logic**: If complexity is unavoidable, add clear comments explaining why
- **Reuse before creating**: Check existing features before adding new utilities or components
- **Consider maintainability**: Ask "Can my teammate easily understand and modify this in 6 months?"

## Common Workflows

### Making Code Changes:
1. **Always** run `npm install` first if starting fresh
2. Make your changes to files in `src/`
3. Run `npm run lint` to check for linting errors
4. Run `npm run dev` to test locally
5. For production validation, try `npm run build` (may fail due to fonts)

### Adding New Features:
1. Create a new folder in `./src/features/` for your feature
2. Organize by feature, not by type (components, hooks, utils within the feature folder)
3. Keep the feature self-contained and focused
4. Consider complexity - this is a 2-person team project

### Adding New Pages:
- Create new files in `src/app/` following App Router conventions
- Use `page.tsx` for pages, `layout.tsx` for layouts
- Import path alias: Use `@/` for `src/` (e.g., `@/components/ui/button`)
- Link to feature modules from `src/features/` as needed

### Adding shadcn/ui Components:
```bash
npx shadcn@latest add <component-name>
```
- Components install to `src/components/ui/`
- Configured in `components.json`
- Style: "new-york", Icons: Lucide

### Modifying Styles:
- Global styles: `src/app/globals.css`
- Tailwind CSS v4 (no separate tailwind.config file)
- Uses CSS variables for theming
- PostCSS processes via `@tailwindcss/postcss` plugin

## TypeScript & Path Aliases

- **Path Alias**: `@/*` maps to `./src/*`
- Examples:
  - `import { Button } from "@/components/ui/button"`
  - `import { cn } from "@/lib/utils"`

## Validation & Testing

**No Test Framework Currently Configured**
- No Jest, Vitest, or other test runners
- Validate changes manually with `npm run dev`
- Check for type errors with TypeScript compilation (happens during dev/build)

**Validation Checklist:**
1. Run `npm run lint` - should pass with 0 errors
2. Run `npm run dev` - should start without errors
3. Open browser to http://localhost:3000 - page should load
4. Check browser console for runtime errors

## Known Issues & Workarounds

### Issue 1: Build Fails with Font Error
**Problem**: `npm run build` fails with "Failed to fetch Geist from Google Fonts"

**Root Cause**: Network restrictions prevent accessing fonts.googleapis.com

**Workaround Options**:
1. Use `npm run dev` for development and testing (recommended)
2. Remove Google Fonts and use system fonts (if acceptable for task)
3. Run build in environment with internet access

**Not a Bug**: This is an environment limitation, not a code issue

### Issue 2: Unused Import Warning
**Current State**: `src/app/page.tsx` imports Button but doesn't use it

**Impact**: ESLint warning (not error), doesn't block development

**Resolution**: Can be ignored or removed based on task requirements

## Dependencies to Know

**Core Dependencies:**
- `next` 15.5.4 - Next.js framework
- `react` 19.2.0 - React library
- `react-dom` 19.2.0 - React DOM renderer
- `tailwindcss` ^4 - Tailwind CSS v4

**UI/Styling:**
- `@radix-ui/react-slot` - Radix UI primitives
- `class-variance-authority` - CVA for component variants
- `clsx` + `tailwind-merge` - Utility for className merging
- `lucide-react` - Icon library

**Development:**
- `typescript` ^5 - TypeScript
- `eslint` ^9 - Linting
- `eslint-config-next` - Next.js ESLint rules

## Environment Requirements

- **Node.js**: v20+ (tested with v20.19.5)
- **npm**: v10+ (tested with v10.8.2)
- **Package Manager**: Use `npm` (not pnpm, even though pnpm-lock.yaml exists)

## CI/CD & GitHub Actions

**Current State**: No GitHub Actions workflows configured
- No `.github/workflows/` directory
- No automated CI/CD pipelines
- No automated tests or builds on PR

## Important Notes for Agents

1. **Trust These Instructions**: These instructions have been thoroughly tested. Only search for additional information if something documented here is incomplete or incorrect.

2. **Feature-Based Architecture**: Always add new features in `./src/features/`. Group files by feature, not by type. This is critical for maintainability.

3. **Code Complexity**: This is a 2-person team. Keep code simple, maintainable, and well-documented. Avoid over-engineering.

4. **Build Limitations**: If you need to validate a production build and `npm run build` fails with font errors, this is expected in network-restricted environments. Use `npm run dev` instead.

5. **Always Install First**: Never skip `npm install` - it's required for all operations.

6. **Minimal Changes**: This is a small, clean codebase. Make surgical changes only to files relevant to your task.

7. **No Tests to Run**: There's no test suite, so validate changes by running the dev server and manually checking functionality.

8. **Turbopack Enabled**: Both dev and build scripts use `--turbopack` flag for performance.

9. **File Structure**: All source code is in `src/`, organized by App Router conventions. Keep new files in appropriate directories.

10. **ESLint Flat Config**: Using modern ESLint flat config format (`eslint.config.mjs`), not legacy `.eslintrc`.
