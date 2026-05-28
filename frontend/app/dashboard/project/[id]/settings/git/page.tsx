"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { GitBranch, Save, AlertTriangle, Loader2, Info } from "lucide-react";
import BackgroundAnimation from "../../../../../components/BackgroundAnimation";
import Sidebar from "../../../../../components/Sidebar";

export default function GitSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const router = useRouter();
  
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Form State
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [availableBranches, setAvailableBranches] = useState<string[]>([]);
  const [fetchingBranches, setFetchingBranches] = useState(false);

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
          setRepoUrl(data.project.repoUrl || "");
          setBranch(data.project.branch || "main");
          sessionStorage.setItem(`bravocloud_project_${projectId}`, JSON.stringify(data.project));

          if (data.project.repoUrl) {
            setFetchingBranches(true);
            fetch(`${apiUrl}/api/projects/${projectId}/branches`, { headers: { "Authorization": `Bearer ${token}` } })
              .then(async (branchRes) => {
                if (branchRes.ok) {
                  const branchData = await branchRes.json();
                  setAvailableBranches(branchData.branches || []);
                }
                setFetchingBranches(false);
              })
              .catch(() => setFetchingBranches(false));
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [projectId]);

  const handleSave = async () => {
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
          repoUrl, branch
        })
      });

      const data = await res.json();
      if (res.ok) {
        setProject(data.project);
        sessionStorage.setItem(`bravocloud_project_${projectId}`, JSON.stringify(data.project));
        setSaveMessage("Settings saved successfully.");
        setTimeout(() => setSaveMessage(""), 3000);
      } else {
        alert(data.error || "Failed to update settings.");
      }
    } catch (err) {
      console.error(err);
      alert("Error updating settings.");
    } finally {
      setSaving(false);
    }
  };

  const extractRepoPath = (url: string) => {
    if (!url) return "No Repository Connected";
    return url.replace("https://github.com/", "").replace(".git", "");
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
        <Sidebar user={user} />
        <div className="flex-1 flex flex-col relative bg-black p-8">
          <BackgroundAnimation />
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
            <p className="mt-4 text-[#a1a1aa] text-sm">Loading settings...</p>
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
              <span className="text-white">Git</span>
            </div>
            
            <div className="flex flex-col gap-2 pb-6 border-b border-[#27272a]">
              <h1 className="text-3xl font-bold tracking-tight">Git Settings</h1>
              <p className="text-[#a1a1aa] max-w-2xl text-sm">
                Manage your connected GitHub repository and deployment branches.
              </p>
            </div>
          </div>

          {/* Connected Repo Card */}
          <div className="bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-[#27272a]">
              <h3 className="text-xl font-semibold text-white mb-1">Connected Repository</h3>
              <p className="text-[#a1a1aa] text-sm mb-6">
                BravoCloud automatically deploys commits pushed to this repository.
              </p>
              
              <div className="flex items-center justify-between p-4 bg-[#18181b] border border-[#3f3f46] rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-black rounded-full border border-[#27272a] flex items-center justify-center shadow-inner">
                    <GitBranch size={20} className="text-white" />
                  </div>
                  <div>
                    <h4 className="text-white font-medium">{extractRepoPath(repoUrl)}</h4>
                    <a href={repoUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline">
                      View on GitHub
                    </a>
                  </div>
                </div>
                <button 
                  onClick={() => setRepoUrl("")}
                  disabled={!repoUrl}
                  className="px-4 py-2 border border-[#27272a] hover:border-[#3f3f46] text-[#a1a1aa] hover:text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  Disconnect
                </button>
              </div>

              {!repoUrl && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-[#e4e4e7] mb-2">GitHub HTTPS URL</label>
                  <input 
                    type="text" 
                    value={repoUrl} 
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/username/repository.git"
                    className="w-full max-w-md bg-[#18181b] border border-[#3f3f46] text-white px-4 py-2 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Production Branch Card */}
          <div className="bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-[#27272a]">
              <h3 className="text-xl font-semibold text-white mb-1">Production Branch</h3>
              <p className="text-[#a1a1aa] text-sm mb-6">
                By default, every commit pushed to the Production Branch will trigger a new deployment to your live `.bravocloud.tech` domain.
              </p>

              <div>
                <div className="flex items-center gap-3 w-full max-w-md bg-[#18181b] border border-[#3f3f46] px-4 py-2 rounded-lg focus-within:border-blue-500 transition-colors">
                  <GitBranch size={16} className="text-[#71717a]" />
                  {fetchingBranches ? (
                    <div className="flex items-center gap-2 text-[#a1a1aa] text-sm">
                      <Loader2 size={14} className="animate-spin" />
                      Loading branches...
                    </div>
                  ) : availableBranches.length > 0 ? (
                    <select 
                      value={branch} 
                      onChange={(e) => setBranch(e.target.value)}
                      className="w-full bg-transparent text-white focus:outline-none appearance-none cursor-pointer"
                    >
                      {availableBranches.map((b) => (
                        <option key={b} value={b} className="bg-[#18181b]">{b}</option>
                      ))}
                    </select>
                  ) : (
                    <input 
                      type="text" 
                      value={branch} 
                      onChange={(e) => setBranch(e.target.value)}
                      placeholder="main"
                      className="w-full bg-transparent text-white focus:outline-none"
                    />
                  )}
                </div>
                <p className="text-xs text-[#71717a] mt-2">Commonly `main` or `master`.</p>
              </div>
            </div>
            
            <div className="bg-[#121214] p-4 flex items-center justify-between">
              <span className="text-emerald-500 text-sm font-medium">{saveMessage}</span>
              <button 
                onClick={handleSave}
                disabled={saving}
                className="bg-white text-black hover:bg-gray-200 px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
