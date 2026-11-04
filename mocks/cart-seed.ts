// Generated from local PostgreSQL by be-project-nexus/infra/local-dev/seed-buyer-cart.ps1.
// Sprint 1 fixture: explicit offline cart fixture; real endpoints remain the default.
import type { Cart } from "../types/cartResponseType";

export const buyerCartSeedUserId = "68000000-0000-4000-8000-000000000003";
export const buyerCartSeedEmail = "buyer@nexus.local";

export const buyerCartSeed: Cart = {
    "userId": buyerCartSeedUserId,
    "id":  "01a15922-444b-7e23-ac13-2421158ab411",
    "status":  "ACTIVE",
    "items":  [
                  {
                      "id":  "01a15922-444d-75f0-9e37-b59532063a6a",
                      "skuId":  "01a144c6-5ae6-723a-85b6-4305edca7beb",
                      "productId":  "01a144c6-5ae2-7a4b-8060-9ab42ae6ffce",
                      "quantity":  1,
                      "unitPrice":  "150000.00",
                      "lineTotal":  "150000.00",
                      "productName":  "QA Seed Product 1",
                      "sellerId":  "00000000-0000-0000-0000-000000000001",
                      "color":  "Red",
                      "size":  "M"
                  },
                  {
                      "id":  "01a15922-444f-7959-83e3-3825ab9cb2e0",
                      "skuId":  "01a144c6-5ae7-793d-ad1d-b7c050b9f3ac",
                      "productId":  "01a144c6-5ae2-7a4b-8060-9ab42ae6ffce",
                      "quantity":  1,
                      "unitPrice":  "180000.00",
                      "lineTotal":  "180000.00",
                      "productName":  "QA Seed Product 1",
                      "sellerId":  "00000000-0000-0000-0000-000000000001",
                      "color":  "Blue",
                      "size":  "L"
                  },
                  {
                      "id":  "01a15922-444f-7a1b-b8c5-b59b50bbb7ae",
                      "skuId":  "01a144c6-5ae6-7e29-ba24-2c7cc4b3fe89",
                      "productId":  "01a144c6-5ae3-73a7-8710-29d9777f8d18",
                      "quantity":  1,
                      "unitPrice":  "150000.00",
                      "lineTotal":  "150000.00",
                      "productName":  "QA Seed Product 2",
                      "sellerId":  "00000000-0000-0000-0000-000000000001",
                      "color":  "Red",
                      "size":  "M"
                  },
                  {
                      "id":  "01a15922-444f-7a36-ba45-fc565197e81f",
                      "skuId":  "01a144c6-5ae7-7b01-b324-2e27b8913872",
                      "productId":  "01a144c6-5ae3-73a7-8710-29d9777f8d18",
                      "quantity":  1,
                      "unitPrice":  "180000.00",
                      "lineTotal":  "180000.00",
                      "productName":  "QA Seed Product 2",
                      "sellerId":  "00000000-0000-0000-0000-000000000001",
                      "color":  "Blue",
                      "size":  "L"
                  },
                  {
                      "id":  "01a15922-444f-7a63-be90-45e7e65a308f",
                      "skuId":  "01a144c6-5ae6-7f0a-837d-3d2159f75efa",
                      "productId":  "01a144c6-5ae3-7519-b9d6-e1c13c6d455e",
                      "quantity":  1,
                      "unitPrice":  "150000.00",
                      "lineTotal":  "150000.00",
                      "productName":  "QA Seed Product 3",
                      "sellerId":  "00000000-0000-0000-0000-000000000001",
                      "color":  "Red",
                      "size":  "M"
                  },
                  {
                      "id":  "01a15922-444f-7a7a-bcc5-5fa8caf133f9",
                      "skuId":  "01a144c6-5ae7-7b84-b7c8-30744f9bb467",
                      "productId":  "01a144c6-5ae3-7519-b9d6-e1c13c6d455e",
                      "quantity":  1,
                      "unitPrice":  "180000.00",
                      "lineTotal":  "180000.00",
                      "productName":  "QA Seed Product 3",
                      "sellerId":  "00000000-0000-0000-0000-000000000001",
                      "color":  "Blue",
                      "size":  "L"
                  },
                  {
                      "id":  "01a15922-444f-7a90-8b5e-f60336860b37",
                      "skuId":  "01a144c6-5ae6-7f3f-9a93-788467f8349d",
                      "productId":  "01a144c6-5ae3-765e-8c69-de6ae536c216",
                      "quantity":  1,
                      "unitPrice":  "150000.00",
                      "lineTotal":  "150000.00",
                      "productName":  "QA Seed Product 4",
                      "sellerId":  "00000000-0000-0000-0000-000000000001",
                      "color":  "Red",
                      "size":  "M"
                  },
                  {
                      "id":  "01a15922-444f-7aa7-b067-504e0b18e9c4",
                      "skuId":  "01a144c6-5ae7-7bbf-9f92-a249d5823ec6",
                      "productId":  "01a144c6-5ae3-765e-8c69-de6ae536c216",
                      "quantity":  1,
                      "unitPrice":  "180000.00",
                      "lineTotal":  "180000.00",
                      "productName":  "QA Seed Product 4",
                      "sellerId":  "00000000-0000-0000-0000-000000000001",
                      "color":  "Blue",
                      "size":  "L"
                  },
                  {
                      "id":  "01a15922-444f-7b2e-a5de-4647be5bbb0e",
                      "skuId":  "01a144c6-5ae6-7f71-8cb0-917e2da04ef6",
                      "productId":  "01a144c6-5ae3-7728-a14c-a1b57eb63b67",
                      "quantity":  1,
                      "unitPrice":  "150000.50",
                      "lineTotal":  "150000.50",
                      "productName":  "QA Seed Product 5",
                      "sellerId":  "00000000-0000-0000-0000-000000000001",
                      "color":  "Red",
                      "size":  "M"
                  },
                  {
                      "id":  "01a15922-444f-7b65-a6ff-e9732133c209",
                      "skuId":  "01a144c6-5ae7-7c09-aada-b3a448719d29",
                      "productId":  "01a144c6-5ae3-7728-a14c-a1b57eb63b67",
                      "quantity":  1,
                      "unitPrice":  "180000.00",
                      "lineTotal":  "180000.00",
                      "productName":  "QA Seed Product 5",
                      "sellerId":  "00000000-0000-0000-0000-000000000001",
                      "color":  "Blue",
                      "size":  "L"
                  }
              ],
    "subtotal":  "1650000.50",
    "currency":  "VND",
    "updatedAt":  "2026-10-20T11:50:30.814909Z"
};
