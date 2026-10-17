
"use client";

import { useCallback, useEffect, useRef } from "react";

export function useNotificationSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlockedRef = useRef(false);

  useEffect(() => {
    const audio = new Audio("/sounds/message-notification.mp3");
    audio.preload = "auto";
    audioRef.current = audio;

    const unlockAudio = async () => {
      try {
        audio.muted = true;
        await audio.play();
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
        unlockedRef.current = true;

        window.removeEventListener("pointerdown", unlockAudio);
        window.removeEventListener("keydown", unlockAudio);
      } catch {
        audio.muted = false;
      }
    };

    window.addEventListener("pointerdown", unlockAudio);
    window.addEventListener("keydown", unlockAudio);

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  const playNotificationSound = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !unlockedRef.current) return;

    try {
      audio.currentTime = 0;
      await audio.play();
    } catch (error) {
      console.error("Notification sound failed:", error);
    }
  }, []);

  return { playNotificationSound };
}
