export type ManualDoorUnlockInput = {
  deviceId: string;
};
export type ManualDoorUnlockResponse = {
  status: "UNLOCK_REQUESTED";
};

export type PollDeviceCommandResponse = {
  command: "UNLOCK" | null;
};
