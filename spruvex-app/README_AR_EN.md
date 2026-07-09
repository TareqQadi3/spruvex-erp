# SpruVex Professional UI Transformation Kit v2

## العربية
هذه الحزمة مخصصة لتسليمها إلى Claude Code مع مستودع التطبيق. وهي لا تحتوي فقط على الشعار؛ بل تحتوي على تحليل الواجهة الحالية، نظام الهوية، Design Tokens، الأيقونات، نماذج الهدف، خطة الهجرة، معايير القبول، وملف `CLAUDE.md` الذي يقرأه Claude Code تلقائيًا.

### ابدأ بهذا الترتيب
1. افتح `docs/SpruVex_UI_Transformation_Guide_AR_EN.pdf`.
2. ضع مجلد الحزمة في جذر مستودع التطبيق.
3. انقل أو ادمج محتوى `CLAUDE.md` إلى ملف CLAUDE.md في جذر المستودع.
4. أعط Claude Code ملف `claude-code/MASTER_TRANSFORMATION_PROMPT_AR_EN.md`.
5. اطلب تنفيذ Phase 0 فقط أولًا.

### أهم المجلدات
- `assets/`: الشعار، أيقونة التطبيق، favicon، وأيقونات المنتج.
- `design-system/`: الألوان، الخطوط، المسافات، الثيم، الترجمة، والمساعدات البرمجية.
- `reference/current-ui/`: الصور الحالية والنسخ المرقمة للتحليل.
- `reference/target-ui/`: شكل الهدف للوضعين الفاتح والداكن.
- `docs/`: التحليل والمواصفات والخطة والـQA.
- `claude-code/`: البرومت الرئيسي وبرومتات المراحل ومعايير القبول.

## English
This is an implementation-ready UI transformation handoff for Claude Code. It includes brand assets, a screen audit, target references, design tokens, icon assets, localization and formatting helpers, component architecture, a phased migration plan, acceptance criteria, and a root `CLAUDE.md` instruction file.
