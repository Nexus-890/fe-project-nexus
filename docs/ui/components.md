# Component responsibilities

UI files are directly under `components`. Atomic Design remains a logical dependency rule: primitives are independent, small compositions use primitives, larger sections compose those parts, and page features orchestrate them. Physical atoms/molecules/organisms/templates folders are unnecessary.

## Inventory and ownership

| Group | Examples | Responsibility |
| --- | --- | --- |
| Primitives | button, input, checkbox, label, separator, select, sonner | Native/Base UI behavior, variants, focus and class composition |
| Small UI parts | Logo, ButtonCustom, Pagination, QuantityPicker | Reusable rendering or local interaction through props |
| Product parts | ProductCard, ProductGallery, ProductImage, SKUSelector, ProductGrid | Catalog presentation, shared image fallback and SKU/image/quantity selection |
| Cart parts | CartLine, CartSummary | Snapshot price/line total, optional catalog display metadata, quantity/remove controls, subtotal and checkout navigation; CartPage/useCart own requests/state |
| Checkout parts | AddressForm, OrderSummary | Controlled validated address fields and snapshot/quote presentation; CheckoutPage/CheckoutSummary own requests/state |
| Category parts | CategoryTree, CategoryNavigation, CategoryFilterSidebar | Tree/filter rendering and navigation events |
| Shop chrome | Header, HeaderTopBar, HeaderMain, HeaderCategoryNav, SearchBar | Header/search composition from data and callbacks supplied by the feature |
| Presentation helpers | formatPrice, componentUtils where needed | Shared pure formatting/class utilities, not HTTP or auth ownership |

Components can depend on domain presentation types and pure catalog/URL helpers. Do not import providers to create a parallel auth store or fetch through Axios from a component. `ShopLayout` and page features own queries/auth and pass the data, pending/error states and handlers down.

## Props, state and exports

Keep props next to a component when only that component owns them; share a type when multiple components need the same contract. A form/route prop is not an HTTP request DTO. Use PascalCase named function declarations and a default export for the main component; preserve named exports required by actual consumers/tooling.

Local state belongs to the interaction: gallery selected image, SKU choice, controlled quantity and form values. Remote server state belongs in the query cache. Do not copy the whole API response into local state or trigger a GET simply because the user selected another SKU.

`QuantityPicker` preserves integer values of at least one. `SKUSelector` preserves selected-id behavior and fallback labels. `ProductGallery` sorts a copy of images by `sortOrder`, preserves wrapping arrows, keyboard navigation and selected-image bounds, and renders selectable thumbnails. Equal sort orders keep their input order. `ProductImage` handles empty or failed image URLs with the shared placeholder, without replacing the source repeatedly after an error. `ProductCard` displays the first ordered image available in its summary. Product price consumers share `formatVND`; do not duplicate the formatter or change its rounding/precision during a move.

The gallery's main media area is a black square with contained images. Thumbnails are 72px square on mobile and 80px from the small breakpoint. Keep those reserved dimensions for loading, loaded, missing and failed media. Card media keeps its existing reserved height. The [gallery feature](../features/product-image-gallery.md) records the API dependency and acceptance scenarios; gallery styling does not authorize redesigning the SKU picker, product information or page layout.

QuantityPicker also accepts optional disabled/item-label/commitOnBlur settings for Cart. Cart commits manual quantity input on blur/Enter and uses immediate plus/minus actions; product-detail defaults stay unchanged. Cart uses decimal-safe cartUtils for calculated totals and formatVND for display. Remote metadata cannot override snapshot prices. See [Cart integration and scope](../features/cart.md).

## Styling and accessibility

Use the [design tokens](design-system.md) and the existing `cn` library/variant implementation. `components.json` aliases must point to this flat folder and the utility export that actually exists so a generator does not restore old nested paths.

Preserve input labels, aria-invalid/describedby, visible field/form errors, keyboard focus, gallery labels/controls, and loading/status announcements. Disabled/pending controls must remain understandable. Mobile content must wrap and avoid horizontal overflow while keeping usable hit targets. Verify changed interactions in their real feature, not only a static component render.

## Storybook and validation limits

The current `stories` tree contains Example/demo components. Keep its imports and configuration working when moving UI, but do not interpret those stories as coverage of every Nexus component. Its a11y setting reports todos rather than proving a clean application audit. Adding application stories or changing a11y policy is a separate explicit improvement; it is not a hidden requirement to redesign this rebuild.

For a UI task, inspect the component, feature consumers, global CSS and relevant browser tests. For a pure file move, compare behavior and rendered states before/after. Do not alter business behavior or inject placeholder products merely to satisfy an obsolete screenshot/assertion.
