# Safarly Mobile

Expo + React Native mobile app for the Safarly flow.

## Project Structure

- `src/features`: feature-first modules (`auth`, `onboarding`, `parcels`, `tabs`, `wallet`)
- `src/components/ui`: shared UI primitives reused by multiple features
- `src/navigation`: app and tab navigation setup
- `src/store`: global app state (Zustand), store types, and seed data
- `src/theme`: design tokens and color system
- `src/types`: domain model types

## Engineering Conventions

- Keep screens focused on UI orchestration (rendering + event wiring).
- Move business/domain logic into feature model files (example: `features/parcels/model/createParcel.ts`).
- Keep sample/mock data in dedicated store seed modules, not inside screen files.
- Prefer typed imports with `@/` alias.

## Scripts

- `npm run dev`: start Expo
- `npm run typecheck`: TypeScript checks
- `npm run lint`: lint checks
