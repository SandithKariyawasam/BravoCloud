"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Server, Plus, Terminal, Trash2, CheckCircle2, Copy, Cpu, ArrowRight } from "lucide-react";
import BackgroundAnimation from "../../../components/BackgroundAnimation";
import Sidebar from "../../../components/Sidebar";

export default function AgentSettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentOS, setNewAgentOS] = useState("Linux");
  const [newAgentArch, setNewAgentArch] = useState("x64");
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Post-generation state
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchAgents = async (token: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      
      const userRes = await fetch(`${apiUrl}/api/user/settings`, { headers: { "Authorization": `Bearer ${token}` } });
      if (userRes.ok) {
        const data = await userRes.json();
        setUser(data.user);
      }

      const agentsRes = await fetch(`${apiUrl}/api/agents`, { headers: { "Authorization": `Bearer ${token}` } });
      if (agentsRes.ok) {
        const data = await agentsRes.json();
        setAgents(data.agents || []);
      }

      const projectsRes = await fetch(`${apiUrl}/api/projects`, { headers: { "Authorization": `Bearer ${token}` } });
      if (projectsRes.ok) {
        const data = await projectsRes.json();
        setProjects(data.projects || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("bravocloud_token");
    if (!token) {
      window.location.href = "/";
      return;
    }
    
    // Initial fetch
    fetchAgents(token);

    // Poll every 5 seconds for status updates
    const interval = setInterval(() => {
      fetchAgents(token);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleGenerateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgentName.trim()) return;

    setIsGenerating(true);
    try {
      const token = localStorage.getItem("bravocloud_token");
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

      const res = await fetch(`${apiUrl}/api/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ name: newAgentName, os: newAgentOS, architecture: newAgentArch })
      });

      if (res.ok) {
        const data = await res.json();
        setGeneratedToken(data.agent.token);
        await fetchAgents(token!);
      }
    } catch (error) {
      console.error("Failed to generate agent", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteAgent = async (id: string) => {
    if (!confirm("Are you sure you want to remove this agent? It will disconnect immediately.")) return;
    try {
      const token = localStorage.getItem("bravocloud_token");
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

      const res = await fetch(`${apiUrl}/api/agents/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (res.ok) {
        setAgents(agents.filter(a => a.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete agent", error);
    }
  };


  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || !user) {
    return (
      <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
        <Sidebar user={user} />
        <div className="flex-1 flex flex-col relative bg-black p-8">
          <BackgroundAnimation />
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
            <p className="mt-4 text-[#a1a1aa] text-sm">Loading agents...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
      <Sidebar user={user} />

      <div className="flex-1 flex flex-col relative overflow-y-auto overflow-x-hidden bg-black p-8">
        <BackgroundAnimation />

        <div className="max-w-5xl mx-auto flex flex-col gap-8 relative z-10 w-full mt-4 pb-20">

          {/* Header */}
          <div className="flex flex-col gap-2 pb-6 border-b border-[#27272a] flex-wrap sm:flex-nowrap justify-between items-start sm:items-center sm:flex-row">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                <Server className="text-blue-400" size={28} />
                Self-Hosted Agents
              </h1>
              <p className="text-[#a1a1aa] max-w-2xl text-sm mt-1">
                Connect your own infrastructure to run BravoCloud deployments securely on your private network.
              </p>
            </div>
            <button 
              onClick={() => { setIsModalOpen(true); setGeneratedToken(null); setNewAgentName(""); }}
              className="mt-4 sm:mt-0 bg-white hover:bg-gray-200 text-black px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 text-sm"
            >
              <Plus size={16} /> Add Agent
            </button>
          </div>

          <div className="space-y-6">
            
            {/* Connected Agents Table */}
            <section className="bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#121214] border-b border-[#27272a] text-[#71717a]">
                    <tr>
                      <th className="px-6 py-3 font-medium">Agent Name</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium">OS / Arch</th>
                      <th className="px-6 py-3 font-medium">Last Seen</th>
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#27272a]">
                    {agents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-[#71717a]">No self-hosted agents connected.</td>
                      </tr>
                    ) : (
                      agents.map((agent: any) => (
                        <tr key={agent.id} className="hover:bg-[#121214] transition-colors">
                          <td className="px-6 py-4 text-white font-medium flex items-center gap-2">
                            <Server size={14} className="text-[#a1a1aa]" /> {agent.name}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${agent.status === 'Online' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'}`}>
                              {agent.status || 'Offline'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-[#a1a1aa]">{agent.os} ({agent.architecture})</td>
                          <td className="px-6 py-4 text-[#71717a]">
                            {agent.lastSeen ? new Date(agent.lastSeen).toLocaleString() : 'Never'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => handleDeleteAgent(agent.id)}
                              className="text-red-400 hover:text-red-300 transition-colors" 
                              title="Delete Agent"
                            >
                              <Trash2 size={16} className="inline" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
              <div className="mt-0.5 text-blue-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-blue-400">Disconnected Server?</h4>
                <p className="text-xs text-[#a1a1aa] mt-1 leading-relaxed">
                  If your server accidentally disconnects (e.g. your computer restarts or you close the terminal), simply re-run the same installation script you used to register it. If you lost your original installation command, delete the disconnected agent from the list above and click <strong className="text-[#e4e4e7]">Add Agent</strong> to register a new one.
                </p>
              </div>
            </div>

            {/* Project Routing Section */}
            <div className="mt-8">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Cpu className="text-emerald-500" size={20} />
                Project Build Routing
              </h2>
              <p className="text-[#a1a1aa] text-sm mb-6">
                Select a project below to configure whether it builds on BravoCloud infrastructure or your self-hosted agents.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.length === 0 ? (
                  <div className="col-span-full text-center p-8 border border-[#27272a] border-dashed rounded-xl text-[#71717a] text-sm">
                    No projects found. Create a project first to configure routing.
                  </div>
                ) : (
                  projects.map((proj: any) => (
                    <div 
                      key={proj.id}
                      onClick={() => router.push(`/dashboard/project/${proj.id}/agent`)}
                      className="bg-[#09090b] border border-[#27272a] hover:border-[#3f3f46] hover:bg-[#121214] rounded-xl p-5 cursor-pointer transition-all group flex flex-col justify-between h-full min-h-[120px]"
                    >
                      <div>
                        <h3 className="text-white font-semibold mb-1 group-hover:text-emerald-400 transition-colors">{proj.name}</h3>
                        <p className="text-xs text-[#71717a]">
                          {proj.agentId ? "Routed to: Self-Hosted Agent" : "Routed to: AWS CodeBuild (Default)"}
                        </p>
                      </div>
                      <div className="flex items-center text-xs font-medium text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity mt-4">
                        Configure Routing <ArrowRight size={14} className="ml-1" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Add Agent Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#121214] border border-[#27272a] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-[#27272a] flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Terminal size={20} className="text-blue-400" /> 
                {generatedToken ? "Agent Generated" : "Register New Agent"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-[#a1a1aa] hover:text-white transition-colors">
                ✕
              </button>
            </div>
            
            <div className="p-6">
              {!generatedToken ? (
                <form onSubmit={handleGenerateToken} className="space-y-4">
                  <div>
                    <label className="block text-sm text-[#a1a1aa] mb-1">Agent Name</label>
                    <input 
                      type="text" 
                      required
                      value={newAgentName}
                      onChange={e => setNewAgentName(e.target.value)}
                      placeholder="e.g. prod-worker-01"
                      className="w-full bg-black border border-[#27272a] rounded-lg px-3 py-2 text-white focus:border-white outline-none transition-colors"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-[#a1a1aa] mb-1">Operating System</label>
                      <select 
                        value={newAgentOS}
                        onChange={e => setNewAgentOS(e.target.value)}
                        className="w-full bg-black border border-[#27272a] rounded-lg px-3 py-2 text-white focus:border-white outline-none transition-colors appearance-none"
                      >
                        <option>Linux</option>
                        <option>macOS</option>
                        <option>Windows</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-[#a1a1aa] mb-1">Architecture</label>
                      <select 
                        value={newAgentArch}
                        onChange={e => setNewAgentArch(e.target.value)}
                        className="w-full bg-black border border-[#27272a] rounded-lg px-3 py-2 text-white focus:border-white outline-none transition-colors appearance-none"
                      >
                        <option>x64</option>
                        <option>arm64</option>
                      </select>
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    disabled={isGenerating || !newAgentName.trim()}
                    className="w-full mt-4 bg-white hover:bg-gray-200 text-black py-2.5 rounded-lg font-semibold transition-colors flex items-center justify-center disabled:opacity-50"
                  >
                    {isGenerating ? <Loader2 size={18} className="animate-spin" /> : 'Generate Token'}
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-[#a1a1aa]">
                    Your agent has been registered. Run the following command on your server to connect it to BravoCloud.
                  </p>
                  
                  <div className="bg-black border border-[#27272a] rounded-lg p-4 relative group">
                    <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-all">
                      {newAgentOS === 'Windows' 
                        ? `Invoke-WebRequest -Uri "${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/agents/install.ps1?token=${generatedToken}" -OutFile "install.ps1"; .\\install.ps1`
                        : `curl -sSL "${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/agents/install-agent.sh?token=${generatedToken}" | bash`
                      }
                    </pre>
                    <button 
                      onClick={() => copyToClipboard(
                        newAgentOS === 'Windows'
                          ? `Invoke-WebRequest -Uri "${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/agents/install.ps1?token=${generatedToken}" -OutFile "install.ps1"; .\\install.ps1`
                          : `curl -sSL "${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/agents/install-agent.sh?token=${generatedToken}" | bash`
                      )}
                      className="absolute top-2 right-2 p-1.5 bg-[#27272a] rounded text-[#a1a1aa] hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                    >
                      {copied ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>

                  <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                    <p className="text-xs text-orange-400 flex items-center gap-2 font-medium">
                      ⚠️ Make sure to copy this token now. You won't be able to see it again!
                    </p>
                  </div>

                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="w-full mt-4 bg-[#27272a] hover:bg-[#3f3f46] text-white py-2.5 rounded-lg font-semibold transition-colors"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
