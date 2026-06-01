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

  const [searchQuery, setSearchQuery] = useState("");

  const filteredRepos = repos.filter(repo => 
    repo.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (repo.description && repo.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = () => {
    setLoading(true);
    Promise.all([
      fetch("https://bravo-cloud-ydew.vercel.app/api/github/repos", { credentials: "include" }),
      fetch("https://bravo-cloud-ydew.vercel.app/auth/me", { credentials: "include" }),
      fetch("https://bravo-cloud-ydew.vercel.app/api/projects", { credentials: "include" })
    ])
      .then(async ([reposRes, userRes, projectsRes]) => {
        if (!reposRes.ok || !userRes.ok) {
          throw new Error("Failed to fetch core data");
        }
        const reposData = await reposRes.json();
        const userData = await userRes.json();
        
        let projectsData = { projects: [] };
        if (projectsRes.ok) {
          projectsData = await projectsRes.json();
        }

        setRepos(reposData.repos);
        setUser(userData.user);
        setDeployedProjects(projectsData.projects || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        window.location.href = "/";
      });
  };

  const handleLogout = async () => {
    try {
      await fetch("https://bravo-cloud-ydew.vercel.app/auth/logout", {
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
                    {deployedProjects.map((project: any) => {
                      const latestDeployment = project.deployments?.[0];
                      const status = latestDeployment?.status || 'UNKNOWN';
                      const isBuilding = status === 'QUEUED' || status === 'BUILDING';
                      const isSuccess = status === 'SUCCESS' || status === 'DEPLOYED';
                      const isFailed = status === 'FAILED';
                      
                      return (
                        <div key={project.id} className="bg-[#18181b]/60 backdrop-blur-sm border border-[#27272a] rounded-xl p-6 hover:bg-[#18181b] hover:border-white/50 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(255,255,255,0.05)] transition-all duration-300 group flex flex-col">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3 overflow-hidden pr-2">
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#27272a] to-[#18181b] border border-[#3f3f46] flex items-center justify-center flex-shrink-0">
                                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                              </div>
                              <h3 className="font-semibold text-lg truncate text-white">{project.name}</h3>
                            </div>
                            <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold tracking-wider uppercase flex items-center gap-1.5
                              ${isSuccess ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 
                                isFailed ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
                                'bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse'}`}>
                              {isBuilding && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" />}
                              {status}
                            </span>
                          </div>
                          
                          <div className="flex flex-col gap-2 mb-6">
                            <div className="flex items-center gap-2 text-sm text-[#a1a1aa]">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
                              <span className="truncate">{project.repoUrl.replace('https://github.com/', '')}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-[#a1a1aa]">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                              <span>{project.framework || 'Detected framework'}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between mt-auto pt-4 border-t border-[#27272a]">
                            <span className="text-xs text-[#71717a]">
                              Created {new Date(project.createdAt).toLocaleDateString()}
                            </span>
                            <a href={project.subdomain ? `https://${project.subdomain}` : '#'} target="_blank" rel="noreferrer" className="text-xs font-semibold px-3 py-1.5 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors shadow-sm">
                              Visit Site
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Import View */}
                <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
                  <div className="flex items-center gap-5">
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
                  
                  {/* Search Bar */}
                  <div className="relative w-full md:w-72">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-[#a1a1aa]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Search repositories..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-[#18181b] border border-[#27272a] text-white rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-white/50 focus:ring-1 focus:ring-white/50 transition-all placeholder-[#71717a]"
                    />
                  </div>
                </div>

                {loading ? (
                  <div className="flex flex-col items-center justify-center py-32">
                    <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mb-6 shadow-[0_0_15px_rgba(255,255,255,0.2)]" />
                    <p className="text-gray-300 font-medium animate-pulse">Syncing repositories & profile...</p>
                  </div>
                ) : (
                  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {filteredRepos.length > 0 ? (
                      filteredRepos.map((repo) => (
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
                    ))
                    ) : (
                      <div className="col-span-full py-20 flex flex-col items-center justify-center text-[#a1a1aa]">
                        <svg className="w-12 h-12 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <p className="text-lg">No repositories found matching "{searchQuery}"</p>
                      </div>
                    )}
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
        <ProjectConfigModal
          repo={selectedRepo}
          onClose={() => {
            setSelectedRepo(null);
            setDashboardView("projects");
            fetchDashboardData(); // Refresh the list of deployed projects
          }}
        />
      )}
    </div>
  );
}
