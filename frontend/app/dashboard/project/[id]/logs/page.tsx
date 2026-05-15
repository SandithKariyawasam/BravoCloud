"use client";

import { useEffect, useState, use, useRef } from "react";
import { useRouter } from "next/navigation";
import BackgroundAnimation from "../../../../components/BackgroundAnimation";
import Sidebar from "../../../../components/Sidebar";

export default function LogsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const router = useRouter();
  
  const [project, setProject] = useState<any>(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<"build" | "runtime">("build");
  const [buildJobs, setBuildJobs] = useState<any[]>([]);
  const [buildRawLog, setBuildRawLog] = useState<string>("");
  const [runtimeLogs, setRuntimeLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [buildJobs, runtimeLogs, activeTab]);

  useEffect(() => {
    const token = localStorage.getItem("bravocloud_token");
    if (!token) {
      window.location.href = "/";
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    
    // Initial fetch for project data
    Promise.all([
      fetch(`${apiUrl}/auth/me`, { headers: { "Authorization": `Bearer ${token}` } }),
      fetch(`${apiUrl}/api/projects/${projectId}`, { headers: { "Authorization": `Bearer ${token}` } })
    ])
    .then(async ([userRes, projRes]) => {
      if (userRes.ok) setUser((await userRes.json()).user);
      if (projRes.ok) setProject((await projRes.json()).project);
      setLoading(false);
    })
    .catch((err) => {
      console.error(err);
      setLoading(false);
    });

    // Polling logic for logs
    const fetchLogs = async () => {
      try {
        if (activeTab === "build") {
          const res = await fetch(`${apiUrl}/api/projects/${projectId}/logs/build`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setBuildJobs(data.jobs || []);
            setBuildRawLog(data.rawLog || "");
          }
        } else {
          const res = await fetch(`${apiUrl}/api/projects/${projectId}/logs/runtime`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setRuntimeLogs(data.logs || []);
          }
        }
      } catch (err) {
        console.error("Error fetching logs", err);
      }
    };

    fetchLogs(); // Initial fetch
    const interval = setInterval(fetchLogs, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [projectId, activeTab]);

  if (loading) {
    return (
      <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
        <Sidebar user={user} />
        <div className="flex-1 flex flex-col relative bg-black p-8">
          <BackgroundAnimation />
          <div className="flex items-center justify-center h-full relative z-10">
            <svg className="animate-spin h-10 w-10 text-white opacity-50" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        </div>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
      <Sidebar user={user} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative overflow-y-auto overflow-x-hidden bg-black p-8">
        <BackgroundAnimation />

        <div className="max-w-6xl mx-auto flex flex-col gap-6 relative z-10 w-full mt-4 h-full">
          
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-[#71717a] font-medium shrink-0">
            <button onClick={() => router.push('/dashboard')} className="hover:text-white transition-colors">Dashboard</button>
            <span>/</span>
            <button onClick={() => router.push(`/dashboard/project/${project.id}`)} className="hover:text-white transition-colors">{project.name}</button>
            <span>/</span>
            <span className="text-white">Logs</span>
          </div>

          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-[#27272a] shrink-0">
            <div className="flex items-start gap-5">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold tracking-tight">Logs</h1>
                </div>
                <p className="text-[#a1a1aa] max-w-2xl text-sm">
                  View build and runtime logs for {project.name}.
                </p>
              </div>
            </div>
            
            {/* Tabs */}
            <div className="flex bg-[#18181b] border border-[#27272a] p-1 rounded-xl">
              <button 
                onClick={() => setActiveTab('build')}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'build' ? 'bg-[#27272a] text-white shadow-sm' : 'text-[#a1a1aa] hover:text-white'}`}
              >
                Build Logs (GitHub)
              </button>
              <button 
                onClick={() => setActiveTab('runtime')}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'runtime' ? 'bg-[#27272a] text-white shadow-sm' : 'text-[#a1a1aa] hover:text-white'}`}
              >
                Runtime Logs (AWS)
              </button>
            </div>
          </div>

          {/* Logs Terminal Window */}
          <div className="flex-1 min-h-[400px] bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)] flex flex-col relative before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/[0.02] before:to-transparent before:pointer-events-none">
            
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#27272a] bg-[#18181b] shrink-0 relative z-10">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-7 h-7 rounded bg-black border border-[#27272a] shadow-inner">
                  <svg className="w-4 h-4 text-[#71717a]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M4 17h16a2 2 0 002-2V9a2 2 0 00-2-2H4a2 2 0 00-2 2v6a2 2 0 002 2z"></path></svg>
                </div>
                <div className="text-xs font-mono text-[#a1a1aa] tracking-widest uppercase">
                  {activeTab === 'build' ? 'GITHUB_ACTIONS // BUILD_STREAM' : 'AWS_CLOUDWATCH // RUNTIME_STREAM'}
                </div>
              </div>
              
              <div className="flex items-center gap-2 bg-black/50 px-2.5 py-1 rounded-md border border-[#27272a]/50">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-mono uppercase font-bold tracking-widest text-emerald-500">Live</span>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 font-mono text-sm text-[#e4e4e7] custom-sidebar-scrollbar whitespace-pre-wrap">
              
              {activeTab === 'build' && (
                <div className="flex flex-col gap-4">
                  {buildRawLog ? (
                    <div className="font-mono text-sm text-[#e4e4e7] whitespace-pre-wrap break-all">
                      {buildRawLog}
                    </div>
                  ) : buildJobs.length === 0 ? (
                    <div className="text-[#71717a] italic">Waiting for build logs...</div>
                  ) : (
                    buildJobs.map((job: any) => (
                      <div key={job.id} className="flex flex-col gap-1">
                        <div className="font-bold text-[#3b82f6] mb-2">▶ Job: {job.name} ({job.status})</div>
                        {job.steps?.map((step: any, idx: number) => (
                          <div key={idx} className="flex gap-4">
                            <span className="text-[#71717a] w-20 shrink-0">
                              {step.started_at ? new Date(step.started_at).toLocaleTimeString([], { hour12: false }) : '--:--:--'}
                            </span>
                            <span className={`flex-1 ${step.status === 'in_progress' ? 'text-[#eab308] animate-pulse' : step.conclusion === 'failure' ? 'text-[#ef4444]' : 'text-[#e4e4e7]'}`}>
                              {step.name}
                            </span>
                            <span className="text-[#71717a] w-20 text-right shrink-0">
                              {step.conclusion === 'success' ? '✓ DONE' : step.conclusion === 'failure' ? '✗ FAIL' : step.status === 'in_progress' ? '...' : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'runtime' && (
                <div className="flex flex-col">
                  {runtimeLogs.length === 0 ? (
                    <div className="text-[#71717a] italic">Waiting for runtime logs...</div>
                  ) : (
                    runtimeLogs.map((log: any, idx: number) => (
                      <div key={idx} className="flex gap-4 hover:bg-[#27272a]/30 px-2 py-0.5 rounded">
                        <span className="text-[#71717a] w-24 shrink-0">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}
                        </span>
                        <span className="flex-1 break-all">
                          {log.message.includes('Error') || log.message.includes('Exception') || log.message.includes('WARN') 
                            ? <span className="text-[#ef4444]">{log.message}</span> 
                            : log.message}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
