# Nexus frontend documentation

This documentation describes the frontend source in this repository. Start with the task you need to complete, then verify the linked source and delivered backend contract. A document records intent and scope; it does not replace implementation or execution evidence.

| Need | Read |
| --- | --- |
| Set up the app or run checks | [Frontend README](../README.md) |
| Choose the smallest relevant reading path | [AI task router](ai/index.md) |
| Understand the project | [Project context](ai/project.md) |
| Add or move code | [Architecture](ai/architecture.md), [coding rules](ai/coding-rules.md) |
| Change an API call | [API contract](api/api-contract.md), [error handling](api/error-handling.md) |
| Connect existing UI to delivered APIs | [UI/API inventory](features/api-ui-integration.md), [Cart handoff](features/cart.md), [integration verification](features/cart-page-implementation.md) |
| Change a business flow | [Feature index](features/index.md) |
| Work on product images | [Gallery behavior, API readiness and verification](features/product-image-gallery.md) |
| Work on seller auctions, sales or payouts | [Seller operations and pending backend contracts](features/seller-operations.md) |
| Work on Admin users, seller reviews, logs or health | [Admin scope, contracts and verification](features/admin.md) |
| Check functional scope | [Functional requirements](requirement/functional.md) |
| Check reliability, security, or performance constraints | [Non-functional requirements](requirement/non-functional.md) |
| Build UI | [Design system](ui/design-system.md), [components](ui/components.md) |
| Carry out and verify a task | [Task workflow](ai/task-workflow.md) |
| Review the rebuild evidence and remaining release limits | [Rebuild verification](ai/verification.md) |

The frontend targets the delivered success envelope described by the backend's [API style guide](../../be-project-nexus/docs/api/style-guide.md). That guide and [ADR-008](../../be-project-nexus/docs/adr/ADR-008-api-contract.md) record approval and coordinated release as pending. Local implementation and mock checks do not establish deployment approval or live compatibility.
