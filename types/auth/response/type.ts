export interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  tokenType: "Bearer";
}

export type SignInResponse = LoginResponse;

export type UserGender = "MALE" | "FEMALE" | "OTHER";
export type UserStatus = "ACTIVE" | "LOCKED" | "DELETED";

export interface UserResponse {
  id: string;
  email: string;
  phone: string;
  fullName: string;
  gender: UserGender | null;
  address: string | null;
  dateOfBirth: string | null;
  /** Role codes are defined by backend data, rather than a Java enum. */
  roles: string[];
  status: UserStatus;
  createdAt: string;
}

export type RegisterResponse = UserResponse;
export type SignUpResponse = RegisterResponse;
