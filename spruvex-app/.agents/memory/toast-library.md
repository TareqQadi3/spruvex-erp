---
name: Toast library
description: Which toast library to use in the POS system frontend pages.
---

## Rule
Use `import { toast } from "sonner"` in all frontend pages. Do NOT use shadcn's `useToast` hook.

**Why:** Both exist in the codebase (shadcn Toaster component + sonner), but all app pages were consistently built using sonner's `toast.success()` / `toast.error()` API.

**How to apply:** `toast.success("message")` and `toast.error("message")` in all page components.
