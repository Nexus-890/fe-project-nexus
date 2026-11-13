import { createInvalidResponseError, isRecord, requestApi } from "../configs/api";
import { ADDRESS_BOOK_LIMIT } from "../types/addressBookType";
import type { AddressBookInput, SavedAddress } from "../types/addressBookType";
import type { ServiceRequestOptions } from "../types/commonRequestType";

/** #210 is not delivered on develop. See docs/features/address-book.md. */
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
  return {
    id: text("id"), recipientName: text("recipientName"), phoneNumber: text("phoneNumber"),
    addressLine: text("addressLine"), provinceCode: text("provinceCode"),
    provinceName: text("provinceName"), wardCode: text("wardCode"), wardName: text("wardName"),
    isDefault: value.isDefault,
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

const addressBody = (input: AddressBookInput): AddressBookInput => ({
  recipientName: input.recipientName.trim(), phoneNumber: input.phoneNumber.trim(),
  addressLine: input.addressLine.trim(), provinceCode: input.provinceCode,
  provinceName: input.provinceName, wardCode: input.wardCode, wardName: input.wardName,
  isDefault: input.isDefault,
});

const addressPath = (id: string) => {
  if (!id.trim()) throw createInvalidResponseError("Saved address ID is required.");
  return `${ADDRESSES_PATH}/${encodeURIComponent(id)}`;
};

export const getAddresses = async (options: ServiceRequestOptions = {}): Promise<SavedAddress[]> => {
  const response = await requestApi<unknown>("GET", ADDRESSES_PATH, undefined, { ...options, auth: true, params: undefined });
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
  const response = await requestApi<unknown>("PATCH", `${addressPath(id)}/default`, undefined, { ...options, auth: true });
  const address = parseSavedAddress(response.data);
  if (!address.isDefault || address.id !== id)
    throw createInvalidResponseError("The saved address was not made default.");
  return address;
};

export const deleteAddress = async (id: string, options: ServiceRequestOptions = {}): Promise<void> => {
  await requestApi<unknown>("DELETE", addressPath(id), undefined, { ...options, auth: true });
};
