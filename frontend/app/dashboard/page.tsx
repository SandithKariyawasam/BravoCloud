"use client";

import { useEffect, useState } from "react";
import BackgroundAnimation from "../components/BackgroundAnimation";

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

export default function Dashboard() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:4000/api/github/repos", { credentials: "include" })
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to fetch");
        }
        return res.json();
      })
      .then((data) => {
        setRepos(data.repos);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        // Redirect to login if unauthorized
        window.location.href = "/";
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#020617] text-white p-8 font-sans relative overflow-hidden">
      <BackgroundAnimation />
      {/* Subtle background gradients */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-900/20 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-cyan-900/10 blur-[150px] rounded-full pointer-events-none" />
      
      <div className="max-w-7xl mx-auto flex flex-col gap-8 relative z-10">
        <header className="flex items-center justify-between border-b border-blue-900/50 pb-6 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center font-bold text-xl shadow-[0_0_15px_rgba(59,130,246,0.5)]">
              B
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200">
              BravoCloud
            </h1>
          </div>
          <button 
            onClick={() => {
              fetch("http://localhost:4000/auth/logout", { method: "POST", credentials: "include" })
                .then(() => window.location.href = "/");
            }}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded-lg border border-slate-700/50 transition-all"
          >
            Sign Out
          </button>
        </header>

        <main>
          <div className="mb-10">
            <h2 className="text-4xl font-bold mb-3 tracking-tight">Import Git Repository</h2>
            <p className="text-slate-400 text-lg">Select a repository from your connected GitHub account to deploy.</p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-32">
              <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-6 shadow-[0_0_20px_rgba(59,130,246,0.4)]" />
              <p className="text-blue-300 font-medium animate-pulse">Syncing repositories...</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {repos.map((repo) => (
                <div 
                  key={repo.id} 
                  className="bg-slate-900/40 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 hover:bg-slate-800/60 hover:border-blue-500/50 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(59,130,246,0.15)] transition-all duration-300 group flex flex-col"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 overflow-hidden pr-2">
                      <svg className="w-5 h-5 text-slate-400 group-hover:text-blue-400 flex-shrink-0 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                        <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v16a2 2 0 002 2h16a2 2 0 002-2V4a2 2 0 00-2-2H4zm8 14.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM8 8a2 2 0 100-4 2 2 0 000 4zm8 0a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                      <h3 className="font-semibold text-lg truncate text-slate-100 group-hover:text-white transition-colors" title={repo.fullName}>
                        {repo.name}
                      </h3>
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full font-medium whitespace-nowrap ${repo.private ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-blue-900/30 text-blue-300 border border-blue-800/50'}`}>
                      {repo.private ? "Private" : "Public"}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 mb-8 flex-1 line-clamp-2 group-hover:text-slate-300 transition-colors">
                    {repo.description || "No description provided for this repository."}
                  </p>
                  <div className="flex items-center justify-between mt-auto pt-5 border-t border-slate-800/80 group-hover:border-slate-700 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                      <span className="text-sm font-medium text-slate-300">{repo.language || "Unknown"}</span>
                    </div>
                    <button className="px-5 py-2 text-sm font-semibold bg-white text-[#020617] rounded-xl hover:bg-blue-50 hover:scale-105 hover:shadow-[0_0_15px_rgba(255,255,255,0.4)] transition-all duration-200">
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
  );
}
