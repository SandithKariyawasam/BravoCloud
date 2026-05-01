"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import BackgroundAnimation from "../components/BackgroundAnimation";

import Sidebar from "../components/Sidebar";

interface Repo {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  htmlUrl: string;
  description: string;
  language: string;
  updatedAt: string;
}

interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

export default function Dashboard() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("http://localhost:4000/api/github/repos", { credentials: "include" }),
      fetch("http://localhost:4000/auth/me", { credentials: "include" })
    ])
      .then(async ([reposRes, userRes]) => {
        if (!reposRes.ok || !userRes.ok) {
          throw new Error("Failed to fetch data");
        }
        const reposData = await reposRes.json();
        const userData = await userRes.json();
        
        setRepos(reposData.repos);
        setUser(userData.user);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        window.location.href = "/";
      });
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("http://localhost:4000/auth/logout", {
        method: "POST",
        credentials: "include"
      });
      window.location.href = "/";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
      <Sidebar />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative overflow-y-auto overflow-x-hidden bg-black p-8">
        <BackgroundAnimation />
        
        <div className="max-w-7xl mx-auto flex flex-col gap-8 relative z-10 w-full">
          <header className="flex items-center justify-between border-b border-gray-800 pb-6 backdrop-blur-md">
            <div className="flex items-center gap-4">
              <Image 
                src="/BravoCloud-logo-white.png" 
                alt="BravoCloud Logo" 
                width={160} 
                height={40} 
                className="object-contain h-10 w-auto drop-shadow-md"
                priority
              />
            </div>
            
            {user && (
              <div className="relative">
                <div 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-3 px-4 py-2 bg-[#18181b]/80 border border-[#27272a] rounded-full hover:bg-[#27272a] transition-colors cursor-pointer group shadow-sm"
                >
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-semibold text-[#a1a1aa] group-hover:text-white transition-colors">
                      {user.displayName || user.username}
                    </span>
                    <span className="text-xs text-[#71717a]">@{user.username}</span>
                  </div>
                  <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#3f3f46] group-hover:border-white transition-colors">
                    <img 
                      src={user.avatarUrl || "https://github.com/ghost.png"} 
                      alt={user.username} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-[#18181b] border border-[#27272a] rounded-xl shadow-xl z-50 overflow-hidden">
                    <button 
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-3 text-sm text-[#a1a1aa] hover:bg-[#27272a] hover:text-white transition-colors flex items-center gap-2 font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            )}
          </header>

        <main>
          <div className="mb-10 flex items-center justify-between">
            <div>
              <h2 className="text-4xl font-bold mb-3 tracking-tight">Import Git Repository</h2>
              <p className="text-[#a1a1aa] text-lg">Select a repository from your connected GitHub account to deploy.</p>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-32">
              <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mb-6 shadow-[0_0_15px_rgba(255,255,255,0.2)]" />
              <p className="text-gray-300 font-medium animate-pulse">Syncing repositories & profile...</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {repos.map((repo) => (
                <div 
                  key={repo.id} 
                  className="bg-[#18181b]/60 backdrop-blur-sm border border-[#27272a] rounded-xl p-6 hover:bg-[#18181b] hover:border-white/50 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(255,255,255,0.05)] transition-all duration-300 group flex flex-col"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 overflow-hidden pr-2">
                      <svg className="w-5 h-5 text-[#71717a] group-hover:text-white flex-shrink-0 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                        <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v16a2 2 0 002 2h16a2 2 0 002-2V4a2 2 0 00-2-2H4zm8 14.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM8 8a2 2 0 100-4 2 2 0 000 4zm8 0a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                      <h3 className="font-semibold text-lg truncate text-[#e4e4e7] group-hover:text-white transition-colors" title={repo.fullName}>
                        {repo.name}
                      </h3>
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full font-medium whitespace-nowrap ${repo.private ? 'bg-black text-[#a1a1aa] border border-[#27272a]' : 'bg-white/10 text-gray-200 border border-white/20'}`}>
                      {repo.private ? "Private" : "Public"}
                    </span>
                  </div>
                  <p className="text-sm text-[#a1a1aa] mb-8 flex-1 line-clamp-2 group-hover:text-[#e4e4e7] transition-colors">
                    {repo.description || "No description provided for this repository."}
                  </p>
                  <div className="flex items-center justify-between mt-auto pt-5 border-t border-[#27272a] group-hover:border-[#3f3f46] transition-colors">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
                      <span className="text-sm font-medium text-[#a1a1aa]">{repo.language || "Unknown"}</span>
                    </div>
                    <button className="px-5 py-2 text-sm font-semibold bg-white text-black rounded-xl hover:bg-gray-200 hover:scale-105 hover:shadow-[0_0_15px_rgba(255,255,255,0.3)] transition-all duration-200">
                      Deploy App
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
      </div>
    </div>
  );
}
