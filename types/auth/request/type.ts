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

export interface LoginRequest {
  email: string;
  password: string;
}
