export interface ApiRequestOptions {
  /** Defaults to true. Set false for login/register or other public endpoints. */
  auth?: boolean;
  signal?: AbortSignal;
}
