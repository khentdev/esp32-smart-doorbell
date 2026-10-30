import type { FingerprintCommand } from "../fingerprints/types";

export type ManualDoorUnlockInput = {
  deviceId: string;
};
export type ManualDoorUnlockResponse = {
  status: "UNLOCK_REQUESTED";
};

export type PollDeviceCommandResponse =
  | { command: null }
  | { command: "UNLOCK" }
  | FingerprintCommand;

export type AccessOutcome = "GRANTED" | "DENIED" | "ADMIN_UNLOCK";

export type AccessEventDTO = {
  id: string;
  deviceId: string;
  deviceLabel: string;
  outcome: AccessOutcome;
  fingerprintSlot: number | null;
  fingerprintName: string | null;
  timestamp: string;
};
