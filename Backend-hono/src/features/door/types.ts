export type ManualDoorUnlockInput = {
  deviceId: string;
};
export type ManualDoorUnlockResponse = {
  status: "UNLOCK_REQUESTED";
};

export type PollDeviceCommandResponse = {
  command: "UNLOCK" | null;
};

export type AccessOutcome = "GRANTED" | "DENIED" | "ADMIN_UNLOCK";

export type AccessEventDTO = {
  id: string;
  deviceId: string;
  deviceLabel: string;
  outcome: AccessOutcome;
  fingerprintSlot: number | null;
  timestamp: string;
};
