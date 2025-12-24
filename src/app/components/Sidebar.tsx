"use client";
import { useState } from "react";
import { Search, LogOut, X } from "lucide-react";
import { DBUser } from "../page";

interface SidebarProps {
  userId: string;
  users: DBUser[]; 
  onlineUsers: string[];
  unreadCounts: Record<string, number>;
  recipientId: string;
  onSelectUser: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ 
  userId, users, onlineUsers, unreadCounts, recipientId, onSelectUser, isOpen, onClose 
}: SidebarProps) {
  
  const [searchQuery, setSearchQuery] = useState("");

  const filteredUsers = users.filter((user) => 
    // Fix: Add check for user.username before toLowerCase
    user.username && user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside className={`
      fixed md:relative z-40 h-full w-80 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300
      ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
    `}>
      <div className="p-5 border-b border-slate-100 flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-5">
            {/* <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-md">
            Hey,{(userId || "U").charAt(0).toUpperCase()} 🙋🏻‍♂️
            </div> */}
            {/* <div className="w text-white  items-center justify-center font-bold text-lg ">
            Hey,{(userId || "U").charAt(0).toUpperCase()} 🙋🏻‍♂️
            </div> */}
            {/* User Profile Card */}
<div className="flex items-center gap-4 mb-6 p-3 bg-slate-50 rounded-2xl border border-slate-100">
  
  {/* Avatar with Status Dot */}
  <div className="relative">
    <div className="w-12 h-12 rounded-full bg-linear-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-500/20">
      {(userId || "U").charAt(0).toUpperCase()}
    </div>
    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full"></div>
  </div>

  {/* Text Info */}
  <div className="flex flex-col">
    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
      Welcome Back
    </span>
    <div className="flex items-center gap-1.5">
      <h3 className="font-bold text-slate-800 text-lg leading-none">
        {userId || "Guest"}
      </h3>
      <span className="text-lg">👋</span>
    </div>
  </div>
</div>
           
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search users..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" 
            />
          </div>
        </div>
        <button onClick={onClose} className="md:hidden p-1 text-slate-400"><X size={24} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {filteredUsers.length > 0 ? (
          filteredUsers.map(user => {
            if (!user || !user.username) return null; // Safe Check

            const isOnline = onlineUsers.includes(user.username);
            const initial = (user.username || "?").charAt(0).toUpperCase();

            return (
              <button
                key={user._id}
                onClick={() => { onSelectUser(user.username); onClose(); }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                  recipientId === user.username ? 'bg-blue-50 border-blue-100' : 'hover:bg-slate-50'
                }`}
              >
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold">
                    {initial}
                  </div>
                  <div className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-white rounded-full ${isOnline ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{user.username}</p>
                  <p className="text-xs text-slate-400">{isOnline ? 'Online' : 'Offline'}</p>
                </div>
                {(unreadCounts[user.username] || 0) > 0 && (
                  <div className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full shadow-sm">
                    {unreadCounts[user.username]}
                  </div>
                )}
              </button>
            );
          })
        ) : (
          <div className="text-center mt-10 text-slate-400 text-sm">
            No users found
          </div>
        )}
      </div>
      
      <div className="p-4 border-t">
        <button onClick={() => window.location.reload()} className="flex items-center justify-center gap-2 text-black text-sm font-medium bg-red-300 hover:bg-red-500 w-full p-2 rounded-lg   cursor-pointer transition-colors ">
          <LogOut size={16} /> Exit
        </button>
      </div>
    </aside>
  );
}