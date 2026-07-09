# CLAUDE.md - SpruVex UI Transformation Source of Truth

You are working on SpruVex, a multi-tenant ERP/POS/repair-management SaaS. Read these files before changing code:
1. `docs/01_CURRENT_UI_AUDIT_V2_AR_EN.md`
2. `docs/02_PRODUCT_UI_SPEC_AR_EN.md`
3. `docs/03_COMPONENT_ARCHITECTURE_AR_EN.md`
4. `docs/04_MIGRATION_PLAN_AR_EN.md`
5. `docs/05_QA_ACCEPTANCE_AR_EN.md`
6. `design-system/tokens.v2.json`
7. `claude-code/MASTER_TRANSFORMATION_PROMPT_AR_EN.md`

Hard rules:
- Preserve routes, permissions, API contracts, state, and business logic.
- Audit first and present a file-change plan before editing.
- Use supplied SVG brand assets; never redraw the logo in CSS.
- Implement one token-driven theme system with true RTL/LTR.
- Never expose raw translation keys or hardcode tenant currency.
- Use a single outline icon family and shared components.
- Run lint, typecheck, tests, and production build after each phase.
