import { useState, useEffect, useRef } from "react";
import { Socket } from "socket.io-client";

export interface Message {
  _id?: string;
  sender: string;
  receiver: string;
  content: string;
  createdAt?: string;
  type?: 'sent' | 'received';
  status?: 'sending' | 'sent' | 'delivered' | 'read';
}

interface TypingEvent {
  from: string;
  to: string;
  isTyping: boolean;
}

export const useChat = (socket: Socket | null, userId: string, recipientId: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!socket || !recipientId) return;

    setIsTyping(false);
    setMessages([]);

    socket.emit("loadChatHistory", { user1: userId, user2: recipientId });

    const handleHistory = (history: Message[]) => {
      const formatted: Message[] = history.map((msg) => ({
        ...msg,
        type: msg.sender === userId ? 'sent' : 'received',
        status: msg.status || 'read',
      }));
      setMessages(formatted);
    };

    const handleReceive = (data: Message) => {
      if (data.sender === recipientId) {
        setMessages((prev) => [...prev, { ...data, type: 'received', status: 'delivered' }]);
      }
    };

    const handleSent = (data: Message) => {
      setMessages((prev) => prev.map((msg) => 
        (msg.status === 'sending' && msg.content === data.content) 
          ? { ...msg, status: data.status, _id: data._id, createdAt: data.createdAt } 
          : msg
      ));
    };

    const handleTyping = (data: TypingEvent) => {
      if (data.from === recipientId) setIsTyping(data.isTyping);
    };

    socket.on("chatHistoryLoaded", handleHistory);
    socket.on("receiveMessage", handleReceive);
    socket.on("messageSent", handleSent);
    socket.on("userTyping", handleTyping);

    return () => {
      socket.off("chatHistoryLoaded", handleHistory);
      socket.off("receiveMessage", handleReceive);
      socket.off("messageSent", handleSent);
      socket.off("userTyping", handleTyping);
    };
  }, [socket, recipientId, userId]);

  const sendMessage = (content: string) => {
    if (!socket || !content.trim()) return;

    const tempMsg: Message = {
      sender: userId,
      receiver: recipientId,
      content,
      createdAt: new Date().toISOString(),
      type: 'sent',
      status: 'sending'
    };
    setMessages((prev) => [...prev, tempMsg]);

    socket.emit("sendMessage", { to: recipientId, from: userId, message: content });
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socket.emit("typing", { to: recipientId, from: userId, isTyping: false });
  };

  // --- NEW FUNCTION ADDED HERE ---
  const sendTyping = () => {
    if (!socket || !recipientId) return;

    socket.emit("typing", { to: recipientId, from: userId, isTyping: true });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing", { to: recipientId, from: userId, isTyping: false });
    }, 2000);
  };

  // Return the new function!
  return { messages, sendMessage, sendTyping, isTyping };
};