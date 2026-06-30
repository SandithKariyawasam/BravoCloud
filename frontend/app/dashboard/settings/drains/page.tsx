"use client";

import { useEffect, useState } from "react";
import { Loader2, Webhook, Plus, Trash2, ShieldAlert } from "lucide-react";
import BackgroundAnimation from "../../../components/BackgroundAnimation";
import Sidebar from "../../../components/Sidebar";
import { useConfirm } from "../../../components/ConfirmContext";

export default function DrainsSettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [drains, setDrains] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const confirm = useConfirm();

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newDrainName, setNewDrainName] = useState("");
  const [newDrainType, setNewDrainType] = useState("webhook");
  const [newDrainUrl, setNewDrainUrl] = useState("");
  const [newDrainToken, setNewDrainToken] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchDrains = async (token: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      
      const userRes = await fetch(`${apiUrl}/api/user/settings`, { headers: { "Authorization": `Bearer ${token}` } });
      if (userRes.ok) {
        const data = await userRes.json();
        setUser(data.user);
        
        // Mock drains for now until backend is implemented
        setDrains(data.user.drains || []);
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
    fetchDrains(token);
  }, []);

  const handleAddDrain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDrainName.trim() || !newDrainUrl.trim()) return;

    setIsSaving(true);
    try {
      const token = localStorage.getItem("bravocloud_token");
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

      const res = await fetch(`${apiUrl}/api/user/drains`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ 
          name: newDrainName, 
          type: newDrainType, 
          url: newDrainUrl,
          secretToken: newDrainToken 
        })
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchDrains(token!);
      } else {
        alert("Failed to add log drain");
      }
    } catch (error) {
      console.error("Failed to save drain", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDrain = async (id: string) => {
    if (!(await confirm("Are you sure you want to remove this log drain?"))) return;
    try {
      const token = localStorage.getItem("bravocloud_token");
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

      const res = await fetch(`${apiUrl}/api/user/drains/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (res.ok) {
        setDrains(drains.filter(d => d.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete drain", error);
    }
  };

  if (loading || !user) {
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
                
                Log Drains
              </h1>
              <p className="text-[#a1a1aa] max-w-2xl text-sm mt-1">
                Forward your deployment and runtime logs to third-party services like Datadog, Splunk, or custom webhooks.
              </p>
            </div>
            <button 
              onClick={() => { 
                setIsModalOpen(true); 
                setNewDrainName(""); 
                setNewDrainUrl("");
                setNewDrainToken("");
              }}
              className="mt-4 sm:mt-0 bg-white hover:bg-gray-200 text-black px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 text-sm"
            >
              <Plus size={16} /> Add Drain
            </button>
          </div>

          <div className="space-y-6">
            
            {/* Connected Drains Table */}
            <section className="bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#121214] border-b border-[#27272a] text-[#71717a]">
                    <tr>
                      <th className="px-6 py-3 font-medium">Name</th>
                      <th className="px-6 py-3 font-medium">Type</th>
                      <th className="px-6 py-3 font-medium">Endpoint</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#27272a]">
                    {drains.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-[#71717a]">No log drains configured.</td>
                      </tr>
                    ) : (
                      drains.map((drain: any) => (
                        <tr key={drain.id} className="hover:bg-[#121214] transition-colors">
                          <td className="px-6 py-4 text-white font-medium flex items-center gap-2">
                            {drain.name}
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
                              {drain.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-[#a1a1aa] truncate max-w-[200px]">{drain.url}</td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Active
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => handleDeleteDrain(drain.id)}
                              className="text-red-400 hover:text-red-300 transition-colors" 
                              title="Delete Drain"
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

            <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 flex items-start gap-3">
              <div className="mt-0.5 text-purple-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-purple-400">Secure your Webhooks</h4>
                <p className="text-xs text-[#a1a1aa] mt-1 leading-relaxed">
                  When adding a custom webhook drain, ensure you provide a Secret Token. BravoCloud will use this token in the Authorization header so you can verify that incoming requests are genuinely from us.
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Add Drain Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#121214] border border-[#27272a] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-[#27272a] flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Webhook size={20} className="text-purple-400" /> 
                Add Log Drain
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-[#a1a1aa] hover:text-white transition-colors">
                ✕
              </button>
            </div>
            
            <div className="p-6">
              <form onSubmit={handleAddDrain} className="space-y-4">
                
                <div>
                  <label className="block text-sm text-[#a1a1aa] mb-1">Destination Type</label>
                  <select
                    value={newDrainType}
                    onChange={(e) => setNewDrainType(e.target.value)}
                    className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-sm"
                  >
                    <option value="webhook">Custom Webhook</option>
                    <option value="datadog">Datadog</option>
                    <option value="logtail">Logtail</option>
                    <option value="syslog">Syslog</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-[#a1a1aa] mb-1">Drain Name</label>
                  <input 
                    type="text" 
                    value={newDrainName}
                    onChange={(e) => setNewDrainName(e.target.value)}
                    placeholder="e.g. Production Datadog"
                    className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-[#a1a1aa] mb-1">Endpoint URL</label>
                  <input 
                    type="url" 
                    value={newDrainUrl}
                    onChange={(e) => setNewDrainUrl(e.target.value)}
                    placeholder="https://api.datadoghq.com/api/v2/logs"
                    className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-[#a1a1aa] mb-1">Secret Token (Optional)</label>
                  <input 
                    type="password" 
                    value={newDrainToken}
                    onChange={(e) => setNewDrainToken(e.target.value)}
                    placeholder="Bearer token or API key"
                    className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-sm font-mono"
                  />
                </div>
                
                <div className="pt-4 flex justify-end gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-sm text-[#a1a1aa] hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving || !newDrainName.trim() || !newDrainUrl.trim()}
                    className="bg-white hover:bg-gray-200 text-black px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : "Save Drain"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
