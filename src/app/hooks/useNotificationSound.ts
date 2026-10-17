
"use client";

import { useCallback, useRef, useState } from "react";

export function useNotificationSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);

  const enableSound = useCallback(async () => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio("/sounds/message-notification.mp3");
        audioRef.current.preload = "auto";
      }

      const audio = audioRef.current;
      audio.currentTime = 0;
      await audio.play();
      setSoundEnabled(true);
    } catch (error) {
      console.error("Could not play notification sound:", error);
    }
  }, []);

  const playNotificationSound = useCallback(async () => {
    if (!soundEnabled || !audioRef.current) return;

    try {
      audioRef.current.currentTime = 0;
      await audioRef.current.play();
    } catch (error) {
      console.error("Could not play notification sound:", error);
    }
  }, [soundEnabled]);

  return { soundEnabled, enableSound, playNotificationSound };
}
