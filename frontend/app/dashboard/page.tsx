"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import BackgroundAnimation from "../components/BackgroundAnimation";

import Sidebar from "../components/Sidebar";
import ProjectConfigModal from "../components/ProjectConfigModal";

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
  const [dashboardView, setDashboardView] = useState<"projects" | "import">("projects");
  const [deployedProjects, setDeployedProjects] = useState<any[]>([]); // Mock state for now
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);

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
      <Sidebar
        user={user}
        isDropdownOpen={isDropdownOpen}
        setIsDropdownOpen={setIsDropdownOpen}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative overflow-y-auto overflow-x-hidden bg-black p-8">
        <BackgroundAnimation />

        <div className="max-w-7xl mx-auto flex flex-col gap-8 relative z-10 w-full">
          <main className="mt-4">
            {dashboardView === "projects" ? (
              <>
                {/* Projects View */}
                <div className="mb-10 flex items-center justify-between">
                  <div>
                    <h2 className="text-4xl font-bold mb-3 tracking-tight">Projects</h2>
                    <p className="text-[#a1a1aa] text-lg">Manage your deployed applications and services.</p>
                  </div>
                  <button
                    onClick={() => setDashboardView("import")}
                    className="px-6 py-2.5 text-sm font-semibold bg-white text-black rounded-xl hover:bg-gray-200 transition-all duration-200"
                  >
                    Add New Project
                  </button>
                </div>

                {deployedProjects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 border border-dashed border-[#27272a] rounded-2xl bg-[#18181b]/30">
                    <div className="w-16 h-16 bg-[#18181b] rounded-full border border-[#27272a] flex items-center justify-center mb-6">
                      <svg className="w-8 h-8 text-[#a1a1aa]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">No projects deployed yet</h3>
                    <p className="text-[#71717a] max-w-sm text-center mb-8">Get started by importing a repository from your connected GitHub account.</p>
                    <button
                      onClick={() => setDashboardView("import")}
                      className="px-6 py-2.5 text-sm font-semibold bg-white text-black rounded-xl hover:bg-gray-200 transition-all duration-200 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                    >
                      Import Repository
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {/* Map over deployed projects if they existed */}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Import View */}
                <div className="mb-10 flex items-center gap-5">
                  <button
                    onClick={() => setDashboardView("projects")}
                    className="p-2.5 bg-[#18181b] border border-[#27272a] rounded-lg hover:bg-[#27272a] hover:text-white text-[#a1a1aa] transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                  </button>
                  <div>
                    <h2 className="text-4xl font-bold mb-2 tracking-tight">Import Git Repository</h2>
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
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold px-2 py-1 bg-[#27272a] text-[#a1a1aa] group-hover:text-white rounded-md uppercase tracking-wider transition-colors">
                              {repo.language || "Unknown Stack"}
                            </span>
                          </div>
                          <button 
                            onClick={() => setSelectedRepo(repo)}
                            className="px-5 py-2 text-sm font-semibold bg-white text-black rounded-xl hover:bg-gray-200 hover:scale-105 hover:shadow-[0_0_15px_rgba(255,255,255,0.3)] transition-all duration-200"
                          >
                            Import
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </main>
        </div>

        {/* Floating Logo */}
        <div className="fixed bottom-6 right-6 z-50">
          <div className="w-20 h-20 bg-[#18181b]/80 backdrop-blur-md border border-[#27272a] rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.5)] hover:border-white/50 hover:scale-105 hover:-translate-y-1 transition-all duration-300 cursor-pointer group flex items-center justify-center">
            <Image
              src="/BravoCloud-logo-white.png"
              alt="BravoCloud Logo"
              width={45}
              height={16}
              className="object-contain drop-shadow-md opacity-70 group-hover:opacity-100 transition-opacity"
            />
          </div>
        </div>

      </div>

      {selectedRepo && (
        <ProjectConfigModal repo={selectedRepo} onClose={() => setSelectedRepo(null)} />
      )}
    </div>
  );
}
