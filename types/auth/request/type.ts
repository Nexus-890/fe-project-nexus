export interface RegisterRequest {
  email: string;
  phone: string;
  password: string;
  fullName: string;
  identityNumber: string;
  gender: string;
  address: string;
  dateOfBirth: string;
}

/** Public name used by the sign-up page; kept as an alias for the auth API. */
export type SignUpRequest = RegisterRequest;

export interface LoginRequest {
  email: string;
  password: string;
}

export type SignInRequest = LoginRequest;
