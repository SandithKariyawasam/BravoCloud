"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, Zap, Server, Code, Search, CheckCircle2 } from "lucide-react";
import BackgroundAnimation from "../../../../../components/BackgroundAnimation";
import Sidebar from "../../../../../components/Sidebar";

export default function ServerlessSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const router = useRouter();
  
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Form State
  const [serverlessFunctions, setServerlessFunctions] = useState<any[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("bravocloud_token");
    if (!token) {
      window.location.href = "/";
      return;
    }

    const cachedUser = sessionStorage.getItem("bravocloud_user");
    if (cachedUser) setUser(JSON.parse(cachedUser));

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    
    fetch(`${apiUrl}/api/projects/${projectId}`, { headers: { "Authorization": `Bearer ${token}` } })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setProject(data.project);
          setServerlessFunctions(data.project.serverlessFunctions || []);
          sessionStorage.setItem(`bravocloud_project_${projectId}`, JSON.stringify(data.project));
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [projectId]);

  const handleAutoDetect = async () => {
    if (!project?.repoUrl) {
      alert("Please connect a GitHub repository in Git Settings first.");
      return;
    }

    setDetecting(true);
    const token = localStorage.getItem("bravocloud_token");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    try {
      const res = await fetch(`${apiUrl}/api/projects/${projectId}/detect-functions`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (res.ok) {
        if (data.functions && data.functions.length > 0) {
          // Merge with existing, avoiding duplicates by name
          const existingNames = serverlessFunctions.map(f => f.name);
          const newFunctions = data.functions.filter((f: any) => !existingNames.includes(f.name));
          setServerlessFunctions([...serverlessFunctions, ...newFunctions]);
        } else {
          alert("No serverless functions found in the /api directory.");
        }
      } else {
        alert(data.error || "Failed to detect functions.");
      }
    } catch (err) {
      console.error(err);
      alert("Error detecting functions.");
    } finally {
      setDetecting(false);
    }
  };

  const handleProvision = async () => {
    setSaving(true);
    setSaveMessage("");
    const token = localStorage.getItem("bravocloud_token");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    try {
      const res = await fetch(`${apiUrl}/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          serverlessFunctions
        })
      });

      const data = await res.json();
      if (res.ok) {
        setProject(data.project);
        sessionStorage.setItem(`bravocloud_project_${projectId}`, JSON.stringify(data.project));
        setSaveMessage("Successfully provisioned AWS Lambda & API Gateway resources!");
        setTimeout(() => setSaveMessage(""), 5000);
      } else {
        alert(data.error || "Failed to provision resources.");
      }
    } catch (err) {
      console.error(err);
      alert("Error provisioning resources.");
    } finally {
      setSaving(false);
    }
  };

  const updateFunctionMemory = (index: number, memory: number) => {
    const newFuncs = [...serverlessFunctions];
    newFuncs[index].memory = memory;
    setServerlessFunctions(newFuncs);
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
        <Sidebar user={user} />
        <div className="flex-1 flex flex-col relative bg-black p-8">
          <BackgroundAnimation />
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
            <p className="mt-4 text-[#a1a1aa] text-sm">Loading serverless config...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
      <Sidebar user={user} />
      
      <div className="flex-1 flex flex-col relative overflow-y-auto overflow-x-hidden bg-black p-8">
        <BackgroundAnimation />

        <div className="max-w-4xl mx-auto flex flex-col gap-6 relative z-10 w-full mt-4">
          {/* Header */}
          <div className="mb-2">
            <div className="flex items-center gap-2 text-sm text-[#71717a] font-medium mb-6">
              <button onClick={() => router.push('/dashboard')} className="hover:text-white transition-colors">Dashboard</button>
              <span>/</span>
              <button onClick={() => router.push(`/dashboard/project/${project.id}`)} className="hover:text-white transition-colors">{project.name}</button>
              <span>/</span>
              <button onClick={() => router.push(`/dashboard/project/${project.id}/settings`)} className="hover:text-white transition-colors">Settings</button>
              <span>/</span>
              <span className="text-white">Serverless</span>
            </div>
            
            <div className="flex flex-col gap-2 pb-6 border-b border-[#27272a]">
              <h1 className="text-3xl font-bold tracking-tight">Serverless Functions</h1>
              <p className="text-[#a1a1aa] max-w-2xl text-sm">
                Automatically detect API routes in your repository and deploy them as highly-scalable AWS Lambda functions behind API Gateway.
              </p>
            </div>
          </div>

          {/* Auto-Detect Card */}
          <div className="bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-[#27272a]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Search size={20} className="text-[#71717a]" /> Discover Functions
                </h3>
                <button 
                  onClick={handleAutoDetect}
                  disabled={detecting}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
                >
                  {detecting ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                  {detecting ? "Scanning Repo..." : "Auto-Detect Functions"}
                </button>
              </div>
              <p className="text-[#a1a1aa] text-sm">
                BravoCloud can scan your connected GitHub repository's <code className="bg-[#18181b] px-1.5 py-0.5 rounded text-white">/api</code> directory and automatically register your serverless handlers.
              </p>
            </div>
          </div>

          {/* Functions List */}
          <div className="bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-[#27272a]">
              <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <Zap size={20} className="text-[#71717a]" /> Deployed Functions
              </h3>
              
              {serverlessFunctions.length === 0 ? (
                <div className="text-center p-8 bg-[#121214] border border-[#27272a] border-dashed rounded-lg">
                  <Server size={32} className="mx-auto text-[#3f3f46] mb-3" />
                  <p className="text-[#a1a1aa] font-medium">No functions configured</p>
                  <p className="text-[#71717a] text-sm mt-1">Click Auto-Detect to scan your repository.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {serverlessFunctions.map((func, index) => (
                    <div key={func.id} className="bg-[#18181b] border border-[#27272a] p-4 rounded-lg flex items-center justify-between group">
                      <div className="flex items-start gap-4">
                        <div className="mt-1 bg-[#27272a] p-2 rounded-lg">
                          <Code size={16} className="text-blue-400" />
                        </div>
                        <div>
                          <h4 className="text-white font-medium flex items-center gap-2">
                            {func.name}
                            <span className="text-[10px] uppercase tracking-wider bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full font-bold">
                              Node.js
                            </span>
                          </h4>
                          <p className="text-[#71717a] text-xs font-mono mt-1">Handler: {func.handler}</p>
                          <p className="text-blue-400/70 text-xs font-mono mt-1">Route: https://{project.name}.bravocloud.tech/api/{func.name}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <label className="block text-xs font-medium text-[#71717a] mb-1">Memory (MB)</label>
                          <select 
                            value={func.memory} 
                            onChange={(e) => updateFunctionMemory(index, parseInt(e.target.value))}
                            className="bg-[#09090b] border border-[#3f3f46] text-white text-xs px-2 py-1 rounded focus:outline-none appearance-none cursor-pointer"
                          >
                            <option value={128}>128 MB</option>
                            <option value={256}>256 MB</option>
                            <option value={512}>512 MB</option>
                            <option value={1024}>1024 MB</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="bg-[#121214] p-4 flex items-center justify-between">
              <span className="text-emerald-500 text-sm font-medium flex items-center gap-2">
                {saveMessage && <CheckCircle2 size={16} />} {saveMessage}
              </span>
              <button 
                onClick={handleProvision}
                disabled={saving || serverlessFunctions.length === 0}
                className="bg-white text-black hover:bg-gray-200 disabled:opacity-50 px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? "Provisioning AWS Resources..." : "Provision AWS Resources"}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
