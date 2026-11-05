# Task reading router

Read the frontend [AGENTS.md](../../AGENTS.md) first. Use the table to select relevant documents; do not load every Markdown file for every task. Confirm claims against source, generated DTOs, the installed framework guides, and the backend controller/spec when relevant.

| Task | Documentation | Source to inspect |
| --- | --- | --- |
| General orientation | [Project](project.md), [architecture](architecture.md) | `package.json`, `app/`, `features/` |
| Add/change an API request | [API contract](../api/api-contract.md), [errors](../api/error-handling.md), [coding rules](coding-rules.md) | `configs/api.ts`, `hooks/useApi.ts`, owning `service/*Service.ts`, delivered OpenAPI |
| Login, registration, logout, or account switch | [Authentication](../features/authentication.md), [API errors](../api/error-handling.md) | `providers/Provider.tsx`, `hooks/useAuth.ts`, `service/authService.ts`, auth regression tests |
| Catalog, category, or search | [Catalog](../features/catalog.md), [functional scope](../requirement/functional.md) | Catalog service, page features, `features/catalogUtils.ts`, category routes |
| Add to cart or guest merge | [Cart](../features/cart.md), [guest cart](../features/guest-cart.md), [authentication](../features/authentication.md) | Cart service, product detail feature, CartProvider/controller, provider/session guards |
| Cart page or API handoff | [Cart implementation](../features/cart-page-implementation.md), [Cart configuration/flow](../features/cart.md), [initial audit](../features/cart-page-readiness.md), [authentication](../features/authentication.md) | CartPage/useCart/cartUtils, cartService blank origin, shared hooks/session key, ShopLayout/header and delivered BE versus pending update/remove |
| Component or visual change | [Design system](../ui/design-system.md), [components](../ui/components.md) | Owning component, `app/globals.css`, real consumers |
| File layout, naming, or imports | [Architecture](architecture.md), [coding rules](coding-rules.md) | Imports, component generator aliases, test/smoke scripts |
| Test or release validation | [Workflow](task-workflow.md), [non-functional requirements](../requirement/non-functional.md) | `package.json`, tests, runner configs, actual command output |

If a task crosses rows, read their intersection. Follow a source import or contract reference when it resolves a concrete uncertainty. Treat unsupported search parameters, unapproved release coordination, and unavailable backend checks as explicit limits rather than filling gaps with assumptions.
