"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import BackgroundAnimation from "./BackgroundAnimation";
import Sidebar from "./Sidebar";

interface ProjectSelectorProps {
  title: string;
  targetRoute: string;
  icon: React.ReactNode;
}

export default function ProjectSelector({ title, targetRoute, icon }: ProjectSelectorProps) {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("bravocloud_token");
    if (!token) {
      window.location.href = "/";
      return;
    }

    let hasCache = false;
    const cachedData = localStorage.getItem("bravocloud_dashboard_cache");
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        if (parsed.projects) {
          setProjects(parsed.projects);
          if (parsed.user) setUser(parsed.user);
          setLoading(false);
          hasCache = true;
        }
      } catch (e) {}
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    
    Promise.all([
      fetch(`${apiUrl}/auth/me`, { headers: { "Authorization": `Bearer ${token}` } }),
      fetch(`${apiUrl}/api/projects`, { headers: { "Authorization": `Bearer ${token}` } })
    ])
    .then(async ([userRes, projRes]) => {
      let userObj = null;
      let projList = [];
      
      if (userRes.ok) userObj = (await userRes.json()).user;
      if (projRes.ok) projList = (await projRes.json()).projects || [];
      
      if (userObj) setUser(userObj);
      setProjects(projList);
      setLoading(false);
      
      // Update cache
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          parsed.user = userObj || parsed.user;
          parsed.projects = projList;
          localStorage.setItem("bravocloud_dashboard_cache", JSON.stringify(parsed));
        } catch(e) {}
      }
    })
    .catch((err) => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
      <Sidebar user={user} />
      
      <div className="flex-1 flex flex-col relative overflow-y-auto overflow-x-hidden bg-black p-8">
        <BackgroundAnimation />
        
        <div className="max-w-3xl mx-auto w-full relative z-10 flex flex-col items-center justify-center min-h-[70vh]">
          
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 bg-[#18181b] border border-[#27272a] rounded-xl flex items-center justify-center text-[#a1a1aa] mb-6">
              {icon}
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">Continue to {title}</h1>
            <p className="text-[#a1a1aa]">Choose a project to continue</p>
          </div>

          <div className="w-full max-w-lg">
            <div className="relative mb-6">
              <input 
                type="text" 
                placeholder="Find Project..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#121214] border border-[#27272a] rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#3f3f46] transition-colors"
              />
            </div>

            {loading ? (
              <div className="flex justify-center p-8">
                <div className="w-6 h-6 border-2 border-[#3f3f46] border-t-white rounded-full animate-spin"></div>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-center text-[#71717a] py-8">
                No projects found.
              </div>
            ) : (
              <div className="flex flex-col gap-1 max-h-[400px] overflow-y-auto custom-sidebar-scrollbar pr-2">
                {filteredProjects.map((project) => {
                  const publicUrl = project.customDomain ? `https://${project.customDomain}` : (project.subdomain ? (project.subdomain.includes(':') || project.subdomain.match(/^\d+\.\d+\.\d+\.\d+/) ? `http://${project.subdomain}` : `https://${project.subdomain}`) : null);
                  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
                  return (
                    <button 
                      key={project.id}
                      onClick={() => router.push(`/dashboard/project/${project.id}/${targetRoute}`)}
                      className="flex items-center gap-4 w-full p-3 rounded-lg hover:bg-[#18181b] transition-colors text-left border border-transparent hover:border-[#27272a] group"
                    >
                      <div className="w-8 h-8 rounded-lg overflow-hidden bg-white flex items-center justify-center border border-[#3f3f46] relative flex-shrink-0">
                        <div className="fallback-icon absolute inset-0 flex items-center justify-center bg-[#27272a] z-0">
                          {project.framework === 'nextjs' && <div className="text-xs font-bold text-white">N</div>}
                          {project.framework === 'react' && <div className="text-xs font-bold text-blue-400">R</div>}
                          {project.framework === 'vite' && <div className="text-xs font-bold text-yellow-400">V</div>}
                          {project.framework === 'html' && <div className="text-xs font-bold text-orange-500">H</div>}
                          {!['nextjs', 'react', 'vite', 'html'].includes(project.framework) && (
                            <div className="text-xs font-bold text-white flex items-center justify-center w-full h-full">
                              <Image src="/BravoCloud-logo.png" alt="BravoCloud" width={14} height={14} className="opacity-50" />
                            </div>
                          )}
                        </div>
                        {publicUrl && (
                          <img
                            src={`${apiUrl}/api/projects/proxy-favicon?url=${encodeURIComponent(publicUrl)}`}
                            className="absolute inset-0 w-full h-full object-cover z-10"
                            alt={project.name}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        )}
                      </div>
                      <span className="font-semibold text-[15px]">{project.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}
