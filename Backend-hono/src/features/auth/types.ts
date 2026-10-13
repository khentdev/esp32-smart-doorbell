// Login
export type LoginInputRequestBody = {
  username: unknown;
  password: unknown;
};
export type LoginInput = {
  username: string;
  password: string;
  deviceId: string;
};
export type LoginInputVariables = {
  LoginInput: LoginInput;
};
export type LoginResponse = {
  user: {
    username: string;
  };
  message: string;
};
