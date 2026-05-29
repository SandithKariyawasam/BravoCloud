"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, Clock, Trash2, Plus, Calendar, CheckCircle2 } from "lucide-react";
import BackgroundAnimation from "../../../../../components/BackgroundAnimation";
import Sidebar from "../../../../../components/Sidebar";

export default function CronJobsSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const router = useRouter();
  
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Form State
  const [cronJobs, setCronJobs] = useState<any[]>([]);
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
          setCronJobs(data.project.cronJobs || []);
          sessionStorage.setItem(`bravocloud_project_${projectId}`, JSON.stringify(data.project));
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [projectId]);

  const handleAddJob = () => {
    setCronJobs([
      ...cronJobs,
      {
        id: `cron_${Math.random().toString(36).substr(2, 9)}`,
        name: "New Scheduled Task",
        path: "/api/cron",
        schedule: "rate(1 hour)" // Default: Every hour
      }
    ]);
  };

  const handleRemoveJob = (id: string) => {
    setCronJobs(cronJobs.filter(job => job.id !== id));
  };

  const updateJob = (id: string, field: string, value: string) => {
    setCronJobs(cronJobs.map(job => job.id === id ? { ...job, [field]: value } : job));
  };

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
          cronJobs
        })
      });

      const data = await res.json();
      if (res.ok) {
        setProject(data.project);
        sessionStorage.setItem(`bravocloud_project_${projectId}`, JSON.stringify(data.project));
        setSaveMessage("Successfully provisioned AWS EventBridge Schedules!");
        setTimeout(() => setSaveMessage(""), 5000);
      } else {
        alert(data.error || "Failed to provision schedules.");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving schedules.");
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
            <Loader2 className="w-10 h-10 text-white animate-spin" />
            <p className="mt-4 text-[#a1a1aa] text-sm">Loading cron jobs...</p>
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
              <span className="text-white">Cron Jobs</span>
            </div>
            
            <div className="flex flex-col gap-2 pb-6 border-b border-[#27272a]">
              <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Cron Jobs</h1>
                <button 
                  onClick={handleAddJob}
                  className="bg-white hover:bg-gray-200 text-black px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
                >
                  <Plus size={16} /> Add Cron Job
                </button>
              </div>
              <p className="text-[#a1a1aa] max-w-2xl text-sm mt-1">
                Trigger scheduled actions in your application. BravoCloud provisions AWS EventBridge Schedulers to hit your API routes automatically.
              </p>
            </div>
          </div>

          {/* Jobs List */}
          <div className="bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-[#27272a]">
              <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <Clock size={20} className="text-[#71717a]" /> Active Schedules
              </h3>
              
              {cronJobs.length === 0 ? (
                <div className="text-center p-8 bg-[#121214] border border-[#27272a] border-dashed rounded-lg">
                  <Calendar size={32} className="mx-auto text-[#3f3f46] mb-3" />
                  <p className="text-[#a1a1aa] font-medium">No cron jobs configured</p>
                  <p className="text-[#71717a] text-sm mt-1">Click "Add Cron Job" to create your first scheduled task.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cronJobs.map((job) => (
                    <div key={job.id} className="bg-[#18181b] border border-[#27272a] p-5 rounded-lg flex flex-col gap-4 relative group">
                      <button 
                        onClick={() => handleRemoveJob(job.id)}
                        className="absolute top-4 right-4 text-[#71717a] hover:text-red-400 transition-colors"
                        title="Delete Job"
                      >
                        <Trash2 size={16} />
                      </button>

                      <div className="grid grid-cols-2 gap-4 mr-8">
                        <div>
                          <label className="block text-sm font-medium text-[#a1a1aa] mb-1">Job Name</label>
                          <input 
                            type="text" 
                            value={job.name} 
                            onChange={(e) => updateJob(job.id, 'name', e.target.value)}
                            placeholder="e.g. Daily Database Cleanup"
                            className="w-full bg-[#09090b] border border-[#3f3f46] rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[#a1a1aa] mb-1">Schedule</label>
                          <select
                            value={job.schedule}
                            onChange={(e) => updateJob(job.id, 'schedule', e.target.value)}
                            className="w-full bg-[#09090b] border border-[#3f3f46] rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors appearance-none cursor-pointer"
                          >
                            <option value="rate(1 minute)">Every minute</option>
                            <option value="rate(5 minutes)">Every 5 minutes</option>
                            <option value="rate(15 minutes)">Every 15 minutes</option>
                            <option value="rate(30 minutes)">Every 30 minutes</option>
                            <option value="rate(1 hour)">Every hour</option>
                            <option value="rate(12 hours)">Every 12 hours</option>
                            <option value="cron(0 0 * * ? *)">Every day at Midnight (UTC)</option>
                            <option value="cron(0 12 * * ? *)">Every day at Noon (UTC)</option>
                            <option value="cron(0 0 ? * 2 *)">Every Monday at Midnight (UTC)</option>
                            <option value="cron(0 0 1 * ? *)">1st of every Month (UTC)</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-[#a1a1aa] mb-1">Target API Route</label>
                        <div className="flex items-center">
                          <span className="bg-[#27272a] border border-[#3f3f46] border-r-0 text-[#a1a1aa] px-3 py-2 text-sm rounded-l-md font-mono select-none">
                            https://{project.name}.bravocloud.tech
                          </span>
                          <input 
                            type="text" 
                            value={job.path} 
                            onChange={(e) => updateJob(job.id, 'path', e.target.value.startsWith('/') ? e.target.value : '/' + e.target.value)}
                            placeholder="/api/cron"
                            className="flex-1 bg-[#09090b] border border-[#3f3f46] rounded-r-md px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-blue-500 transition-colors"
                          />
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
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? "Provisioning EventBridge..." : "Save & Sync to AWS"}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
