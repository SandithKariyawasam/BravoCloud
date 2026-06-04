"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BackgroundAnimation from "../../../../components/BackgroundAnimation";
import Sidebar from "../../../../components/Sidebar";
import DeploymentsList from "../../../../components/DeploymentsList";

export default function ProjectDeploymentsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [project, setProject] = useState<any>(null);
  const [deployments, setDeployments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("bravocloud_token");
    if (!token) {
      window.location.href = "/";
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    
    Promise.all([
      fetch(`${apiUrl}/auth/me`, { headers: { "Authorization": `Bearer ${token}` } }),
      fetch(`${apiUrl}/api/projects/${params.id}`, { headers: { "Authorization": `Bearer ${token}` } }),
      fetch(`${apiUrl}/api/projects/${params.id}/deployments`, { headers: { "Authorization": `Bearer ${token}` } })
    ])
    .then(async ([userRes, projRes, depsRes]) => {
      if (userRes.ok) setUser((await userRes.json()).user);
      if (projRes.ok) setProject((await projRes.json()).project);
      if (depsRes.ok) setDeployments((await depsRes.json()).deployments || []);
      setLoading(false);
    })
    .catch((err) => {
      console.error(err);
      setLoading(false);
    });
  }, [params.id]);

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

        <div className="max-w-6xl mx-auto flex flex-col gap-6 relative z-10 w-full mt-4">
          
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-[#71717a] font-medium">
            <button onClick={() => router.push('/dashboard')} className="hover:text-white transition-colors">Dashboard</button>
            <span>/</span>
            <button onClick={() => router.push(`/dashboard/project/${project.id}`)} className="hover:text-white transition-colors">{project.name}</button>
            <span>/</span>
            <span className="text-white">Deployments</span>
          </div>

          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-[#27272a]">
            <div className="flex items-start gap-5">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold tracking-tight">Deployments</h1>
                </div>
                <p className="text-[#a1a1aa] max-w-2xl text-sm">
                  View and manage deployment history for {project.name}.
                </p>
              </div>
            </div>
            
            <button
              onClick={() => {
                // Re-trigger deployment logic if needed
                alert("Redeploy not hooked up in list yet");
              }}
              className="px-6 py-2.5 text-sm font-semibold bg-white text-black rounded-xl hover:bg-gray-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Redeploy Latest
            </button>
          </div>

          {/* Deployments List */}
          <DeploymentsList deployments={deployments} isGlobal={false} />
          
        </div>
      </div>
    </div>
  );
}
