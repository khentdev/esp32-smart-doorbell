import { getLogger } from "@logtape/logtape";
import type { AccessEventDTO } from "./types";

type AccessEventListener = (event: AccessEventDTO) => void;

const listeners = new Set<AccessEventListener>();

/** Subscribe to new access events. Returns an unsubscribe function. */
export function subscribeToAccessEvents(listener: AccessEventListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Fan out a persisted access event. A failing listener never affects the others or the request. */
export function publishAccessEvent(event: AccessEventDTO) {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (err) {
      getLogger().error("Access event listener failed.", { error: err });
    }
  }
}
