import type { CheckoutAddress } from "./checkoutType";

/** Provisional #210 application contract until user-service delivers its OpenAPI. */
export type AddressBookInput = CheckoutAddress & {
  provinceName: string;
  wardName: string;
  isDefault: boolean;
};

export type SavedAddress = AddressBookInput & { id: string };

export const ADDRESS_BOOK_LIMIT = 10;
