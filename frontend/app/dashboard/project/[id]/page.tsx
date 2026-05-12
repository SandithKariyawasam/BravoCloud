"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import BackgroundAnimation from "../../../components/BackgroundAnimation";
import Sidebar from "../../../components/Sidebar";

export default function ProjectDetails({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const router = useRouter();
  const [project, setProject] = useState<any>(null);
  const [deployments, setDeployments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeploying, setRedeploying] = useState(false);

  useEffect(() => {
    fetchProjectDetails();
  }, [projectId]);

  const fetchProjectDetails = async () => {
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
      } else {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Error fetching details:', error);
      router.push('/dashboard');
    } finally {
      setLoading(false);
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
      } else {
        alert('Failed to redeploy project.');
      }
    } catch (error) {
      console.error('Error redeploying:', error);
      alert('Error redeploying project.');
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
  const publicUrl = project.subdomain ? (project.subdomain.includes(':') || project.subdomain.match(/^\d+\.\d+\.\d+\.\d+/) ? `http://${project.subdomain}` : `https://${project.subdomain}`) : null;

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative overflow-y-auto overflow-x-hidden bg-black p-8">
        <BackgroundAnimation />

        <div className="max-w-6xl mx-auto flex flex-col gap-8 relative z-10 w-full mt-4">
          
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-[#71717a] font-medium">
            <button onClick={() => router.push('/dashboard')} className="hover:text-white transition-colors">Dashboard</button>
            <span>/</span>
            <span className="text-white">{project.name}</span>
          </div>

          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-[#27272a]">
            <div className="flex items-start gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#27272a] to-[#18181b] border border-[#3f3f46] flex items-center justify-center flex-shrink-0 overflow-hidden relative shadow-lg">
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Main Column - Deployments */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              <h3 className="text-xl font-bold tracking-tight">Deployments</h3>
              
              <div className="bg-[#18181b]/60 backdrop-blur-md border border-[#27272a] rounded-2xl overflow-hidden shadow-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#27272a] bg-[#27272a]/30">
                      <th className="px-6 py-4 text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider">Commit</th>
                      <th className="px-6 py-4 text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#27272a]">
                    {deployments.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-8 text-center text-[#71717a] text-sm">No deployments found.</td>
                      </tr>
                    ) : (
                      deployments.map((dep, idx) => (
                        <tr key={dep.id} className="hover:bg-[#27272a]/30 transition-colors group">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold tracking-wider uppercase flex items-center gap-1.5 w-fit
                              ${(dep.status === 'SUCCESS' || dep.status === 'DEPLOYED') ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 
                                dep.status === 'FAILED' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
                                'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                              {(dep.status === 'QUEUED' || dep.status === 'BUILDING') && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />}
                              {dep.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-mono text-[#e4e4e7]">
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-[#71717a]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                              {dep.commitHash ? dep.commitHash.substring(0, 7) : 'trigger'}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-[#a1a1aa] whitespace-nowrap">
                            {new Date(dep.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sidebar Column - Settings */}
            <div className="flex flex-col gap-6">
              <h3 className="text-xl font-bold tracking-tight">Configuration</h3>
              
              <div className="bg-[#18181b]/60 backdrop-blur-md border border-[#27272a] rounded-2xl p-6 shadow-2xl flex flex-col gap-5">
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

                <div>
                  <h4 className="text-xs font-semibold text-[#71717a] uppercase tracking-wider mb-2">Branch</h4>
                  <div className="flex items-center gap-2 text-sm text-[#e4e4e7] bg-[#27272a]/30 p-3 rounded-lg border border-[#3f3f46]/50">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                    <span>{project.branch}</span>
                  </div>
                </div>

                {project.envVars && Object.keys(project.envVars).length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-[#71717a] uppercase tracking-wider mb-2">Environment Variables</h4>
                    <div className="flex flex-col gap-1.5 bg-[#27272a]/30 p-3 rounded-lg border border-[#3f3f46]/50 max-h-48 overflow-y-auto">
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

          </div>
        </div>
      </div>
    </div>
  );
}
