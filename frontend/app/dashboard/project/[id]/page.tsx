"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useToast } from "../../../components/ToastContext";
import { useConfirm } from "../../../components/ConfirmContext";
import BackgroundAnimation from "../../../components/BackgroundAnimation";
import Sidebar from "../../../components/Sidebar";

export default function ProjectDetails() {
  const params = useParams();
  const projectId = params?.id as string;
  const router = useRouter();
  const confirm = useConfirm();
  const { error: showError, success: showSuccess } = useToast();
  const [project, setProject] = useState<any>(null);
  const [deployments, setDeployments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeploying, setRedeploying] = useState(false);

  useEffect(() => {
    let hasCache = false;
    // Attempt instant load from cache
    const cachedData = localStorage.getItem(`bravocloud_project_cache_${projectId}`);
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        if (parsed.project && parsed.deployments && parsed.deployments.length > 0) {
          setProject(parsed.project);
          setDeployments(parsed.deployments);
          setLoading(false);
          hasCache = true;
        }
      } catch (e) {
        // Ignored
      }
    }

    fetchProjectDetails(hasCache);

    // Auto-refresh the project details every 5 seconds to get latest deployment statuses
    const intervalId = setInterval(() => {
      fetchProjectDetails(true);
    }, 5000);

    return () => clearInterval(intervalId);
  }, [projectId]);

  const fetchProjectDetails = async (hasCache: boolean = false) => {
    if (!hasCache) {
      setLoading(true);
    }
    try {
      const token = localStorage.getItem('bravocloud_token');
      if (!token) {
        router.push('/login');
        return;
      }

      const [projRes, depRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/projects/${projectId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/projects/${projectId}/deployments`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (projRes.ok && depRes.ok) {
        const projData = await projRes.json();
        const depData = await depRes.json();
        
        setProject(projData.project);
        setDeployments(depData.deployments);
        setLoading(false);
        
        // Save to cache for next instant load
        localStorage.setItem(`bravocloud_project_cache_${projectId}`, JSON.stringify({
          project: projData.project,
          deployments: depData.deployments
        }));
      } else {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Error fetching details:', error);
      router.push('/dashboard');
    }
  };

  const handleRedeploy = async () => {
    if (!project) return;
    setRedeploying(true);

    try {
      const token = localStorage.getItem('bravocloud_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/projects/${project.id}/redeploy`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        // Optimistically add a queued deployment
        setDeployments([{
          id: 'temp-' + Date.now(),
          status: 'QUEUED',
          commitHash: 'redeploy-trigger',
          createdAt: new Date().toISOString()
        }, ...deployments]);
        showSuccess('Redeploy triggered successfully');
      } else {
        const data = await res.json().catch(() => ({}));
        showError(data.error || 'Failed to redeploy project.');
      }
    } catch (error) {
      console.error('Error redeploying:', error);
      showError('Error redeploying project.');
    } finally {
      setRedeploying(false);
    }
  };

  const handleRollback = async () => {
    if (!project || deployments.length < 2) return;
    const previousDeployment = deployments[1];
    if (!previousDeployment || !previousDeployment.commitHash || previousDeployment.commitHash === 'redeploy-trigger' || previousDeployment.commitHash === 'manual') return;

    if (!(await confirm('Are you sure you want to rollback to the previous deployment?'))) return;

    setRedeploying(true); // Reuse loading state

    try {
      const token = localStorage.getItem("bravocloud_token");
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const res = await fetch(`${apiUrl}/api/projects/${project.id}/deployments/${previousDeployment.id}/rollback`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to rollback");
      }
      showSuccess("Rollback initiated successfully!");
      fetchProjectDetails();
    } catch (error: any) {
      showError("Rollback failed: " + error.message);
    } finally {
      setRedeploying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
        <Sidebar />
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

  const currentStatus = deployments.length > 0 ? deployments[0].status : 'UNKNOWN';
  const isBuilding = currentStatus === 'QUEUED' || currentStatus === 'BUILDING';
  const isSuccess = currentStatus === 'SUCCESS' || currentStatus === 'DEPLOYED';
  const isFailed = currentStatus === 'FAILED';
  const latestDeployment = deployments.length > 0 ? deployments[0] : null;
  const publicUrl = latestDeployment?.publicUrl || (project.subdomain ? (project.subdomain.includes(':') || project.subdomain.match(/^\d+\.\d+\.\d+\.\d+/) ? `http://${project.subdomain}` : `https://${project.subdomain}`) : null);
  const localUrl = latestDeployment?.localUrl || null;

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative overflow-y-auto overflow-x-hidden bg-black p-8">
        <BackgroundAnimation />

        <div className="max-w-6xl mx-auto flex flex-col gap-6 relative z-10 w-full mt-4">

          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-[#71717a] font-medium">
            <button onClick={() => router.push('/dashboard')} className="hover:text-white transition-colors">Dashboard</button>
            <span>/</span>
            <span className="text-white">{project.name}</span>
          </div>

          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-[#27272a]">
            <div className="flex items-start gap-5">
              <div className="w-16 h-16 rounded-2xl bg-transparent flex items-center justify-center flex-shrink-0 overflow-hidden relative shadow-lg">
                {publicUrl && (
                  <img
                    src={`${process.env.NEXT_PUBLIC_API_URL}/api/projects/proxy-favicon?url=${encodeURIComponent(publicUrl)}`}
                    className="w-full h-full object-cover z-10"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                    onLoad={(e) => {
                      const svg = e.currentTarget.parentElement?.querySelector('svg');
                      if (svg) svg.style.display = 'none';
                    }}
                  />
                )}
                <svg className="w-8 h-8 text-white absolute z-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
                  <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold tracking-wider uppercase flex items-center gap-1.5
                    ${isSuccess ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                      isFailed ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                        'bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse'}`}>
                    {isBuilding && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" />}
                    {currentStatus}
                  </span>
                </div>
                {publicUrl && (
                  <a href={publicUrl} target="_blank" rel="noreferrer" className="text-[#a1a1aa] hover:text-white transition-colors flex items-center gap-1.5 text-sm group w-fit">
                    {publicUrl.replace('https://', '').replace('http://', '')}
                    <svg className="w-3.5 h-3.5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </a>
                )}
                {localUrl && (
                  <a href={localUrl} target="_blank" rel="noreferrer" className="text-[#a1a1aa] hover:text-white transition-colors flex items-center gap-1.5 text-sm group w-fit">
                    {localUrl.replace('http://', '')} <span className="px-1.5 py-0.5 rounded bg-[#27272a] text-[10px] font-bold text-white uppercase ml-1">Local</span>
                    <svg className="w-3.5 h-3.5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </a>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleRedeploy}
                disabled={redeploying}
                className="px-5 py-2.5 text-sm font-semibold bg-[#27272a] text-white rounded-xl hover:bg-[#3f3f46] transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {redeploying ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Building...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Redeploy
                  </>
                )}
              </button>
              {publicUrl && (
                <a href={publicUrl} target="_blank" rel="noreferrer" className="px-5 py-2.5 text-sm font-semibold bg-white text-black rounded-xl hover:bg-gray-200 transition-colors shadow-sm flex items-center gap-2">
                  Visit Site
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </a>
              )}
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-6 items-stretch">

            {/* Main Column - Live Preview */}
            <div className="w-full lg:w-[55%]">
              <div className="bg-[#18181b] border border-[#27272a] rounded-2xl overflow-hidden shadow-2xl relative flex flex-col group h-full min-h-[320px]">
                <div className="absolute top-5 left-6 z-10 pointer-events-auto bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 shadow-lg">
                  <h3 className="text-lg font-bold text-white drop-shadow-md">Production Deployment</h3>
                </div>
                {/* Iframe content */}
                <div className="flex-1 bg-black relative overflow-hidden pointer-events-none">
                  {publicUrl ? (
                    <iframe
                      src={publicUrl}
                      className="absolute inset-0 w-full h-full border-0 bg-black"
                      title="Live Preview"
                      sandbox="allow-scripts allow-same-origin"
                      scrolling="no"
                      tabIndex={-1}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-black flex flex-col items-center justify-center text-[#71717a] font-mono text-sm">
                      <svg className="animate-spin h-8 w-8 text-[#71717a] mb-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Waiting for first deployment to complete...
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar Column - Meta */}
            <div className="w-full lg:w-[45%]">
              <div className="bg-[#18181b]/60 backdrop-blur-md border border-[#27272a] rounded-2xl p-7 shadow-2xl flex flex-col gap-6 text-[#e4e4e7] h-full justify-center">
                <h3 className="text-lg font-bold text-white mb-2">Overview</h3>

                {/* Deployment */}
                <div className="flex flex-col gap-2">
                  <h4 className="text-[14px] text-[#a1a1aa]">Deployment</h4>
                  {project.taskIp ? (
                    <a href={`http://${project.taskIp}${project.port === 80 ? '' : `:${project.port || 3000}`}`} target="_blank" rel="noreferrer" className="text-[14px] font-semibold hover:underline truncate text-[#e4e4e7]">
                      {`http://${project.taskIp}${project.port === 80 ? '' : `:${project.port || 3000}`}`}
                    </a>
                  ) : localUrl ? (
                    <div className="flex items-center gap-1.5">
                      <a href={localUrl} target="_blank" rel="noreferrer" className="text-[14px] font-semibold hover:underline truncate text-[#e4e4e7]">
                        {localUrl.replace('http://', '')}
                      </a>
                      <span className="px-1.5 py-0.5 rounded bg-[#27272a] text-[10px] font-bold text-white uppercase">Local</span>
                      <a href={localUrl} target="_blank" rel="noreferrer" className="text-[#a1a1aa] hover:text-white transition-colors">
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      </a>
                    </div>
                  ) : (
                    <span className="text-[14px] font-semibold truncate text-[#e4e4e7]">
                      {isFailed ? 'Failed' : 'Deploying...'}
                    </span>
                  )}
                </div>

                {/* Domains */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-[14px] text-[#a1a1aa]">Domains</h4>
                    <button className="w-4 h-4 rounded-full border border-[#3f3f46] flex items-center justify-center text-[#a1a1aa] hover:text-white hover:border-white transition-colors">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <a href={publicUrl || '#'} target="_blank" rel="noreferrer" className="text-[14px] font-semibold hover:underline truncate">
                      {publicUrl ? publicUrl.replace('https://', '').replace('http://', '') : 'Pending...'}
                    </a>
                    <svg className="w-3.5 h-3.5 text-[#a1a1aa] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </div>
                </div>

                {/* Status & Created */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <h4 className="text-[14px] text-[#a1a1aa]">Status</h4>
                    <div className="flex items-center gap-2 text-[14px] font-semibold">
                      <div className={`w-2 h-2 rounded-full ${(latestDeployment?.status === 'SUCCESS' || latestDeployment?.status === 'DEPLOYED') ? 'bg-[#22c55e]' : latestDeployment?.status === 'FAILED' ? 'bg-[#ef4444]' : 'bg-[#eab308]'}`}></div>
                      {(latestDeployment?.status === 'SUCCESS' || latestDeployment?.status === 'DEPLOYED') ? 'READY' : latestDeployment?.status || 'Unknown'}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <h4 className="text-[14px] text-[#a1a1aa]">Created</h4>
                    <div className="text-[14px] font-semibold truncate flex items-center gap-2">
                      {latestDeployment ? new Date(latestDeployment.createdAt).toLocaleDateString() : 'Just now'}
                    </div>
                  </div>
                </div>

                {/* Source */}
                <div className="flex flex-col gap-2">
                  <h4 className="text-[14px] text-[#a1a1aa]">Source</h4>
                  <div className="flex items-center gap-2 text-[14px]">
                    <svg className="w-4 h-4 text-[#a1a1aa]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                    <span className="font-mono font-semibold">{project.branch}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[13px] text-[#a1a1aa]">
                    <span className="font-mono opacity-60">-o-</span>
                    <span className="font-mono text-white">{latestDeployment?.commitHash ? latestDeployment.commitHash.substring(0, 7) : 'trigger'}</span>
                    <span className="truncate ml-1">{project.latestCommitMessage || 'Deployed via BravoCloud'}</span>
                  </div>
                </div>

                {deployments.length > 1 && deployments[1].commitHash && deployments[1].commitHash !== 'redeploy-trigger' && deployments[1].commitHash !== 'manual' && (
                  <div className="mt-2 pt-4 border-t border-[#27272a]/50">
                    <button
                      onClick={handleRollback}
                      disabled={redeploying}
                      className="w-full py-2.5 px-4 bg-[#27272a] hover:bg-[#3f3f46] text-[#facc15] font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-inner disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                      {redeploying ? 'Rolling Back...' : 'Rollback to Previous Version'}
                    </button>
                  </div>
                )}

              </div>
            </div>
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">

            {/* Configuration */}
            <div className="bg-[#18181b]/60 backdrop-blur-md border border-[#27272a] rounded-2xl p-7 shadow-2xl flex flex-col gap-6">
              <h3 className="text-lg font-bold text-white">Configuration</h3>

              <div className="flex flex-col gap-5">
                <div>
                  <h4 className="text-xs font-semibold text-[#71717a] uppercase tracking-wider mb-2">GitHub Repository</h4>
                  <div className="flex items-center gap-2 text-sm text-[#e4e4e7] bg-[#27272a]/30 p-3 rounded-lg border border-[#3f3f46]/50">
                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
                    <a href={project.repoUrl} target="_blank" rel="noreferrer" className="hover:text-white hover:underline truncate">
                      {project.repoUrl.replace('https://github.com/', '')}
                    </a>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-[#71717a] uppercase tracking-wider mb-2">Framework</h4>
                  <div className="flex items-center gap-2 text-sm text-[#e4e4e7] bg-[#27272a]/30 p-3 rounded-lg border border-[#3f3f46]/50">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                    <span>{project.framework}</span>
                  </div>
                </div>

                {project.envVars && Object.keys(project.envVars).length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-[#71717a] uppercase tracking-wider mb-2">Environment Variables</h4>
                    <div className="flex flex-col gap-1.5 bg-[#27272a]/30 p-3 rounded-lg border border-[#3f3f46]/50 max-h-32 overflow-y-auto">
                      {Object.keys(project.envVars).map(key => (
                        <div key={key} className="flex items-center justify-between text-xs font-mono">
                          <span className="text-[#a1a1aa] truncate mr-2">{key}</span>
                          <span className="text-white opacity-40">********</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Observability */}
            <div className="bg-[#18181b]/60 backdrop-blur-md border border-[#27272a] rounded-2xl p-7 shadow-2xl flex flex-col gap-6">
              <h3 className="text-lg font-bold text-white">Observability</h3>
              <div className="flex-1 flex flex-col items-center justify-center text-[#a1a1aa] min-h-[150px] bg-[#27272a]/10 rounded-xl border border-dashed border-[#3f3f46]">
                <svg className="w-8 h-8 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                <span className="text-sm font-medium">Metrics syncing...</span>
              </div>
            </div>

            {/* Analytics */}
            <div className="bg-[#18181b]/60 backdrop-blur-md border border-[#27272a] rounded-2xl p-7 shadow-2xl flex flex-col gap-6">
              <h3 className="text-lg font-bold text-white">Analytics</h3>
              <div className="flex-1 flex flex-col items-center justify-center text-[#a1a1aa] min-h-[150px] bg-[#27272a]/10 rounded-xl border border-dashed border-[#3f3f46]">
                <svg className="w-8 h-8 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
                <span className="text-sm font-medium">No traffic data yet</span>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
