"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { MessageSquare, ArrowRight } from "lucide-react";

interface LoginScreenProps {
  onJoin: (username: string) => void;
}

export default function LoginScreen({ onJoin }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");

  const handleJoin = () => {
    if (!username.trim()) {
      setError("Please enter a username");
      return;
    }
    if (username.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    onJoin(username.trim());
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-linear-to-br from-slate-50 to-slate-100 p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        className="bg-white p-8 md:p-10 rounded-3xl shadow-2xl w-full max-w-md border border-white/50 backdrop-blur-sm"
      >
        <div className="text-center mb-8">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="w-20 h-20 bg-linear-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 text-white shadow-lg shadow-blue-200"
          >
            <MessageSquare size={40} />
          </motion.div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Welcome Back</h2>
          <p className="text-slate-500 mt-2 text-sm font-medium">Enter your username to join the workspace</p>
        </div>

        <div className="space-y-5">
          <div className="relative">
            <input 
              type="text" 
              value={username} 
              onChange={(e) => {
                setUsername(e.target.value);
                setError("");
              }} 
              placeholder="e.g. alex_dev" 
              className={`w-full px-5 py-4 bg-slate-50 rounded-xl border ${error ? 'border-red-300 focus:ring-red-200' : 'border-slate-200 focus:ring-blue-500/20'} outline-none focus:ring-4 transition-all text-slate-700 font-medium placeholder:text-slate-400`} 
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()} 
              autoFocus
            />
            {error && (
              <motion.p 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="absolute -bottom-6 left-1 text-xs font-semibold text-red-500"
              >
                {error}
              </motion.p>
            )}
          </div>

          <button 
            onClick={handleJoin} 
            disabled={!username.trim()} 
            className="group w-full bg-slate-900 hover:bg-blue-600 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50 disabled:hover:bg-slate-900 shadow-xl shadow-slate-200 flex items-center justify-center gap-2 mt-2"
          >
            <span>Join System</span>
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div className="mt-8 text-center">
           <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">
             Real-Time Secure Chat
           </p>
        </div>
      </motion.div>
    </div>
  );
}