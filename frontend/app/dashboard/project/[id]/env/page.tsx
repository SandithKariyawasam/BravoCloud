"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Eye, EyeOff, Save, AlertTriangle, Variable } from "lucide-react";
import BackgroundAnimation from "../../../../components/BackgroundAnimation";
import Sidebar from "../../../../components/Sidebar";

export default function ProjectEnvPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const router = useRouter();
  
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  
  const [saving, setSaving] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    const token = localStorage.getItem("bravocloud_token");
    if (!token) {
      window.location.href = "/";
      return;
    }

    // Instantly load from sessionStorage cache if available
    const cachedUser = sessionStorage.getItem("bravocloud_user");
    const cachedProject = sessionStorage.getItem(`bravocloud_project_${projectId}`);
    
    if (cachedUser && cachedProject) {
      setUser(JSON.parse(cachedUser));
      const proj = JSON.parse(cachedProject);
      setProject(proj);
      setEnvVars(proj.envVars || {});
      setLoading(false);
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    
    Promise.all([
      fetch(`${apiUrl}/auth/me`, { headers: { "Authorization": `Bearer ${token}` } }),
      fetch(`${apiUrl}/api/projects/${projectId}`, { headers: { "Authorization": `Bearer ${token}` } })
    ])
    .then(async ([userRes, projRes]) => {
      if (userRes.ok) {
        const userData = (await userRes.json()).user;
        setUser(userData);
        sessionStorage.setItem("bravocloud_user", JSON.stringify(userData));
      }
      if (projRes.ok) {
        const projData = (await projRes.json()).project;
        setProject(projData);
        setEnvVars(projData.envVars || {});
        sessionStorage.setItem(`bravocloud_project_${projectId}`, JSON.stringify(projData));
      }
      setLoading(false);
    })
    .catch((err) => {
      console.error(err);
      setLoading(false);
    });
  }, [projectId]);

  const toggleVisibility = (key: string) => {
    const newVisible = new Set(visibleKeys);
    if (newVisible.has(key)) newVisible.delete(key);
    else newVisible.add(key);
    setVisibleKeys(newVisible);
  };

  const handleAddVar = () => {
    if (!newKey.trim()) return;
    setEnvVars(prev => ({
      ...prev,
      [newKey.trim()]: newValue.trim()
    }));
    setNewKey("");
    setNewValue("");
  };

  const handleDeleteVar = (key: string) => {
    setEnvVars(prev => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  const handleSave = async () => {
    let finalEnvVars = { ...envVars };
    
    // Automatically add pending input if user forgot to click Plus
    if (newKey.trim()) {
      finalEnvVars[newKey.trim()] = newValue.trim();
      setEnvVars(finalEnvVars);
      setNewKey("");
      setNewValue("");
    }

    setSaving(true);
    const token = localStorage.getItem("bravocloud_token");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    try {
      const res = await fetch(`${apiUrl}/api/projects/${projectId}/env`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ envVars: finalEnvVars })
      });

      if (res.ok) {
        // Update local session storage cache with the new project data
        if (project) {
          const updatedProject = { ...project, envVars: finalEnvVars };
          setProject(updatedProject);
          sessionStorage.setItem(`bravocloud_project_${projectId}`, JSON.stringify(updatedProject));
        }
        alert("Environment variables saved successfully.");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to save environment variables");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
        <Sidebar user={user} />
        <div className="flex-1 flex flex-col relative bg-black p-8">
          <BackgroundAnimation />
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center">
            <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
            <p className="mt-4 text-[#a1a1aa] text-sm">Loading environment variables...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
        <Sidebar user={user} />
        <div className="flex-1 flex flex-col relative bg-black p-8 items-center justify-center">
          <BackgroundAnimation />
          <h2 className="text-xl font-bold relative z-10">Project not found</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
      <Sidebar user={user} />
      
      <div className="flex-1 flex flex-col relative overflow-y-auto overflow-x-hidden bg-black p-8">
        <BackgroundAnimation />

        <div className="max-w-6xl mx-auto flex flex-col gap-6 relative z-10 w-full mt-4">
          {/* Header */}
          <div className="mb-2">
            <div className="flex items-center gap-2 text-sm text-[#71717a] font-medium mb-6">
              <button onClick={() => router.push('/dashboard')} className="hover:text-white transition-colors">Dashboard</button>
              <span>/</span>
              <button onClick={() => router.push(`/dashboard/project/${project.id}`)} className="hover:text-white transition-colors">{project.name}</button>
              <span>/</span>
              <span className="text-white">Environment Variables</span>
            </div>
            
            
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-[#27272a]">
              <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Environment Variables</h1>
                <p className="text-[#a1a1aa] max-w-2xl text-sm">
                  Manage environment variables for {project.name}.
                </p>
              </div>
              <button 
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-md text-sm font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                <Save size={16} />
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>

          {/* Warning Alert */}
          <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-6 mb-2 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)]">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-orange-500/5 z-0" />
            <div className="relative z-10">
              <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <AlertTriangle className="text-amber-400" size={20} />
                Deployment Required
              </h2>
              <p className="text-sm text-[#a1a1aa] max-w-2xl">
                Changes to your environment variables will only take effect in your live application after a new deployment is triggered.
              </p>
            </div>
          </div>

          <div className="bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden shadow-2xl">
            {/* Add New Variable Form */}
            <div className="p-6 border-b border-[#27272a] bg-[#121214]">
              <h3 className="text-lg font-semibold mb-4">Add New Variable</h3>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider mb-2">Key</label>
                  <input 
                    type="text" 
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder="e.g. DATABASE_URL" 
                    className="w-full bg-[#18181b] border border-[#27272a] rounded-md px-4 py-2 text-sm text-white focus:outline-none focus:border-[#3f3f46] font-mono"
                  />
                </div>
                <div className="flex-[2]">
                  <label className="block text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider mb-2">Value</label>
                  <div className="flex gap-4">
                    <input 
                      type="text" 
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      placeholder="e.g. postgresql://user:password@host/db" 
                      className="w-full bg-[#18181b] border border-[#27272a] rounded-md px-4 py-2 text-sm text-white focus:outline-none focus:border-[#3f3f46] font-mono"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddVar(); }}
                    />
                    <button 
                      onClick={handleAddVar}
                      className="bg-white text-black px-4 py-2 rounded-md font-semibold hover:bg-gray-200 transition-colors flex items-center justify-center"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* List of Variables */}
            <div>
              <div className="grid grid-cols-12 gap-4 p-4 border-b border-[#27272a] bg-[#18181b] text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider">
                <div className="col-span-4">Key</div>
                <div className="col-span-6">Value</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>

              {Object.keys(envVars).length === 0 ? (
                <div className="p-12 text-center text-[#71717a] flex flex-col items-center">
                  <Variable size={48} className="mb-4 opacity-50" />
                  <p>No environment variables configured for this project.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#27272a]">
                  {Object.entries(envVars).map(([key, value]) => (
                    <div key={key} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-[#121214] transition-colors group">
                      <div className="col-span-4 font-mono text-sm break-all text-[#e4e4e7]">{key}</div>
                      <div className="col-span-6 flex items-center gap-3">
                        <div className="font-mono text-sm bg-[#18181b] border border-[#27272a] px-3 py-1.5 rounded flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                          {visibleKeys.has(key) ? value : "••••••••••••••••••••••••"}
                        </div>
                        <button 
                          onClick={() => toggleVisibility(key)}
                          className="text-[#71717a] hover:text-white transition-colors"
                        >
                          {visibleKeys.has(key) ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <button 
                          onClick={() => handleDeleteVar(key)}
                          className="text-[#71717a] hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-2"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
