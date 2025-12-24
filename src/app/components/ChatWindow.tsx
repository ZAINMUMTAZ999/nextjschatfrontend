"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Send, 
  Menu, 
  MessageSquare, 
  Clock, 
  Check, 
  CheckCheck, 
  
} from "lucide-react";
import { Message } from "../hooks/useChat"; // Import shared type if possible, or redefine locally

interface ChatWindowProps {
  recipientId: string;
  messages: Message[];
  currentUserId: string;
  isTyping: boolean;
  isOnline: boolean;
  onSendMessage: (content: string) => void;
  onMobileMenuClick: () => void;
}

export default function ChatWindow({ 
  recipientId, 
  messages, 
//   currentUserId, 
  isTyping, 
  isOnline, 
  onSendMessage, 
  onMobileMenuClick 
}: ChatWindowProps) {
  
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // --- 1. Empty State (No Chat Selected) ---
  if (!recipientId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 text-slate-400 p-4 text-center h-full relative">
        <button 
          onClick={onMobileMenuClick}
          className="md:hidden absolute top-4 left-4 p-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
        >
          <Menu size={24} />
        </button>
        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
          <MessageSquare size={48} className="text-slate-300" />
        </div>
        <h3 className="text-xl font-bold text-slate-700">Your Workspace</h3>
        <p className="text-slate-500 max-w-xs mt-2">
          Select a conversation from the sidebar to start collaborating in real-time.
        </p>
      </div>
    );
  }

  // --- 2. Chat Interface ---
  return (
    <div className="flex-1 flex flex-col h-full bg-[#efeae2] relative">
      {/* HEADER */}
      <header className="h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <button 
            onClick={onMobileMenuClick}
            className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full"
          >
            <Menu size={24} />
          </button>

          <div className="relative">
             <div className="w-10 h-10 rounded-full bg-linear-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center font-bold shadow-sm text-lg">
               {recipientId.charAt(0).toUpperCase()}
             </div>
             {isOnline && (
               <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
             )}
          </div>
          
          <div>
            <h3 className="font-bold text-slate-800 leading-tight">{recipientId}</h3>
            {isTyping ? (
              <span className="text-xs text-blue-600 font-bold animate-pulse">typing...</span>
            ) : (
              <span className={`text-xs font-medium ${isOnline ? 'text-green-600' : 'text-slate-400'}`}>
                {isOnline ? 'Active now' : 'Offline'}
              </span>
            )}
          </div>
        </div>

      </header>

      {/* MESSAGES AREA */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2 bg-[url('https://i.pinimg.com/originals/8c/98/99/8c98994518b575bfd8c949e91d20548b.png')] bg-repeat bg-opacity-50">
        <div className="flex justify-center mb-6">
           <span className="text-[10px] bg-white/60 px-3 py-1 rounded-full text-slate-500 font-medium shadow-sm backdrop-blur-sm">
             Today
           </span>
        </div>

        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => {
            const isMe = msg.type === 'sent';
            return (
              <motion.div
                key={msg._id || idx}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`
                    max-w-[85%] md:max-w-[65%] px-4 py-2 shadow-sm text-[15px] leading-snug wrap-break-word relative group
                    ${isMe 
                      ? 'bg-[#d9fdd3] text-slate-900 rounded-l-xl rounded-tr-xl rounded-br-none' 
                      : 'bg-white text-slate-900 rounded-r-xl rounded-tl-xl rounded-bl-none'
                    }
                  `}
                >
                  {/* Message Content */}
                  <p className="mb-1">{msg.content}</p>

                  {/* Metadata (Time & Status) */}
                  <div className={`flex items-center justify-end gap-1 text-[10px] ${isMe ? 'text-green-800/60' : 'text-slate-400'}`}>
                    <span>
                      {msg.createdAt 
                        ? new Date(msg.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) 
                        : new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
                      }
                    </span>
                    {isMe && (
                       <span>
                         {msg.status === 'sending' ? <Clock size={12} /> : 
                          msg.status === 'sent' ? <Check size={14} /> : 
                          <CheckCheck size={14} className={msg.status === 'read' ? 'text-blue-500' : ''} />}
                       </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        {/* Typing Bubble */}
        {isTyping && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="bg-white px-4 py-3 rounded-xl rounded-bl-none shadow-sm flex gap-1 items-center">
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* FOOTER INPUT */}
      <footer className="p-3 bg-slate-100 border-t border-slate-200">
        <div className="max-w-4xl mx-auto flex items-end gap-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
          <input
            className="flex-1 bg-transparent border-none px-3 py-2 text-sm focus:ring-0 outline-none text-slate-700 placeholder:text-slate-400 max-h-32 overflow-y-auto resize-none"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
          />
          <button 
            onClick={handleSend} 
            disabled={!input.trim()}
            className="bg-green-700 hover:cursor-pointer hover:bg-green-800  text-white p-3 rounded-xl transition-all disabled:opacity-50  shrink-0 shadow-md"
          >
            <Send size={18} />
          </button>
        </div>
      </footer>
    </div>
  );
}