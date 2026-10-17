
"use client";

import { useState } from "react";

const BACKEND_URL = "https://nodejschat-mern.onrender.com"; ;

function decodeVapidKey(
  base64String: string
): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const raw = window.atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));

  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }

  return bytes;
}

export default function EnableNotifications({
  userId,
}: {
  userId: string;
}) {
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function enableNotifications() {
    if (loading) return;

    setLoading(true);
    setStatus("");

    try {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        setStatus("Push notifications are not supported in this browser.");
        return;
      }

      if (!userId) {
        setStatus("Please sign in first.");
        return;
      }

      if (Notification.permission === "denied") {
        setStatus(
          "Notifications are blocked. Allow them in your browser settings."
        );
        return;
      }

      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        setStatus("Please allow notifications to continue.");
        return;
      }

      const registration =
        await navigator.serviceWorker.register("/sw.js");

      await navigator.serviceWorker.ready;

      const keyResponse = await fetch(
        `${BACKEND_URL}/api/push/public-key`
      );

      if (!keyResponse.ok) {
        throw new Error("Could not get the VAPID public key from backend.");
      }

      const { publicKey } = await keyResponse.json();

      if (!publicKey) {
        throw new Error("The backend did not return a public key.");
      }

      const existingSubscription =
        await registration.pushManager.getSubscription();

      const subscription =
        existingSubscription ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidKey(publicKey),
        }));

      const saveResponse = await fetch(
        `${BACKEND_URL}/api/push/subscribe`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId,
            subscription: subscription.toJSON(),
          }),
        }
      );

      if (!saveResponse.ok) {
        throw new Error("Could not save your push subscription.");
      }

      setStatus("Notifications enabled successfully!");
    } catch (error) {
      console.error("Push notification setup failed:", error);

      setStatus(
        error instanceof Error
          ? error.message
          : "Could not enable notifications."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={enableNotifications}
        disabled={loading}
        className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? "Enabling..." : "Enable notifications"}
      </button>

      {status && (
        <p role="status" className="text-sm">
          {status}
        </p>
      )}
    </div>
  );
}
