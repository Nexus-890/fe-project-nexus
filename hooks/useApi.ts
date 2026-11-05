"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type MutationKey,
  type QueryKey,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { createCanceledError } from "../configs/api";
import type { ApiError } from "../types/commonResponseType";
import type { ApiRequestConfig } from "../types/commonRequestType";

export type ApiParams = Readonly<Record<string, unknown>>;
export type ApiQueryOptions<TResponse, TSelected = TResponse> = Omit<
  UseQueryOptions<TResponse, ApiError, TSelected, QueryKey>,
  "queryFn" | "queryKey"
>;
export type ApiQueryRequest<TResponse> = {
  queryKey: QueryKey;
  service: (signal: AbortSignal) => Promise<TResponse>;
  meta?: Record<string, unknown>;
};
export function useApiQuery<TResponse, TSelected = TResponse>(
  request: ApiQueryRequest<TResponse>,
  options?: ApiQueryOptions<TResponse, TSelected>,
) {
  return useQuery<TResponse, ApiError, TSelected, QueryKey>({
    retry: (count, error) =>
      (error.kind === "network" || error.status >= 500) && count < 1,
    ...options,
    queryKey: request.queryKey,
    meta: { ...options?.meta, ...request.meta },
    queryFn: ({ signal }) => request.service(signal),
  });
}
type RequestField<TKey extends string, TValue> = [TValue] extends [never]
  ? Partial<Record<TKey, never>>
  : Record<TKey, TValue>;
export type ApiMutationVariables<
  TBody = never,
  TPathParams = never,
  TQueryParams = never,
> = RequestField<"body", TBody> &
  RequestField<"pathParams", TPathParams> &
  RequestField<"query", TQueryParams> & {
    config?: ApiRequestConfig;
    signal?: AbortSignal;
  };
type CacheKeysResolver<TResponse, TVariables> =
  | readonly QueryKey[]
  | ((data: TResponse, variables: TVariables) => readonly QueryKey[]);
type MutationRequest<TResponse, TVariables> = {
  mutationKey?: MutationKey;
  invalidateKey?: CacheKeysResolver<TResponse, TVariables>;
  removeKey?: CacheKeysResolver<TResponse, TVariables>;
  isCurrent?: (variables: TVariables) => boolean;
};
export type ApiMutationOptions<
  TResponse,
  TVariables,
  TOnMutateResult = unknown,
> = Omit<
  UseMutationOptions<TResponse, ApiError, TVariables, TOnMutateResult>,
  "mutationFn"
>;
type ExecutorRequest<TResponse, TVariables> = MutationRequest<
  TResponse,
  TVariables
> & { execute: (variables: TVariables) => Promise<TResponse> };
type ServiceRequest<TResponse, TVariables> = MutationRequest<
  TResponse,
  TVariables
> & {
  service: (variables: TVariables, signal?: AbortSignal) => Promise<TResponse>;
};
const resolveCacheKeys = <TResponse, TVariables>(
  resolver: CacheKeysResolver<TResponse, TVariables> | undefined,
  data: TResponse,
  variables: TVariables,
) =>
  typeof resolver === "function" ? resolver(data, variables) : (resolver ?? []);

export function useApiMutation<
  TResponse,
  TVariables,
  TOnMutateResult = unknown,
>(
  request: ExecutorRequest<TResponse, TVariables>,
  options?: ApiMutationOptions<TResponse, TVariables, TOnMutateResult>,
): ReturnType<
  typeof useMutation<TResponse, ApiError, TVariables, TOnMutateResult>
>;
export function useApiMutation<
  TResponse,
  TBody = never,
  TPathParams = never,
  TQueryParams = never,
  TOnMutateResult = unknown,
>(
  request: ServiceRequest<
    TResponse,
    ApiMutationVariables<TBody, TPathParams, TQueryParams>
  >,
  options?: ApiMutationOptions<
    TResponse,
    ApiMutationVariables<TBody, TPathParams, TQueryParams>,
    TOnMutateResult
  >,
): ReturnType<
  typeof useMutation<
    TResponse,
    ApiError,
    ApiMutationVariables<TBody, TPathParams, TQueryParams>,
    TOnMutateResult
  >
>;
export function useApiMutation<
  TResponse,
  TVariables,
  TOnMutateResult = unknown,
>(
  request:
    | ExecutorRequest<TResponse, TVariables>
    | ServiceRequest<TResponse, TVariables>,
  options?: ApiMutationOptions<TResponse, TVariables, TOnMutateResult>,
) {
  const queryClient = useQueryClient();
  const { onSuccess, ...mutationOptions } = options ?? {};
  return useMutation<TResponse, ApiError, TVariables, TOnMutateResult>({
    retry: 0,
    mutationKey: request.mutationKey,
    ...mutationOptions,
    mutationFn: async (variables) => {
      if (request.isCurrent && !request.isCurrent(variables))
        throw createCanceledError();
      const data =
        "execute" in request
          ? await request.execute(variables)
          : await request.service(
              variables,
              (variables as { signal?: AbortSignal }).signal,
            );
      if (request.isCurrent && !request.isCurrent(variables))
        throw createCanceledError();
      return data;
    },
    onSuccess: async (data, variables, onMutateResult, context) => {
      if (request.isCurrent && !request.isCurrent(variables)) return;
      await Promise.all(
        resolveCacheKeys(request.invalidateKey, data, variables).map(
          (queryKey) =>
            queryClient.invalidateQueries({ queryKey, refetchType: "active" }),
        ),
      );
      if (request.isCurrent && !request.isCurrent(variables)) return;
      resolveCacheKeys(request.removeKey, data, variables).forEach((queryKey) =>
        queryClient.removeQueries({ queryKey, exact: true }),
      );
      await onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
