export type FingerprintJobType = "ENROLL" | "DELETE";

export type FingerprintJobStatus = "PENDING" | "SENT" | "SUCCEEDED" | "FAILED" | "EXPIRED";

export type FingerprintJobStep = "PLACE_FINGER" | "REMOVE_FINGER" | "PLACE_AGAIN";

export type FingerprintJobError =
  | "MISMATCH"
  | "TIMEOUT"
  | "BAD_IMAGE"
  | "STORE_FAILED"
  | "DELETE_FAILED"
  | "DEVICE_TIMEOUT";

export type FingerprintDTO = {
  id: string;
  deviceId: string;
  name: string;
  slot: number;
  createdAt: string;
};

export type FingerprintJobDTO = {
  id: string;
  deviceId: string;
  type: FingerprintJobType;
  status: FingerprintJobStatus;
  step: FingerprintJobStep | null;
  error: FingerprintJobError | null;
  name: string;
  slot: number;
  fingerprintId: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Payload of the `fingerprint` SSE event. */
export type FingerprintJobEventDTO = {
  job: FingerprintJobDTO;
  fingerprint: FingerprintDTO | null; // the new person, only on a SUCCEEDED ENROLL
};

export type ListFingerprintsResponse = {
  fingerprints: FingerprintDTO[];
  activeJob: FingerprintJobDTO | null;
};

/** What GET /door/commands hands the ESP32 for a fingerprint job. */
export type FingerprintCommand = {
  command: FingerprintJobType;
  jobId: string;
  slot: number;
};
