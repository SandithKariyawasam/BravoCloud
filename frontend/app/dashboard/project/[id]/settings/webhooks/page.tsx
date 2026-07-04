"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, Webhook, Trash2, Plus, Calendar, CheckCircle2 } from "lucide-react";
import BackgroundAnimation from "../../../../../components/BackgroundAnimation";
import Sidebar from "../../../../../components/Sidebar";

export default function WebhooksSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const router = useRouter();
  
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Form State
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newSecret, setNewSecret] = useState("");
  const [newEvents, setNewEvents] = useState<string[]>(['deployment.started', 'deployment.success', 'deployment.failed']);
  const [addingMessage, setAddingMessage] = useState("");
  
  const availableEvents = [
    { id: 'deployment.started', label: 'Deployment Started' },
    { id: 'deployment.success', label: 'Deployment Success' },
    { id: 'deployment.failed', label: 'Deployment Failed' },
  ];

  useEffect(() => {
    const token = localStorage.getItem("bravocloud_token");
    if (!token) {
      window.location.href = "/";
      return;
    }

    const cachedUser = sessionStorage.getItem("bravocloud_user");
    if (cachedUser) setUser(JSON.parse(cachedUser));

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    
    // Fetch Project
    fetch(`${apiUrl}/api/projects/${projectId}`, { headers: { "Authorization": `Bearer ${token}` } })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setProject(data.project);
        }
      })
      .catch(console.error);

    // Fetch Webhooks
    fetch(`${apiUrl}/api/projects/${projectId}/webhooks`, { headers: { "Authorization": `Bearer ${token}` } })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setWebhooks(data.webhooks || []);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [projectId]);

  const handleAddWebhook = async () => {
    if (!newUrl) return alert("Webhook URL is required");
    if (newEvents.length === 0) return alert("Please select at least one event");
    
    setIsAdding(true);
    const token = localStorage.getItem("bravocloud_token");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    try {
      const res = await fetch(`${apiUrl}/api/projects/${projectId}/webhooks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          url: newUrl,
          secret: newSecret,
          events: newEvents
        })
      });

      const data = await res.json();
      if (res.ok) {
        setWebhooks([...webhooks, data.webhook]);
        setNewUrl("");
        setNewSecret("");
        setNewEvents(['deployment.started', 'deployment.success', 'deployment.failed']);
        setAddingMessage("Webhook added successfully!");
        setTimeout(() => setAddingMessage(""), 3000);
      } else {
        alert(data.error || "Failed to add webhook.");
      }
    } catch (err) {
      console.error(err);
      alert("Error adding webhook.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm("Are you sure you want to delete this webhook?")) return;
    
    const token = localStorage.getItem("bravocloud_token");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    try {
      const res = await fetch(`${apiUrl}/api/projects/${projectId}/webhooks/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setWebhooks(webhooks.filter(wh => wh.id !== id));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete webhook.");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting webhook.");
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
        <Sidebar user={user} />
        <div className="flex-1 flex flex-col relative bg-black p-8">
          <BackgroundAnimation />
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
            <p className="mt-4 text-[#a1a1aa] text-sm">Loading webhooks...</p>
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
              <span className="text-white">Webhooks</span>
            </div>
            
            <div className="flex flex-col gap-2 pb-6 border-b border-[#27272a]">
              <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Webhooks</h1>
              </div>
              <p className="text-[#a1a1aa] max-w-2xl text-sm mt-1">
                Configure HTTP endpoints that will receive push requests when specific project events occur (like deployments).
              </p>
            </div>
          </div>

          {/* Add Webhook Form */}
          <div className="bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-[#27272a]">
              <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <Plus size={20} className="text-[#71717a]" /> Add New Webhook
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#a1a1aa] mb-1">Payload URL</label>
                  <input 
                    type="url" 
                    value={newUrl} 
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://example.com/webhook"
                    className="w-full bg-[#18181b] border border-[#3f3f46] rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors font-mono"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[#a1a1aa] mb-1">Secret (Optional)</label>
                  <input 
                    type="text" 
                    value={newSecret} 
                    onChange={(e) => setNewSecret(e.target.value)}
                    placeholder="Used to generate x-bravocloud-signature HMAC SHA-256 header"
                    className="w-full bg-[#18181b] border border-[#3f3f46] rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors font-mono"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[#a1a1aa] mb-2">Events to send</label>
                  <div className="flex flex-col gap-2">
                    {availableEvents.map(evt => (
                      <label key={evt.id} className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={newEvents.includes(evt.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewEvents([...newEvents, evt.id]);
                            } else {
                              setNewEvents(newEvents.filter(e => e !== evt.id));
                            }
                          }}
                          className="w-4 h-4 rounded bg-[#18181b] border-[#3f3f46] text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-[#e4e4e7]">{evt.label} <span className="text-[#71717a] ml-1 font-mono text-xs">({evt.id})</span></span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-[#121214] p-4 flex items-center justify-between">
              <span className="text-emerald-500 text-sm font-medium flex items-center gap-2">
                {addingMessage && <CheckCircle2 size={16} />} {addingMessage}
              </span>
              <button 
                onClick={handleAddWebhook}
                disabled={isAdding}
                className="bg-white hover:bg-gray-200 text-black px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
              >
                {isAdding ? <Loader2 size={16} className="animate-spin text-black" /> : <Plus size={16} />}
                Add Webhook
              </button>
            </div>
          </div>

          {/* Active Webhooks List */}
          <div className="bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden shadow-xl mt-4">
            <div className="p-6">
              <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <Webhook size={20} className="text-[#71717a]" /> Configured Webhooks
              </h3>
              
              {webhooks.length === 0 ? (
                <div className="text-center p-8 bg-[#121214] border border-[#27272a] border-dashed rounded-lg">
                  <Webhook size={32} className="mx-auto text-[#3f3f46] mb-3" />
                  <p className="text-[#a1a1aa] font-medium">No webhooks configured</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {webhooks.map((webhook) => (
                    <div key={webhook.id} className="bg-[#18181b] border border-[#27272a] p-4 rounded-lg flex items-start justify-between gap-4">
                      <div className="flex flex-col gap-1 overflow-hidden">
                        <span className="text-white font-mono text-sm truncate">{webhook.url}</span>
                        <div className="flex gap-2 flex-wrap mt-1">
                          {webhook.events.map((evt: string) => (
                            <span key={evt} className="bg-[#27272a] text-[#a1a1aa] px-2 py-0.5 rounded text-xs font-mono">
                              {evt}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteWebhook(webhook.id)}
                        className="text-[#71717a] hover:text-red-400 transition-colors p-2 flex-shrink-0"
                        title="Delete Webhook"
                      >
                        <Trash2 size={16} />
                      </button>
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
