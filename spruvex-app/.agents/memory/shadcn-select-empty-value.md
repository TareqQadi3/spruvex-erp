---
name: shadcn Select empty value
description: SelectItem cannot have value="" — causes a runtime error. Use a sentinel string instead.
---

## Rule
`<SelectItem value="">` throws a runtime error in shadcn/ui Select: "A <Select.Item /> must have a value prop that is not an empty string."

**Why:** Radix UI Select uses empty string to signal "no value set" (shows placeholder). If an item has value="" it conflicts with this internal signal.

**How to apply:** For "no selection" options (walk-in customer, none, etc.), use a non-empty sentinel string (e.g. `"__walk_in__"`, `"__none__"`) and handle it explicitly in `onValueChange`.
