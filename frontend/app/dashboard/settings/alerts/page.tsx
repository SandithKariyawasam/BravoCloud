"use client";

import { useEffect, useState } from "react";
import { Loader2, Bell, Plus, Trash2, Mail, MessageSquare } from "lucide-react";
import BackgroundAnimation from "../../../components/BackgroundAnimation";
import Sidebar from "../../../components/Sidebar";
import { useConfirm } from "../../../components/ConfirmContext";
import { useRouter } from "next/navigation";

export default function AlertsSettingsPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const [user, setUser] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newAlertEvent, setNewAlertEvent] = useState("deployment_failed");
  const [newAlertMethod, setNewAlertMethod] = useState("email");
  const [newAlertTarget, setNewAlertTarget] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchAlerts = async (token: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      
      const userRes = await fetch(`${apiUrl}/api/user/settings`, { headers: { "Authorization": `Bearer ${token}` } });
      if (userRes.ok) {
        const data = await userRes.json();
        setUser(data.user);
        setAlerts(data.user.alerts || []);
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
    fetchAlerts(token);
  }, []);

  const handleAddAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlertTarget.trim()) return;

    setIsSaving(true);
    try {
      const token = localStorage.getItem("bravocloud_token");
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

      const res = await fetch(`${apiUrl}/api/user/alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ 
          event: newAlertEvent, 
          method: newAlertMethod, 
          target: newAlertTarget
        })
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchAlerts(token!);
      } else {
        alert("Failed to create alert");
      }
    } catch (error) {
      console.error("Failed to save alert", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAlert = async (id: string) => {
    if (!(await confirm("Are you sure you want to remove this alert?"))) return;
    try {
      const token = localStorage.getItem("bravocloud_token");
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

      const res = await fetch(`${apiUrl}/api/user/alerts/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (res.ok) {
        setAlerts(alerts.filter(a => a.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete alert", error);
    }
  };

  const getEventName = (key: string) => {
    const map: any = {
      'deployment_failed': 'Deployment Failed',
      'deployment_success': 'Deployment Succeeded',
      'agent_offline': 'Agent Offline',
      'usage_limit': 'Usage Limit Reached',
      'billing_issue': 'Billing Issue'
    };
    return map[key] || key;
  };

  if (loading || !user) {
    return (
      <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
        <Sidebar user={user} />
        <div className="flex-1 flex flex-col relative bg-black p-8">
          <BackgroundAnimation />
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
            <p className="mt-4 text-[#a1a1aa] text-sm">Loading alerts...</p>
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
                
                Alerts
              </h1>
              <p className="text-[#a1a1aa] max-w-2xl text-sm mt-1">
                Configure notifications for important events like deployment failures, agent disconnections, or usage limits.
              </p>
            </div>
            <button 
              onClick={() => { 
                setIsModalOpen(true); 
                setNewAlertTarget(user?.email || ""); 
              }}
              className="mt-4 sm:mt-0 bg-white hover:bg-gray-200 text-black px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 text-sm"
            >
              <Plus size={16} /> Create Alert
            </button>
          </div>

          <div className="space-y-6">
            
            {/* Active Alerts Table */}
            <section className="bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#121214] border-b border-[#27272a] text-[#71717a]">
                    <tr>
                      <th className="px-6 py-3 font-medium">Event</th>
                      <th className="px-6 py-3 font-medium">Delivery Method</th>
                      <th className="px-6 py-3 font-medium">Destination</th>
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#27272a]">
                    {alerts.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-[#71717a]">No alerts configured.</td>
                      </tr>
                    ) : (
                      alerts.map((alert: any) => (
                        <tr key={alert.id} className="hover:bg-[#121214] transition-colors">
                          <td className="px-6 py-4 text-white font-medium flex items-center gap-2">
                            {getEventName(alert.event)}
                          </td>
                          <td className="px-6 py-4">
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-300 w-max border border-zinc-700">
                              {alert.method === 'email' ? <Mail size={12} /> : <MessageSquare size={12} />}
                              {alert.method}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-[#a1a1aa] truncate max-w-[250px]">{alert.target}</td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => handleDeleteAlert(alert.id)}
                              className="text-red-400 hover:text-red-300 transition-colors" 
                              title="Delete Alert"
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

          </div>
        </div>
      </div>

      {/* Add Alert Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#121214] border border-[#27272a] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-[#27272a] flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Bell size={20} className="text-yellow-400" /> 
                Create Alert
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-[#a1a1aa] hover:text-white transition-colors">
                ✕
              </button>
            </div>
            
            <div className="p-6">
              <form onSubmit={handleAddAlert} className="space-y-4">
                
                <div>
                  <label className="block text-sm text-[#a1a1aa] mb-1">When this event occurs...</label>
                  <select
                    value={newAlertEvent}
                    onChange={(e) => setNewAlertEvent(e.target.value)}
                    className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all text-sm"
                  >
                    <option value="deployment_failed">Deployment Failed</option>
                    <option value="deployment_success">Deployment Succeeded</option>
                    <option value="agent_offline">Agent Disconnected</option>
                    <option value="usage_limit">Usage Limit Warning</option>
                    <option value="billing_issue">Billing Issue</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-[#a1a1aa] mb-1">Send a notification via...</label>
                  <select
                    value={newAlertMethod}
                    onChange={(e) => setNewAlertMethod(e.target.value)}
                    className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all text-sm"
                  >
                    <option value="email">Email</option>
                    <option value="slack">Slack Webhook</option>
                    <option value="discord">Discord Webhook</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-[#a1a1aa] mb-1">To this destination</label>
                  <input 
                    type={newAlertMethod === 'email' ? 'email' : 'url'} 
                    value={newAlertTarget}
                    onChange={(e) => setNewAlertTarget(e.target.value)}
                    placeholder={newAlertMethod === 'email' ? 'hello@example.com' : 'https://hooks.slack.com/services/...'}
                    className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all text-sm"
                    required
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
                    disabled={isSaving || !newAlertTarget.trim()}
                    className="bg-white hover:bg-gray-200 text-black px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : "Save Alert"}
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
