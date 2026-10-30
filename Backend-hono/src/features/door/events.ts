import { getLogger } from "@logtape/logtape";
import type { FingerprintJobEventDTO } from "../fingerprints/types";
import type { AccessEventDTO } from "./types";

type Listener<T> = (event: T) => void;

/** In-memory fan-out. A failing listener never affects the others or the request. */
function createChannel<T>(name: string) {
  const listeners = new Set<Listener<T>>();
  return {
    /** Returns an unsubscribe function. */
    subscribe(listener: Listener<T>) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    count: () => listeners.size,
    publish(event: T) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (err) {
          getLogger().error(`${name} listener failed.`, { error: err });
        }
      }
    },
  };
}

const accessChannel = createChannel<AccessEventDTO>("Access event");
const fingerprintChannel = createChannel<FingerprintJobEventDTO>("Fingerprint event");

/** Subscribe to new access events. Returns an unsubscribe function. */
export const subscribeToAccessEvents = accessChannel.subscribe;

/** Number of live subscribers (used by tests to assert disconnect cleanup). */
export const accessEventListenerCount = accessChannel.count;

/** Fan out a persisted access event. */
export const publishAccessEvent = accessChannel.publish;

/** Subscribe to fingerprint job changes. Returns an unsubscribe function. */
export const subscribeToFingerprintEvents = fingerprintChannel.subscribe;

/** Number of live fingerprint subscribers (used by tests to assert disconnect cleanup). */
export const fingerprintEventListenerCount = fingerprintChannel.count;

/** Fan out a fingerprint job change (created, sent, step, finished, expired). */
export const publishFingerprintEvent = fingerprintChannel.publish;
