import { internalPath } from "@/lib/notifications";

type PushResponse = {
  actionIdentifier: string;
  notification: { request: { identifier: string; content: { data?: unknown } } };
};

type ResponseSource = {
  addNotificationResponseReceivedListener: (listener: (response: PushResponse) => void) => { remove: () => void };
  getLastNotificationResponseAsync: () => Promise<PushResponse | null>;
};

let lastHandledResponse: string | null = null;

/** Consume each tap once, even if an app lock remounts the navigator. */
export async function listenForNotificationResponses(
  source: ResponseSource,
  open: (path: string) => void,
  signal?: AbortSignal,
) {
  const handle = (response: PushResponse) => {
    if (signal?.aborted) return;
    const responseId = `${response.notification.request.identifier}:${response.actionIdentifier}`;
    if (lastHandledResponse === responseId) return;
    const data = response.notification.request.content.data;
    const url = data && typeof data === "object" && "url" in data ? data.url : null;
    const path = internalPath(typeof url === "string" ? url : null);
    if (path) {
      open(path);
      lastHandledResponse = responseId;
    }
  };

  const subscription = source.addNotificationResponseReceivedListener(handle);
  try {
    const initial = await source.getLastNotificationResponseAsync();
    if (initial) handle(initial);
  } catch (error) {
    subscription.remove();
    throw error;
  }
  return () => subscription.remove();
}
