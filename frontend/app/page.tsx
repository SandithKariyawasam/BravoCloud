"use client";

import Image from "next/image";
import BackgroundAnimation from "./components/BackgroundAnimation";
import { Analytics } from "@vercel/analytics/next"
import { useState } from "react";
import { Loader2, Key } from "lucide-react";

export default function Home() {
  const [patToken, setPatToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPatLogin, setShowPatLogin] = useState(false);

  const handleTokenLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patToken.trim()) return;

    setLoading(true);
    setError("");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    try {
      const res = await fetch(`${apiUrl}/auth/token-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: patToken }),
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("bravocloud_token", data.token);
        window.location.href = "/dashboard";
      } else {
        setError(data.error || "Invalid token");
      }
    } catch (err) {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-black font-sans text-white relative overflow-hidden">
      <BackgroundAnimation />
      {/* Background glow effects - Removed for B&W theme */}

      <Analytics />
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-white/5 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-white/5 blur-[120px] rounded-full pointer-events-none" />

      <main className="flex flex-col items-center justify-center py-20 px-4 text-center z-10 max-w-4xl w-full">
        <div className="inline-flex items-center px-3 py-1 mb-8 rounded-full border border-white/20 bg-white/5 text-gray-300 text-sm font-medium tracking-wide">
          <span className="w-2 h-2 rounded-full bg-white mr-2 animate-pulse" />
          The Next Generation PaaS
        </div>

        <h1 className="text-6xl md:text-8xl font-bold tracking-tighter mb-6 bg-gradient-to-br from-white via-gray-200 to-gray-500 bg-clip-text text-transparent drop-shadow-sm">
          Deploy Faster. <br /> Scale Infinitely.
        </h1>
        <p className="text-xl md:text-2xl text-gray-400 mb-12 max-w-2xl leading-relaxed">
          BravoCloud automatically detects your framework, builds your Docker container, and deploys to AWS with zero configuration.
        </p>

        <a
          href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/auth/github`}
          className="group relative inline-flex items-center justify-center px-8 py-4 font-semibold text-black transition-all duration-300 bg-white border border-white rounded-full hover:bg-gray-200 hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.2)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white focus:ring-offset-black"
        >
          <svg className="w-6 h-6 mr-3 group-hover:animate-bounce" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
          </svg>
          Continue with GitHub
        </a>

        {/* PAT Login */}
        <div className="mt-12 pt-12 border-t border-white/10 w-full max-w-sm mx-auto flex flex-col items-center">
          {!showPatLogin ? (
            <button 
              onClick={() => setShowPatLogin(true)}
              className="text-sm text-gray-400 hover:text-white transition-colors font-medium flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-white/5"
            >
              <Key size={16} /> Or authenticate with API Token
            </button>
          ) : (
            <form onSubmit={handleTokenLogin} className="w-full flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <input 
                type="password" 
                placeholder="bc_xxxxxxxxxxxxxxxxxxxxxx"
                value={patToken}
                onChange={(e) => setPatToken(e.target.value)}
                className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all text-center font-mono text-sm"
                autoFocus
              />
              {error && <p className="text-red-400 text-xs text-center">{error}</p>}
              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={() => { setShowPatLogin(false); setError(""); setPatToken(""); }}
                  className="flex-1 bg-transparent hover:bg-white/5 border border-white/10 text-gray-300 rounded-lg px-4 py-3 font-medium transition-colors text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={loading || !patToken}
                  className="flex-[2] bg-white/10 hover:bg-white/20 border border-white/20 disabled:opacity-50 text-white rounded-lg px-4 py-3 font-medium transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : "Secure Login"}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
