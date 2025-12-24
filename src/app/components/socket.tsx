import { useState, useEffect } from "react";
import { Socket } from "socket.io-client";

// --- 1. Strict Types (No more 'any') ---

export interface Message {
  _id?: string;
  sender: string;
  receiver: string;
  content: string;
  createdAt?: string;
  type?: 'sent' | 'received';
  status?: 'sending' | 'sent' | 'delivered' | 'read';
}

// Interface for the typing event payload
interface TypingEvent {
  from: string;
  to: string;
  isTyping: boolean;
}

export const useChat = (socket: Socket | null, userId: string, recipientId: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  // --- 2. Load Chat History ---
  useEffect(() => {
    if (!socket || !recipientId) return;

    // Reset state when switching users
    setIsTyping(false);
    setMessages([]);

    socket.emit("loadChatHistory", { user1: userId, user2: recipientId });

    // FIX: Typed 'history' properly
    const handleHistory = (history: Message[]) => {
      const formatted: Message[] = history.map((msg) => ({
        ...msg,
        type: msg.sender === userId ? 'sent' : 'received',
        status: msg.status || 'read',
      }));
      setMessages(formatted);
    };

    socket.on("chatHistoryLoaded", handleHistory);
    return () => { socket.off("chatHistoryLoaded", handleHistory); };
  }, [socket, recipientId, userId]);

  // --- 3. Handle Real-Time Events (Messages & Typing) ---
  useEffect(() => {
    if (!socket || !recipientId) return;

    // A. Receive Message
    const handleReceive = (data: Message) => {
      // Only show message if it belongs to the active chat
      if (data.sender === recipientId) {
        setMessages((prev) => [...prev, { ...data, type: 'received', status: 'delivered' }]);
      }
    };

    // B. Message Acknowledgment (Update the Optimistic Message)
    const handleSent = (data: Message) => {
      setMessages((prev) => prev.map((msg) => 
        // Match by content & status to find the temporary message
        (msg.status === 'sending' && msg.content === data.content) 
          ? { ...msg, status: data.status, _id: data._id, createdAt: data.createdAt } 
          : msg
      ));
    };

    // C. Handle Typing (THIS WAS MISSING IN YOUR CODE)
    const handleTyping = (data: TypingEvent) => {
      // Only update if the typing event comes from the current recipient
      if (data.from === recipientId) {
        setIsTyping(data.isTyping);
      }
    };

    // Attach Listeners
    socket.on("receiveMessage", handleReceive);
    socket.on("messageSent", handleSent);
    socket.on("userTyping", handleTyping); // <--- Added Listener

    // Cleanup
    return () => {
      socket.off("receiveMessage", handleReceive);
      socket.off("messageSent", handleSent);
      socket.off("userTyping", handleTyping); // <--- Added Cleanup
    };
  }, [socket, recipientId, userId]);

  // --- 4. Send Message Logic ---
  const sendMessage = (content: string) => {
    if (!socket || !content.trim()) return;

    // Optimistic Update (Add to UI immediately)
    const tempMsg: Message = {
      sender: userId,
      receiver: recipientId,
      content,
      createdAt: new Date().toISOString(),
      type: 'sent',
      status: 'sending'
    };
    setMessages((prev) => [...prev, tempMsg]);

    // Emit to Server
    socket.emit("sendMessage", { to: recipientId, from: userId, message: content });
    
    // Stop typing indicator immediately after sending
    socket.emit("typing", { to: recipientId, from: userId, isTyping: false });
  };

  return { messages, sendMessage, isTyping };
};