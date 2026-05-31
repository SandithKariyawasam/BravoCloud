"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, Power, PauseCircle, Send, AlertTriangle, CheckCircle2, Activity, Database, Webhook } from "lucide-react";
import BackgroundAnimation from "../../../../../components/BackgroundAnimation";
import Sidebar from "../../../../../components/Sidebar";

export default function AdvancedSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const router = useRouter();
  
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Form State
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [transferEmail, setTransferEmail] = useState("");
  
  const [autoScalingEnabled, setAutoScalingEnabled] = useState(false);
  const [minContainers, setMinContainers] = useState(1);
  const [maxContainers, setMaxContainers] = useState(5);
  const [targetCpu, setTargetCpu] = useState(75);
  
  const [logDrainWebhook, setLogDrainWebhook] = useState("");

  const [saving, setSaving] = useState<{ [key: string]: boolean }>({});
  const [saveMessage, setSaveMessage] = useState<{ [key: string]: string }>({});

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
          
          setMaintenanceMode(data.project.maintenanceMode || false);
          setIsPaused(data.project.isPaused || false);
          setOwnerEmail(data.project.ownerEmail || JSON.parse(cachedUser || '{}')?.email || "");
          
          if (data.project.autoScaling) {
            setAutoScalingEnabled(data.project.autoScaling.enabled || false);
            setMinContainers(data.project.autoScaling.minContainers || 1);
            setMaxContainers(data.project.autoScaling.maxContainers || 5);
            setTargetCpu(data.project.autoScaling.targetCpu || 75);
          }
          
          if (data.project.logDrain) {
            setLogDrainWebhook(data.project.logDrain.webhookUrl || "");
          }
          
          sessionStorage.setItem(`bravocloud_project_${projectId}`, JSON.stringify(data.project));
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [projectId]);

  const handleUpdate = async (field: string, value: any, actionName: string) => {
    setSaving({ ...saving, [actionName]: true });
    setSaveMessage({ ...saveMessage, [actionName]: "" });
    const token = localStorage.getItem("bravocloud_token");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    try {
      const res = await fetch(`${apiUrl}/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ [field]: value })
      });

      const data = await res.json();
      if (res.ok) {
        setProject(data.project);
        sessionStorage.setItem(`bravocloud_project_${projectId}`, JSON.stringify(data.project));
        setSaveMessage({ ...saveMessage, [actionName]: "Update successful!" });
        setTimeout(() => setSaveMessage({ ...saveMessage, [actionName]: "" }), 3000);
      } else {
        alert(data.error || "Failed to update project.");
      }
    } catch (err) {
      console.error(err);
      alert("Error updating project.");
    } finally {
      setSaving({ ...saving, [actionName]: false });
    }
  };

  const toggleMaintenance = () => {
    const newValue = !maintenanceMode;
    setMaintenanceMode(newValue);
    handleUpdate('maintenanceMode', newValue, 'maintenance');
  };

  const togglePause = () => {
    const newValue = !isPaused;
    setIsPaused(newValue);
    handleUpdate('isPaused', newValue, 'pause');
  };

  const handleTransfer = () => {
    if (!transferEmail || !transferEmail.includes("@")) {
      alert("Please enter a valid email address.");
      return;
    }
    const confirmTransfer = confirm(`Are you sure you want to transfer ownership of ${project?.name} to ${transferEmail}? You will lose access to this project.`);
    if (confirmTransfer) {
      handleUpdate('ownerEmail', transferEmail, 'transfer').then(() => {
        alert("Project transferred successfully.");
        router.push('/dashboard');
      });
    }
  };

  const saveAutoScaling = () => {
    handleUpdate('autoScaling', { enabled: autoScalingEnabled, minContainers, maxContainers, targetCpu }, 'autoScaling');
  };

  const saveLogDrain = () => {
    handleUpdate('logDrain', { webhookUrl: logDrainWebhook }, 'logDrain');
  };

  const triggerSnapshot = async () => {
    setSaving({ ...saving, snapshot: true });
    setSaveMessage({ ...saveMessage, snapshot: "" });
    const token = localStorage.getItem("bravocloud_token");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    try {
      const res = await fetch(`${apiUrl}/api/projects/${projectId}/snapshot`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setSaveMessage({ ...saveMessage, snapshot: "Snapshot initiated!" });
        setTimeout(() => setSaveMessage({ ...saveMessage, snapshot: "" }), 5000);
      } else {
        alert(data.error || "Failed to trigger snapshot.");
      }
    } catch (err) {
      console.error(err);
      alert("Error triggering snapshot.");
    } finally {
      setSaving({ ...saving, snapshot: false });
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
            <p className="mt-4 text-[#a1a1aa] text-sm">Loading advanced settings...</p>
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

        <div className="max-w-4xl mx-auto flex flex-col gap-6 relative z-10 w-full mt-4 pb-20">
          {/* Header */}
          <div className="mb-2">
            <div className="flex items-center gap-2 text-sm text-[#71717a] font-medium mb-6">
              <button onClick={() => router.push('/dashboard')} className="hover:text-white transition-colors">Dashboard</button>
              <span>/</span>
              <button onClick={() => router.push(`/dashboard/project/${project.id}`)} className="hover:text-white transition-colors">{project.name}</button>
              <span>/</span>
              <button onClick={() => router.push(`/dashboard/project/${project.id}/settings`)} className="hover:text-white transition-colors">Settings</button>
              <span>/</span>
              <span className="text-white">Advanced</span>
            </div>
            
            <div className="flex flex-col gap-2 pb-6 border-b border-[#27272a]">
              <h1 className="text-3xl font-bold tracking-tight">Advanced Settings</h1>
              <p className="text-[#a1a1aa] max-w-2xl text-sm mt-1">
                Sophisticated operations for platform engineers. Control global traffic routing, manage compute states, configure auto-scaling, and handle databases.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            
            {/* Auto-Scaling */}
            <div className={`bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden shadow-lg transition-colors ${autoScalingEnabled ? 'border-purple-500/50' : ''}`}>
              <div className="p-6 border-b border-[#27272a] flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Activity size={18} className="text-purple-400" /> Application Auto-Scaling
                  </h3>
                  <p className="text-[#a1a1aa] text-sm mt-1 max-w-lg">
                    Automatically scale your AWS ECS Fargate containers up and down based on Average CPU Utilization. This ensures your app stays online during traffic spikes and saves money during downtime.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={autoScalingEnabled}
                    onChange={(e) => setAutoScalingEnabled(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-[#27272a] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {autoScalingEnabled && (
                <div className="p-6 bg-[#121214] flex flex-col gap-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#e4e4e7] mb-1">Min Containers</label>
                      <input 
                        type="number" 
                        min="1"
                        value={minContainers} 
                        onChange={(e) => setMinContainers(parseInt(e.target.value))}
                        className="w-full bg-[#09090b] border border-[#3f3f46] rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#e4e4e7] mb-1">Max Containers</label>
                      <input 
                        type="number" 
                        min={minContainers}
                        value={maxContainers} 
                        onChange={(e) => setMaxContainers(parseInt(e.target.value))}
                        className="w-full bg-[#09090b] border border-[#3f3f46] rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#e4e4e7] mb-1">Target CPU (%)</label>
                      <input 
                        type="number" 
                        min="10" max="95"
                        value={targetCpu} 
                        onChange={(e) => setTargetCpu(parseInt(e.target.value))}
                        className="w-full bg-[#09090b] border border-[#3f3f46] rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-purple-400 text-sm font-medium flex items-center gap-2">
                      {saveMessage['autoScaling'] && <CheckCircle2 size={16} />} {saveMessage['autoScaling']}
                    </span>
                    <button 
                      onClick={saveAutoScaling}
                      disabled={saving['autoScaling']}
                      className="bg-[#27272a] hover:bg-[#3f3f46] disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
                    >
                      {saving['autoScaling'] ? <Loader2 size={16} className="animate-spin" /> : "Save Scaling Policy"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* DB Snapshot */}
            <div className="bg-[#09090b] border border-[#27272a] p-6 rounded-xl shadow-lg flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Database size={18} className="text-blue-400" /> Database Snapshots
                </h3>
                <p className="text-[#a1a1aa] text-sm mt-1 max-w-lg">
                  Instantly trigger a manual AWS RDS snapshot of your database. Create a secure recovery point before performing large data migrations.
                </p>
              </div>
              <div className="flex flex-col items-end">
                <button 
                  onClick={triggerSnapshot}
                  disabled={saving['snapshot']}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm mb-2"
                >
                  {saving['snapshot'] ? <Loader2 size={16} className="animate-spin" /> : "Take Snapshot Now"}
                </button>
                <span className="text-blue-400 text-xs font-medium h-4">
                  {saveMessage['snapshot']}
                </span>
              </div>
            </div>

            {/* Log Drains */}
            <div className="bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden shadow-lg">
              <div className="p-6 border-b border-[#27272a]">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-2">
                  <Webhook size={18} className="text-green-400" /> Log Drains & Webhooks
                </h3>
                <p className="text-[#a1a1aa] text-sm mb-4 max-w-lg">
                  Forward your application's raw backend logs and system events directly to a 3rd-party webhook (like Datadog, Slack, or a custom intake endpoint).
                </p>
                <div>
                  <label className="block text-sm font-medium text-[#e4e4e7] mb-1">Destination Webhook URL</label>
                  <input 
                    type="url" 
                    value={logDrainWebhook} 
                    onChange={(e) => setLogDrainWebhook(e.target.value)}
                    placeholder="https://events.example.com/intake"
                    className="w-full bg-[#121214] border border-[#3f3f46] rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500 transition-colors"
                  />
                </div>
              </div>
              <div className="bg-[#121214] p-4 flex items-center justify-between">
                <span className="text-green-400 text-sm font-medium flex items-center gap-2">
                  {saveMessage['logDrain'] && <CheckCircle2 size={16} />} {saveMessage['logDrain']}
                </span>
                <button 
                  onClick={saveLogDrain}
                  disabled={saving['logDrain']}
                  className="bg-[#27272a] hover:bg-[#3f3f46] disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
                >
                  {saving['logDrain'] ? <Loader2 size={16} className="animate-spin" /> : "Save Drain"}
                </button>
              </div>
            </div>

            {/* Maintenance Mode */}
            <div className="bg-[#09090b] border border-orange-500/30 p-6 rounded-xl shadow-lg flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Power size={18} className="text-orange-400" /> Maintenance Mode
                </h3>
                <p className="text-[#a1a1aa] text-sm mt-1 max-w-lg">
                  Block all traffic at the Load Balancer level with a 503 response.
                </p>
              </div>
              <div className="flex flex-col items-end">
                <label className="relative inline-flex items-center cursor-pointer mb-2">
                  <input type="checkbox" className="sr-only peer" checked={maintenanceMode} onChange={toggleMaintenance} disabled={saving['maintenance']} />
                  <div className="w-11 h-6 bg-[#27272a] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                </label>
              </div>
            </div>

            {/* Suspend Compute */}
            <div className="bg-[#09090b] border border-yellow-500/30 p-6 rounded-xl shadow-lg flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <PauseCircle size={18} className="text-yellow-400" /> Pause Compute
                </h3>
                <p className="text-[#a1a1aa] text-sm mt-1 max-w-lg">
                  Suspend all AWS ECS Fargate containers to save costs.
                </p>
              </div>
              <div className="flex flex-col items-end">
                <label className="relative inline-flex items-center cursor-pointer mb-2">
                  <input type="checkbox" className="sr-only peer" checked={isPaused} onChange={togglePause} disabled={saving['pause']} />
                  <div className="w-11 h-6 bg-[#27272a] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
                </label>
              </div>
            </div>

            {/* Transfer Ownership */}
            <div className="bg-[#09090b] border border-red-500/30 rounded-xl overflow-hidden shadow-lg mt-12">
              <div className="p-6 border-b border-[#27272a]">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-2">
                  <Send size={18} className="text-red-400" /> Transfer Ownership
                </h3>
                <p className="text-[#a1a1aa] text-sm mb-6 max-w-lg">
                  Transfer this project to another user. You will lose access to this project immediately.
                </p>
                <div className="bg-[#121214] border border-[#27272a] p-4 rounded-lg flex flex-col gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#e4e4e7] mb-1">New Owner Email Address</label>
                    <input 
                      type="email" value={transferEmail} onChange={(e) => setTransferEmail(e.target.value)} placeholder="e.g. colleague@example.com"
                      className="w-full bg-[#09090b] border border-red-500/50 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500 transition-colors"
                    />
                  </div>
                </div>
              </div>
              <div className="bg-[#121214] p-4 flex items-center justify-between">
                <span className="text-red-400 text-sm font-medium flex items-center gap-2">
                  <AlertTriangle size={16} /> Extreme Caution
                </span>
                <button onClick={handleTransfer} disabled={saving['transfer'] || !transferEmail} className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm">
                  {saving['transfer'] ? <Loader2 size={16} className="animate-spin" /> : "Transfer Project"}
                </button>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
