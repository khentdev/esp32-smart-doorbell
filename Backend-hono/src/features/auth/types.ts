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
export type LoginDTO = {
  user: {
    id: string;
    username: string;
  };
};
export type LoginResponse = {
  data: LoginDTO;
  message: string;
};
