import type { components } from "./account210GeneratedType";

/** UI model: user-service uses `phone`; checkout forms use `phoneNumber`. */
export type AddressBookInput = Omit<components["schemas"]["AddressRequest"], "phone" | "isDefault"> & {
  phoneNumber: string;
  isDefault: boolean;
};

export type SavedAddress = Omit<components["schemas"]["Address"], "phone"> & { phoneNumber: string };

export const ADDRESS_BOOK_LIMIT = 10;
