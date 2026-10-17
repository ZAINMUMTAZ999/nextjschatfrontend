/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSocket } from "./hooks/useSocket";
import { useChat, Message } from "./hooks/useChat";
import LoginScreen from "./components/LoginScreen";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import { AnimatePresence, motion } from "framer-motion";

// --- Types ---
export interface DBUser {
  _id: string;
  username: string;
  isOnline: boolean;
  lastSeen?: string;
  lastMessageAt?: number;
}

export interface Notification {
  id: number;
  sender: string;
  message: string;
}

// --- API ---
const API_URL = "https://nodejschat-mern.onrender.com";

const fetchUsers = async (): Promise<DBUser[]> => {
  const res = await fetch(`${API_URL}/api/users`);
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
};

const fetchUnread = async (userId: string) => {
  const res = await fetch(`${API_URL}/api/messages/unread/${userId}`);
  if (!res.ok) throw new Error("Failed to fetch unread");
  return res.json();
};

// --- Notification chime (two soft notes, like a system "ding") ---
const playChime = (ctx: AudioContext) => {
  const now = ctx.currentTime;
  const notes = [
    { freq: 784, start: 0, dur: 0.22 }, // G5
    { freq: 1175, start: 0.13, dur: 0.4 }, // D6
  ];

  notes.forEach(({ freq, start, dur }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now + start);

    gain.gain.setValueAtTime(0.0001, now + start);
    gain.gain.exponentialRampToValueAtTime(0.28, now + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + start);
    osc.stop(now + start + dur + 0.05);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  });
};

// --- System (OS-level) notification ---
// Uses the service worker when available (required on Android / mobile Chrome),
// and falls back to the Notification constructor on desktop.
// `silent: false` lets the OS play its own default notification sound.
const showSystemNotification = async (
  sender: string,
  message: string,
  onClick: () => void
) => {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return;
  }

  const options = {
    body: message,
    tag: `chat-${sender}`,
    renotify: true,
    silent: false,
    vibrate: [200, 100, 200],
    data: { sender },
  } as NotificationOptions;

  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(`Message from ${sender}`, options);
        return;
      }
    }

    const notification = new Notification(`Message from ${sender}`, options);
    notification.onclick = () => {
      window.focus();
      onClick();
      notification.close();
    };
  } catch (error) {
    console.error("System notification failed:", error);
  }
};

// --- Small icons ---
const BellIcon = ({ muted }: { muted?: boolean }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    {muted && <path d="M3 3l18 18" />}
  </svg>
);

const SpeakerIcon = ({ muted }: { muted?: boolean }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M11 5 6 9H2v6h4l5 4V5z" />
    {muted ? (
      <>
        <path d="M22 9l-6 6" />
        <path d="M16 9l6 6" />
      </>
    ) : (
      <>
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M19 5a10 10 0 0 1 0 14" />
      </>
    )}
  </svg>
);

const CloseIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
  >
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

// Deterministic avatar gradient per sender
const AVATAR_GRADIENTS = [
  "from-indigo-500 to-violet-500",
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-600",
  "from-fuchsia-500 to-purple-600",
];

const gradientFor = (name: string) => {
  if (name === "System") return "from-orange-400 to-amber-500";
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
};

const TOAST_DURATION = 4000;

export default function Home() {
  const [userId, setUserId] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);
  const [recipientId, setRecipientId] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [allUsers, setAllUsers] = useState<DBUser[]>([]);
  const [onlineUsernames, setOnlineUsernames] = useState<string[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<{
    [key: string]: number;
  }>({});
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Sound: unlocked automatically on the first tap/click/key press.
  // `soundMuted` is the user's own preference (saved in localStorage).
  const [soundMuted, setSoundMuted] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>("default");
  const [isControlsOpen, setIsControlsOpen] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const hasShownOfflineNotification = useRef(false);
  const soundMutedRef = useRef(false);
  const recipientIdRef = useRef("");

  useEffect(() => {
    soundMutedRef.current = soundMuted;
  }, [soundMuted]);

  useEffect(() => {
    recipientIdRef.current = recipientId;
  }, [recipientId]);

  // --- Load saved preference + existing notification permission ---
  useEffect(() => {
    try {
      setSoundMuted(localStorage.getItem("chat-sound-muted") === "1");
    } catch {}

    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // --- Register service worker (needed for mobile notifications) ---
  useEffect(() => {
    if (!isRegistered || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registration failed:", err);
    });

    // When a notification is tapped, the SW tells us which chat to open.
    const onSwMessage = (event: MessageEvent) => {
      if (event.data?.type === "OPEN_CHAT" && event.data.sender) {
        setRecipientId(event.data.sender);
        setUnreadCounts((prev) => ({ ...prev, [event.data.sender]: 0 }));
      }
    };

    navigator.serviceWorker.addEventListener("message", onSwMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", onSwMessage);
    };
  }, [isRegistered]);

  // --- Unlock audio on first user gesture (works on iOS, Android, desktop) ---
  const unlockAudio = useCallback(async () => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;

      if (!AudioCtx) return;

      let ctx = audioContextRef.current;
      if (!ctx || ctx.state === "closed") {
        ctx = new AudioCtx();
        audioContextRef.current = ctx;
      }

      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      // Play one silent sample — this fully unlocks audio on iOS Safari.
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);

      if (ctx.state === "running") setAudioUnlocked(true);
    } catch (error) {
      console.error("Could not unlock audio:", error);
    }
  }, []);

  useEffect(() => {
    const events = ["pointerdown", "touchstart", "keydown", "click"] as const;

    const handler = () => {
      unlockAudio();
    };

    events.forEach((e) =>
      window.addEventListener(e, handler, { passive: true })
    );

    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
    };
  }, [unlockAudio]);

  // --- Re-resume audio whenever the tab/app comes back or goes to background ---
  useEffect(() => {
    const handleVisibility = () => {
      const ctx = audioContextRef.current;
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // --- Play notification sound ---
  const playNotificationSound = useCallback(async () => {
    if (soundMutedRef.current) return;

    const ctx = audioContextRef.current;
    if (!ctx) return;

    try {
      if (ctx.state === "suspended") await ctx.resume();
      if (ctx.state !== "running") return;
      playChime(ctx);
    } catch (error) {
      console.error("Notification sound failed:", error);
    }

    // Short vibration on devices that support it (Android).
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate([120, 60, 120]);
      } catch {}
    }
  }, []);

  // --- Toggle mute (and give instant audible feedback when turning on) ---
  const toggleSound = async () => {
    const next = !soundMuted;
    setSoundMuted(next);
    soundMutedRef.current = next;

    try {
      localStorage.setItem("chat-sound-muted", next ? "1" : "0");
    } catch {}

    if (!next) {
      await unlockAudio();
      const ctx = audioContextRef.current;
      if (ctx && ctx.state === "running") playChime(ctx);
    }
  };

  // --- Enable native browser notifications ---
  const enableNotifications = async () => {
    if (!("Notification" in window)) {
      alert("Your browser does not support notifications.");
      return;
    }

    if (Notification.permission === "denied") {
      alert(
        "Notifications are blocked. Enable them in your browser's site settings."
      );
      return;
    }

    if (Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    } else {
      setNotificationPermission(Notification.permission);
    }
  };

  // --- Socket and Chat ---
  const { socket } = useSocket(isRegistered ? userId : "");

  const { messages, sendMessage, isTyping } = useChat(
    socket,
    userId,
    recipientId
  );

  // --- React Query: Fetch Users Once Initially ---
  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
    enabled: isRegistered,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  const { data: unreadData } = useQuery({
  queryKey: ["unread", userId],
  queryFn: () => fetchUnread(userId),
  enabled: isRegistered && !!userId,
  staleTime: Infinity,
  refetchOnWindowFocus: false,
  refetchInterval: false,
  refetchOnReconnect: true,
});
  // --- Sync Users ---
  useEffect(() => {
    if (!usersData) return;

    setAllUsers((prev) => {
      if (prev.length === 0) return usersData;

      const newUsers = usersData.filter(
        (u) => !prev.some((p) => p._id === u._id)
      );

      return newUsers.length === 0 ? prev : [...prev, ...newUsers];
    });
  }, [usersData]);

  // --- Sync Unread Counts ---
  useEffect(() => {
    if (!unreadData) return;

    const newCounts: { [key: string]: number } = {};
    let totalUnread = 0;
    const sendersWithUnread: string[] = [];

    unreadData.forEach((item: { _id: string; count: number }) => {
      newCounts[item._id] = item.count;
      totalUnread += item.count;

      if (item.count > 0) {
        sendersWithUnread.push(item._id);
      }
    });

    setUnreadCounts((prev) => {
      const keys = new Set([
        ...Object.keys(prev),
        ...Object.keys(newCounts),
      ]);

      const isSame = [...keys].every(
        (key) => (prev[key] || 0) === (newCounts[key] || 0)
      );

      return isSame ? prev : newCounts;
    });

    if (totalUnread > 0 && !hasShownOfflineNotification.current) {
      let notifSender = "System";
      let notifMessage = `You missed ${totalUnread} messages.`;

      if (sendersWithUnread.length === 1) {
        notifSender = sendersWithUnread[0];
        notifMessage = `You missed ${totalUnread} messages from ${notifSender}.`;
      }

      setNotifications((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: notifSender,
          message: notifMessage,
        },
      ]);

      // Sound for missed messages too (plays once audio is unlocked)
      playNotificationSound();

      hasShownOfflineNotification.current = true;

      setTimeout(() => {
        setNotifications((prev) =>
          prev.filter((n) => n.sender !== "System")
        );
      }, 5000);
    }
  }, [unreadData, playNotificationSound]);

  // --- Sort Users ---
  const sortedUsers = useMemo(() => {
    return [...allUsers]
      .filter(
        (u): u is DBUser =>
          !!u && !!u.username && u.username !== userId
      )
      .sort((a, b) => {
        const timeA = a.lastMessageAt || 0;
        const timeB = b.lastMessageAt || 0;

        if (timeA !== timeB) return timeB - timeA;

        const isAOnline = onlineUsernames.includes(a.username);
        const isBOnline = onlineUsernames.includes(b.username);

        if (isAOnline && !isBOnline) return -1;
        if (!isAOnline && isBOnline) return 1;

        return a.username.localeCompare(b.username);
      });
  }, [allUsers, onlineUsernames, userId]);

  // --- Socket Events ---
  useEffect(() => {
    if (!socket || !userId) return;

    const handleOnlineList = (users: string[]) => {
      setOnlineUsernames(users);
    };

    const handleStatusChange = ({
      username,
      status,
    }: {
      username: string;
      status: string;
    }) => {
      setOnlineUsernames((prev) => {
        if (status === "online") {
          return Array.from(new Set([...prev, username]));
        }

        return prev.filter((u) => u !== username);
      });
    };

    const handleGlobalReceive = (data: Message) => {
      // Ignore messages sent by the current user.
      if (data.sender === userId) return;

      // Sound for every incoming message (foreground and background).
      playNotificationSound();

      // Move sender to the top of the user list.
      setAllUsers((prev) =>
        prev.map((u) =>
          u.username === data.sender
            ? { ...u, lastMessageAt: Date.now() }
            : u
        )
      );

      // Update unread count when another chat is open.
      if (data.sender !== recipientIdRef.current) {
        if (document.visibilityState === "hidden") {
          document.title = "(1) New Message";
        }

        setUnreadCounts((prev) => ({
          ...prev,
          [data.sender]: (prev[data.sender] || 0) + 1,
        }));
      }

      // Native system notification while the page is in the background.
      // The OS plays its own notification sound here.
      if (document.visibilityState === "hidden") {
        showSystemNotification(data.sender, data.content, () => {
          setRecipientId(data.sender);
          setUnreadCounts((prev) => ({
            ...prev,
            [data.sender]: 0,
          }));
        });
      }

      // In-app toast notification.
      const notificationId = Date.now() + Math.random();

      setNotifications((prev) => [
        ...prev,
        {
          id: notificationId,
          message: data.content,
          sender: data.sender,
        },
      ]);

      setTimeout(() => {
        setNotifications((prev) =>
          prev.filter((n) => n.id !== notificationId)
        );
      }, TOAST_DURATION);
    };

    socket.on("onlineUsersList", handleOnlineList);
    socket.on("userStatusChange", handleStatusChange);
    socket.on("receiveMessage", handleGlobalReceive);

    socket.emit("join", userId);

    return () => {
      socket.off("onlineUsersList", handleOnlineList);
      socket.off("userStatusChange", handleStatusChange);
      socket.off("receiveMessage", handleGlobalReceive);
    };
  }, [socket, userId, playNotificationSound]);

  // --- Reset Browser Tab Title ---
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        document.title = "Chat App";
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, []);

  // --- Select Chat User ---
  const handleSelectUser = (id: string) => {
    if (id === "System") {
      setNotifications((prev) =>
        prev.filter((n) => n.sender !== "System")
      );
      return;
    }

    setRecipientId(id);
    setUnreadCounts((prev) => ({ ...prev, [id]: 0 }));
    setNotifications((prev) => prev.filter((n) => n.sender !== id));
    setIsSidebarOpen(false);
  };

  const dismissNotification = (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // --- Send Message ---
  const handleSendMessageInternal = (content: string) => {
    sendMessage(content);

    setAllUsers((prev) =>
      prev.map((u) =>
        u.username === recipientId
          ? { ...u, lastMessageAt: Date.now() }
          : u
      )
    );
  };

  if (!isRegistered) {
    return (
      <LoginScreen
        onJoin={(id) => {
          setUserId(id);
          setIsRegistered(true);
        }}
      />
    );
  }

  const needsNotificationPrompt =
    notificationPermission === "default" && "Notification" in globalThis;

  return (
    <div className="relative flex h-dvh overflow-hidden bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 font-sans text-slate-900">
      <Sidebar
        userId={userId}
        users={sortedUsers}
        onlineUsers={onlineUsernames}
        unreadCounts={unreadCounts}
        recipientId={recipientId}
        onSelectUser={handleSelectUser}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <ChatWindow
        recipientId={recipientId}
        messages={messages}
        currentUserId={userId}
        isTyping={isTyping}
        isOnline={onlineUsernames.includes(recipientId)}
        onSendMessage={handleSendMessageInternal}
        onMobileMenuClick={() => setIsSidebarOpen(true)}
      />

      {/* ───────── Alert controls (floating, collapsible) ───────── */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 md:bottom-6 md:right-6">
        <AnimatePresence>
          {isControlsOpen && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className="w-72 overflow-hidden rounded-2xl border border-white/60 bg-white/80 p-2 shadow-2xl shadow-slate-900/10 ring-1 ring-slate-900/5 backdrop-blur-xl"
            >
              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Alerts
              </p>

              {/* Sound row */}
              <button
                onClick={toggleSound}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-slate-100/80"
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    soundMuted
                      ? "bg-slate-100 text-slate-500"
                      : "bg-indigo-100 text-indigo-600"
                  }`}
                >
                  <SpeakerIcon muted={soundMuted} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-800">
                    Message sound
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {soundMuted
                      ? "Muted"
                      : audioUnlocked
                      ? "Plays on every new message"
                      : "Tap anywhere to activate"}
                  </span>
                </span>

                {/* Switch */}
                <span
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    soundMuted ? "bg-slate-300" : "bg-indigo-600"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      soundMuted ? "left-0.5" : "left-[22px]"
                    }`}
                  />
                </span>
              </button>

              {/* Notification row */}
              <button
                onClick={enableNotifications}
                disabled={notificationPermission === "granted"}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-slate-100/80 disabled:cursor-default disabled:hover:bg-transparent"
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    notificationPermission === "granted"
                      ? "bg-emerald-100 text-emerald-600"
                      : "bg-amber-100 text-amber-600"
                  }`}
                >
                  <BellIcon muted={notificationPermission === "denied"} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-800">
                    System notifications
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {notificationPermission === "granted"
                      ? "On — alerts when app is in background"
                      : notificationPermission === "denied"
                      ? "Blocked in browser settings"
                      : "Tap to turn on"}
                  </span>
                </span>

                {notificationPermission === "granted" && (
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                    On
                  </span>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating action button */}
        <motion.button
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => setIsControlsOpen((o) => !o)}
          aria-label="Sound and notification settings"
          className={`relative flex h-12 w-12 items-center justify-center rounded-full text-white shadow-xl shadow-indigo-500/30 ring-4 ring-white/70 transition-colors ${
            soundMuted
              ? "bg-slate-700"
              : "bg-gradient-to-br from-indigo-500 to-violet-600"
          }`}
        >
          <BellIcon muted={soundMuted} />
          {needsNotificationPrompt && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-white bg-amber-500" />
            </span>
          )}
        </motion.button>
      </div>

      {/* ───────── In-app toast notifications ───────── */}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-40 flex flex-col items-center gap-2 px-3 md:inset-x-auto md:right-6 md:top-6 md:items-end md:px-0">
        <AnimatePresence initial={false}>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              layout
              initial={{ y: -24, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ x: 40, opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              onClick={() => handleSelectUser(n.sender)}
              className="pointer-events-auto group relative w-full max-w-sm cursor-pointer overflow-hidden rounded-2xl border border-white/70 bg-white/85 shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/5 backdrop-blur-xl md:w-80"
            >
              <div className="flex items-start gap-3 p-3.5">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white shadow-md ${gradientFor(
                    n.sender
                  )}`}
                >
                  {n.sender[0].toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {n.sender}
                    </p>
                    <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      now
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-slate-600">
                    {n.message}
                  </p>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissNotification(n.id);
                  }}
                  aria-label="Dismiss notification"
                  className="-mr-1 -mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-600 focus:opacity-100 group-hover:opacity-100 max-md:opacity-100"
                >
                  <CloseIcon />
                </button>
              </div>

              {/* Auto-dismiss progress bar */}
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{
                  duration: (n.sender === "System" ? 5000 : TOAST_DURATION) / 1000,
                  ease: "linear",
                }}
                style={{ transformOrigin: "left" }}
                className={`h-0.5 w-full bg-gradient-to-r ${gradientFor(
                  n.sender
                )}`}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}