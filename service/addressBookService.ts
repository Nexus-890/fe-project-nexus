import { createInvalidResponseError, isRecord, requestApi } from "../configs/api";
import { ADDRESS_BOOK_LIMIT } from "../types/addressBookType";
import type { AddressBookInput, SavedAddress } from "../types/addressBookType";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { components } from "../types/account210GeneratedType";

/** Aligned with #210 at 1e480dda; see docs/features/address-book.md. */
export const ADDRESSES_PATH = "/api/v1/users/me/addresses";

export const parseSavedAddress = (value: unknown): SavedAddress => {
  if (!isRecord(value) || typeof value.isDefault !== "boolean")
    throw createInvalidResponseError("Invalid saved address.");
  const text = (key: string): string => {
    const field = value[key];
    if (typeof field !== "string" || !field.trim())
      throw createInvalidResponseError(`Invalid saved address ${key}.`);
    return field;
  };
  const timestamp = (key: string) => {
    const field = text(key);
    if (!/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(field) || !Number.isFinite(Date.parse(field)))
      throw createInvalidResponseError(`Invalid saved address ${key}.`);
    return field;
  };
  const id = text("id");
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id))
    throw createInvalidResponseError("Invalid saved address id.");
  return {
    id, recipientName: text("recipientName"), phoneNumber: text("phone"),
    addressLine: text("addressLine"), provinceCode: text("provinceCode"),
    provinceName: text("provinceName"), wardCode: text("wardCode"), wardName: text("wardName"),
    isDefault: value.isDefault,
    createdAt: timestamp("createdAt"), updatedAt: timestamp("updatedAt"),
  };
};

export const parseAddressBook = (value: unknown): SavedAddress[] => {
  if (!Array.isArray(value) || value.length > ADDRESS_BOOK_LIMIT)
    throw createInvalidResponseError("Expected up to ten saved addresses.");
  const addresses = value.map(parseSavedAddress);
  if (new Set(addresses.map((address) => address.id)).size !== addresses.length ||
      (addresses.length > 0 && addresses.filter((address) => address.isDefault).length !== 1))
    throw createInvalidResponseError("Saved addresses must have unique IDs and exactly one default.");
  return addresses;
};

const addressBody = (input: AddressBookInput): components["schemas"]["AddressRequest"] => ({
  recipientName: input.recipientName.trim(), phone: input.phoneNumber.trim().replace(/[\s()-]/g, ""),
  addressLine: input.addressLine.trim(), provinceCode: input.provinceCode.trim(),
  provinceName: input.provinceName.trim(), wardCode: input.wardCode.trim(), wardName: input.wardName.trim(),
  isDefault: input.isDefault,
});

const addressPath = (id: string) => {
  if (!id.trim()) throw createInvalidResponseError("Saved address ID is required.");
  return `${ADDRESSES_PATH}/${encodeURIComponent(id)}`;
};

export const getAddresses = async (options: ServiceRequestOptions = {}): Promise<SavedAddress[]> => {
  const response = await requestApi<unknown>("GET", ADDRESSES_PATH, undefined, { ...options, auth: true, params: undefined });
  if (!response.page) throw createInvalidResponseError("Expected saved addresses with page metadata.");
  return parseAddressBook(response.data);
};

export const saveAddress = async (input: AddressBookInput, options: ServiceRequestOptions = {}): Promise<SavedAddress> => {
  const response = await requestApi<unknown>("POST", ADDRESSES_PATH, addressBody(input), { ...options, auth: true });
  return parseSavedAddress(response.data);
};

export const updateAddress = async (id: string, input: AddressBookInput, options: ServiceRequestOptions = {}): Promise<SavedAddress> => {
  const response = await requestApi<unknown>("PUT", addressPath(id), addressBody(input), { ...options, auth: true });
  return parseSavedAddress(response.data);
};

export const setDefaultAddress = async (id: string, options: ServiceRequestOptions = {}): Promise<SavedAddress> => {
  const response = await requestApi<unknown>("POST", `${addressPath(id)}/default`, undefined, { ...options, auth: true });
  const address = parseSavedAddress(response.data);
  if (!address.isDefault || address.id !== id)
    throw createInvalidResponseError("The saved address was not made default.");
  return address;
};

export const deleteAddress = async (id: string, options: ServiceRequestOptions = {}): Promise<void> => {
  await requestApi<unknown>("DELETE", addressPath(id), undefined, { ...options, auth: true });
};
