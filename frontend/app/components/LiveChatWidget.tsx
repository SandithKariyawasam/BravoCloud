"use client";

import { useState, useEffect, useRef } from "react";
import { MessageSquare, X, Send, User } from "lucide-react";

export default function LiveChatWidget({ user }: { user: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!user || !user.id) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    
    let interval: NodeJS.Timeout;

    const fetchMessages = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/chat?roomId=${user.id}`);
        const data = await res.json();
        
        setMessages((prev) => {
          if (data.length === 0 && prev.length > 0) {
            // Chat was terminated
            return [];
          }
          if (data.length > prev.length) {
            // Auto open if agent replies (last message is from admin)
            const lastMsg = data[data.length - 1];
            if (lastMsg && lastMsg.isAdmin && !isOpen) {
              setIsOpen(true);
            }
            return data;
          }
          return prev;
        });
      } catch (err) {
        // silently fail on polling error
      }
    };

    // Initial fetch
    fetchMessages();

    // Poll every 3 seconds
    interval = setInterval(fetchMessages, 3000);

    return () => {
      clearInterval(interval);
    };
  }, [user, isOpen]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !user) return;

    setInput("");

    // Optimistic update
    const optMsg = { text, isAdmin: false, senderName: user.name || user.githubId || "User", timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, optMsg]);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    
    try {
      await fetch(`${apiUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: user.id,
          senderId: user.id,
          senderName: user.name || user.githubId || "User",
          text,
          isAdmin: false,
        }),
      });
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Chat Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-50 p-4 rounded-full bg-white text-black shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 ${isOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'}`}
      >
        <MessageSquare size={24} />
      </button>

      {/* Chat Window */}
      <div 
        className={`fixed bottom-6 right-6 z-50 w-80 sm:w-96 bg-[#121214] border border-[#27272a] rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 origin-bottom-right ${isOpen ? 'scale-100 opacity-100' : 'scale-90 opacity-0 pointer-events-none'}`}
        style={{ height: "500px", maxHeight: "calc(100vh - 48px)" }}
      >
        {/* Header */}
        <div className="bg-[#18181b] border-b border-[#27272a] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center">
              <User size={16} />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Live Support</h3>
              <p className="text-xs text-[#a1a1aa] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                We usually reply in minutes
              </p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-[#a1a1aa] hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto custom-sidebar-scrollbar p-4 flex flex-col gap-4 bg-black">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4 opacity-70">
              <MessageSquare size={32} className="mb-3 text-[#3f3f46]" />
              <h4 className="font-medium text-sm text-white mb-1">Send us a message!</h4>
              <p className="text-xs text-[#a1a1aa]">We're here to help you with your deployment issues.</p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMe = !msg.isAdmin;
              return (
                <div key={idx} className={`flex flex-col max-w-[85%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}>
                  <span className="text-[10px] text-[#71717a] mb-1 px-1">{isMe ? 'You' : 'Support Agent'}</span>
                  <div className={`px-4 py-2.5 rounded-2xl text-[13px] ${isMe ? 'bg-white text-black rounded-tr-sm' : 'bg-[#27272a] text-white rounded-tl-sm'}`}>
                    {msg.text}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <div className="p-3 border-t border-[#27272a] bg-[#18181b]">
          <form onSubmit={sendMessage} className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 bg-black border border-[#27272a] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#3f3f46] text-white"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="p-2.5 bg-white text-black rounded-xl disabled:opacity-50 hover:bg-gray-200 transition-colors"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
