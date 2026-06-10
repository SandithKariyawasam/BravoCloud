"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Globe2, AlertCircle, CheckCircle2, Copy } from "lucide-react";
import BackgroundAnimation from "../../../../components/BackgroundAnimation";
import Sidebar from "../../../../components/Sidebar";

export default function ProjectDomainsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const router = useRouter();
  
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  const [domains, setDomains] = useState<any[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("bravocloud_token");
    if (!token) {
      window.location.href = "/";
      return;
    }

    const cachedUser = sessionStorage.getItem("bravocloud_user");
    const cachedProject = sessionStorage.getItem(`bravocloud_project_${projectId}`);
    
    if (cachedUser && cachedProject) {
      setUser(JSON.parse(cachedUser));
      const proj = JSON.parse(cachedProject);
      setProject(proj);
      setDomains(proj.domains || []);
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
        setDomains(projData.domains || []);
        sessionStorage.setItem(`bravocloud_project_${projectId}`, JSON.stringify(projData));
      }
      setLoading(false);
    })
    .catch((err) => {
      console.error(err);
      setLoading(false);
    });
  }, [projectId]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleAddDomain = async () => {
    if (!newDomain.trim() || adding) return;
    setAdding(true);
    
    const token = localStorage.getItem("bravocloud_token");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    try {
      const res = await fetch(`${apiUrl}/api/projects/${projectId}/domains`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ domain: newDomain.trim().toLowerCase() })
      });

      const data = await res.json();
      if (res.ok) {
        setDomains(data.domains);
        setNewDomain("");
        if (project) {
          const updatedProject = { ...project, domains: data.domains };
          setProject(updatedProject);
          sessionStorage.setItem(`bravocloud_project_${projectId}`, JSON.stringify(updatedProject));
        }
      } else {
        alert(data.error || "Failed to add domain.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while adding the domain.");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteDomain = async (domainString: string) => {
    if (!confirm(`Are you sure you want to remove ${domainString}?`)) return;
    
    const token = localStorage.getItem("bravocloud_token");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    try {
      const res = await fetch(`${apiUrl}/api/projects/${projectId}/domains/${domainString}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      if (res.ok) {
        setDomains(data.domains);
        if (project) {
          const updatedProject = { ...project, domains: data.domains };
          setProject(updatedProject);
          sessionStorage.setItem(`bravocloud_project_${projectId}`, JSON.stringify(updatedProject));
        }
      } else {
        alert(data.error || "Failed to remove domain.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while removing the domain.");
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
            <p className="mt-4 text-[#a1a1aa] text-sm">Loading domains...</p>
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

        <div className="max-w-6xl mx-auto flex flex-col gap-6 relative z-10 w-full mt-4">
          {/* Header */}
          <div className="mb-2">
            <div className="flex items-center gap-2 text-sm text-[#71717a] font-medium mb-6">
              <button onClick={() => router.push('/dashboard')} className="hover:text-white transition-colors">Dashboard</button>
              <span>/</span>
              <button onClick={() => router.push(`/dashboard/project/${project.id}`)} className="hover:text-white transition-colors">{project.name}</button>
              <span>/</span>
              <span className="text-white">Domains</span>
            </div>
            
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-[#27272a]">
              <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Domains</h1>
                <p className="text-[#a1a1aa] max-w-2xl text-sm">
                  Manage custom domains and SSL certificates for {project.name}.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden shadow-2xl">
            {/* Add New Domain Form */}
            <div className="p-6 border-b border-[#27272a] bg-[#121214]">
              <h3 className="text-lg font-semibold mb-4">Add Custom Domain</h3>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-[2]">
                  <div className="flex gap-4">
                    <input 
                      type="text" 
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                      placeholder="e.g. www.myawesomeapp.com" 
                      className="w-full bg-[#18181b] border border-[#27272a] rounded-md px-4 py-2 text-sm text-white focus:outline-none focus:border-[#3f3f46] font-mono"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddDomain(); }}
                    />
                    <button 
                      onClick={handleAddDomain}
                      disabled={adding}
                      className="bg-white text-black px-6 py-2 rounded-md font-semibold hover:bg-gray-200 transition-colors flex items-center justify-center disabled:opacity-50"
                    >
                      {adding ? "Provisioning SSL..." : "Add"}
                    </button>
                  </div>
                  <p className="text-xs text-[#71717a] mt-2">
                    BravoCloud will automatically provision a free SSL certificate for this domain via AWS ACM. This may take up to 30 seconds.
                  </p>
                </div>
              </div>
            </div>

            {/* List of Domains */}
            <div>
              {domains.length === 0 ? (
                <div className="p-12 text-center text-[#71717a] flex flex-col items-center">
                  <Globe2 size={48} className="mb-4 opacity-50" />
                  <p>No custom domains configured for this project.</p>
                  <p className="text-xs mt-2">Your app is currently accessible via the default BravoCloud deployment URL.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#27272a]">
                  {domains.map((d: any, index: number) => (
                    <div key={index} className="p-6 hover:bg-[#121214] transition-colors group">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <h4 className="font-bold text-lg">{d.domain}</h4>
                          <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1">
                            <AlertCircle size={12} />
                            {d.status || 'Pending Verification'}
                          </span>
                        </div>
                        <button 
                          onClick={() => handleDeleteDomain(d.domain)}
                          className="text-[#71717a] hover:text-red-500 transition-colors bg-[#18181b] border border-[#27272a] p-2 rounded-md"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                        {/* Traffic Routing DNS */}
                        <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-4">
                          <h5 className="text-sm font-semibold mb-3 text-[#e4e4e7]">1. Traffic Routing (CNAME)</h5>
                          <p className="text-xs text-[#a1a1aa] mb-4">Add this record to your DNS provider to route traffic to BravoCloud.</p>
                          
                          <div className="grid grid-cols-[80px_1fr] gap-2 mb-2">
                            <div className="text-xs font-semibold text-[#71717a] uppercase">Type</div>
                            <div className="text-xs font-mono text-white">CNAME</div>
                          </div>
                          <div className="grid grid-cols-[80px_1fr] gap-2 mb-2">
                            <div className="text-xs font-semibold text-[#71717a] uppercase">Name</div>
                            <div className="text-xs font-mono text-white break-all">{d.domain.startsWith('www.') ? 'www' : '@'}</div>
                          </div>
                          <div className="grid grid-cols-[80px_1fr] gap-2">
                            <div className="text-xs font-semibold text-[#71717a] uppercase flex items-center">Value</div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-white break-all">{d.albDns}</span>
                              <button onClick={() => copyToClipboard(d.albDns, `alb-${index}`)} className="text-[#71717a] hover:text-white transition-colors">
                                {copied === `alb-${index}` ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} />}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* SSL Validation DNS */}
                        <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-4">
                          <h5 className="text-sm font-semibold mb-3 text-[#e4e4e7]">2. SSL Certificate (CNAME)</h5>
                          <p className="text-xs text-[#a1a1aa] mb-4">Add this record to prove ownership and activate the AWS SSL certificate.</p>
                          
                          <div className="grid grid-cols-[80px_1fr] gap-2 mb-2">
                            <div className="text-xs font-semibold text-[#71717a] uppercase">Type</div>
                            <div className="text-xs font-mono text-white">CNAME</div>
                          </div>
                          <div className="grid grid-cols-[80px_1fr] gap-2 mb-2">
                            <div className="text-xs font-semibold text-[#71717a] uppercase">Name</div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-white break-all">{d.cnameName}</span>
                              <button onClick={() => copyToClipboard(d.cnameName, `name-${index}`)} className="text-[#71717a] hover:text-white transition-colors">
                                {copied === `name-${index}` ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} />}
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-[80px_1fr] gap-2">
                            <div className="text-xs font-semibold text-[#71717a] uppercase flex items-center">Value</div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-white break-all">{d.cnameValue}</span>
                              <button onClick={() => copyToClipboard(d.cnameValue, `val-${index}`)} className="text-[#71717a] hover:text-white transition-colors">
                                {copied === `val-${index}` ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} />}
                              </button>
                            </div>
                          </div>
                        </div>
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
