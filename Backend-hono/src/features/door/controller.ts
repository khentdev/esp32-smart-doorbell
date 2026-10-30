import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { env } from "../../config/env";
import type { AppContext } from "../../types/context";
import { subscribeToAccessEvents, subscribeToFingerprintEvents } from "./events";
import {
  manualDoorUnlockService,
  pollDeviceCommandService,
  reportAccessService,
} from "./service";
import type {
  AccessEventDTO,
  ManualDoorUnlockResponse,
  PollDeviceCommandResponse,
} from "./types";
import { manualUnlockSchema } from "./validation";

export async function manualDoorUnlockController(c: Context<AppContext>) {
  const { deviceId } = manualUnlockSchema.parse(await c.req.json());
  await manualDoorUnlockService(deviceId);
  return c.json<ManualDoorUnlockResponse>({ status: "UNLOCK_REQUESTED" },202);
}

export async function pollDeviceCommandController(c: Context) {
  const deviceId = c.req.query("deviceId") ?? "";
  const result = await pollDeviceCommandService(deviceId);
  return c.json<PollDeviceCommandResponse>(result, 200);
}

export async function reportAccessController(c: Context) {
  const body = await c.req.json();
  const event = await reportAccessService(body);
  return c.json<AccessEventDTO>(event, 201);
}

export function streamAccessEventsController(c: Context<AppContext>) {
  // A bad value (NaN, 0, negative) would make the heartbeat loop spin, so fall back to 25s.
  const heartbeatSeconds = Number(env.SSE_HEARTBEAT_SECONDS);
  const heartbeatMs =
    Number.isFinite(heartbeatSeconds) && heartbeatSeconds > 0
      ? heartbeatSeconds * 1000
      : 25_000;
  // streamSSE does not set this; without it nginx-style proxies buffer the stream.
  c.header("X-Accel-Buffering", "no");

  return streamSSE(c, async (stream) => {
    // Never await inside the listener: the publisher is a synchronous fan-out and a slow
    // client must not delay POST /door/access.
    const unsubscribeAccess = subscribeToAccessEvents((event) => {
      stream
        .writeSSE({ event: "access", data: JSON.stringify(event) })
        .catch(unsubscribe); // dead socket: stop listening
    });
    const unsubscribeFingerprint = subscribeToFingerprintEvents((event) => {
      stream
        .writeSSE({ event: "fingerprint", data: JSON.stringify(event) })
        .catch(unsubscribe);
    });
    function unsubscribe() {
      unsubscribeAccess();
      unsubscribeFingerprint();
    }

    let wake: () => void = () => {};
    stream.onAbort(() => {
      unsubscribe();
      wake();
    });

    try {
      await stream.write(": connected\n\n");
      while (!stream.aborted) {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, heartbeatMs);
          wake = () => {
            clearTimeout(timer);
            resolve();
          };
        });
        if (stream.aborted) break;
        await stream.write(": ping\n\n");
      }
    } finally {
      unsubscribe();
    }
  });
}
