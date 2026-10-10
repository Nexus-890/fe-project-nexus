export interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  tokenType: "Bearer";
}

export interface UserResponse {
  id: string;
  email: string;
  phone: string;
  fullName: string;
  gender: string | null;
  address: string | null;
  dateOfBirth: string | null;
  /** Draft catalogue exposes roles as open backend strings. */
  roles: string[];
  status: string;
  createdAt: string;
}

export type RegisterResponse = UserResponse;
