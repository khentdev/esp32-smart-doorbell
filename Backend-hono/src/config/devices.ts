export const DEVICE_LABELS = {
  front_gate: "Front Gate",
} as const

export type DeviceId = keyof typeof DEVICE_LABELS;

export const isKnownDevice = (deviceId: string): deviceId is DeviceId =>
  Object.hasOwn(DEVICE_LABELS, deviceId);