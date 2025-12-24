/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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

// --- Sound Utility ---
interface WindowWithWebkit extends Window {
  webkitAudioContext?: typeof AudioContext;
}

const playNotificationSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as WindowWithWebkit).webkitAudioContext;
    if (!AudioContextClass) return;

    const audioCtx = new AudioContextClass();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(500, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.5);
  } catch (e) {
    console.error("Audio play failed");
  }
};

// --- API Fetchers ---s
const API_URL =
 
 "http://localhost:5000";


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

export default function Home() {
  const [userId, setUserId] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);
  const [recipientId, setRecipientId] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [allUsers, setAllUsers] = useState<DBUser[]>([]);
  const [onlineUsernames, setOnlineUsernames] = useState<string[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<{ [key: string]: number }>({});
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const hasShownOfflineNotification = useRef(false);

  const { socket } = useSocket(isRegistered ? userId : "");
  const { messages, sendMessage, isTyping } = useChat(socket, userId, recipientId);

  // --- React Query ---
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    enabled: isRegistered, 
    refetchInterval: 15000, 
  });

  const { data: unreadData } = useQuery({
    queryKey: ['unread', userId],
    queryFn: () => fetchUnread(userId),
    enabled: isRegistered && !!userId,
  });

  // Sync Data
  useEffect(() => {
    if (usersData) {
      setAllUsers((prev) => {
        if (prev.length === 0) return usersData;
        const newUsers = usersData.filter(u => !prev.some(p => p._id === u._id));
        if (newUsers.length === 0) return prev;
        return [...prev, ...newUsers];
      });
    }
  }, [usersData]);

  useEffect(() => {
    if (unreadData) {
      const newCounts: { [key: string]: number } = {};
      let totalUnread = 0;
      const sendersWithUnread: string[] = [];

      unreadData.forEach((item: { _id: string; count: number }) => {
        newCounts[item._id] = item.count;
        totalUnread += item.count;
        if (item.count > 0) sendersWithUnread.push(item._id);
      });
      
      setUnreadCounts(prev => {
        const isSame = Object.keys(newCounts).every(key => newCounts[key] === prev[key]);
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
          { id: Date.now(), sender: notifSender, message: notifMessage },
        ]);
        hasShownOfflineNotification.current = true;
        setTimeout(() => setNotifications((prev) => prev.slice(1)), 5000);
      }
    }
  }, [unreadData]);

  // --- Sorting ---
  const sortedUsers = useMemo(() => {
    return [...allUsers]
      .filter((u): u is DBUser => !!u && !!u.username && u.username !== userId) 
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

    const handleOnlineList = (users: string[]) => setOnlineUsernames(users);
    
    const handleStatusChange = ({ username, status }: { username: string; status: string }) => {
      setOnlineUsernames((prev) => {
        if (status === "online") return Array.from(new Set([...prev, username]));
        return prev.filter((u) => u !== username);
      });
    };

    // --- FIX: Logic Split for Toast vs Unread ---
    const handleGlobalReceive = (data: Message) => {
      // 1. ALWAYS Play Sound
      playNotificationSound();

      // 2. Always Bump User to Top
      setAllUsers((prev) => 
        prev.map((u) => 
          u.username === data.sender 
            ? { ...u, lastMessageAt: Date.now() } 
            : u
        )
      );

      // Only process notifications if I am not the sender
      if (data.sender !== userId) {
        
        // 3. UNREAD LOGIC: Only update if I am NOT in that chat
        if (data.sender !== recipientId) {
          if (document.visibilityState === "hidden") {
            document.title = `(1) New Message`;
          }
          setUnreadCounts((prev) => ({
            ...prev,
            [data.sender]: (prev[data.sender] || 0) + 1,
          }));
        }

        // 4. TOAST LOGIC: Show ALWAYS (even if in same chat)
        setNotifications((prev) => [
          ...prev,
          { id: Date.now(), message: data.content, sender: data.sender },
        ]);
        
        setTimeout(() => setNotifications((prev) => prev.slice(1)), 4000);
      }
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
  }, [socket, userId, recipientId]); // Ensure recipientId is in dependency array so unread logic works

  const handleSelectUser = (id: string) => {
    if (id === "System") {
      setNotifications((prev) => prev.filter((n) => n.sender !== "System"));
      return;
    }
    setRecipientId(id);
    setUnreadCounts((prev) => ({ ...prev, [id]: 0 }));
    setNotifications((prev) => prev.filter((n) => n.sender !== id));
    setIsSidebarOpen(false);
  };

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
    return <LoginScreen onJoin={(id) => { setUserId(id); setIsRegistered(true); }} />;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
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

      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 pointer-events-none w-full max-w-sm px-4 md:px-0 md:w-auto">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              className="pointer-events-auto bg-white/90 backdrop-blur-md border border-slate-200 p-4 rounded-xl shadow-xl w-full md:w-80 cursor-pointer hover:bg-white transition-colors"
              onClick={() => handleSelectUser(n.sender)}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${n.sender === "System" ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                  {n.sender[0].toUpperCase()}
                </div>
                <div className="overflow-hidden min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">
                    {n.sender}
                  </p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {n.message}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
