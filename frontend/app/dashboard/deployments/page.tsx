"use client";

import { useEffect, useState } from "react";
import BackgroundAnimation from "../../components/BackgroundAnimation";
import Sidebar from "../../components/Sidebar";
import DeploymentsList from "../../components/DeploymentsList";

export default function DeploymentsPage() {
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
      fetch(`${apiUrl}/api/deployments`, { headers: { "Authorization": `Bearer ${token}` } })
    ])
    .then(async ([userRes, depsRes]) => {
      if (userRes.ok) setUser((await userRes.json()).user);
      if (depsRes.ok) setDeployments((await depsRes.json()).deployments || []);
      setLoading(false);
    })
    .catch((err) => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
      <Sidebar user={user} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative overflow-y-auto overflow-x-hidden bg-black p-8">
        <BackgroundAnimation />

        <div className="max-w-7xl mx-auto flex flex-col gap-8 relative z-10 w-full">
          <main className="mt-4">
            <div className="mb-10 flex items-center justify-between">
              <div>
                <h2 className="text-4xl font-bold mb-3 tracking-tight">Deployments</h2>
                <p className="text-[#a1a1aa] text-lg">View all deployment activity across your projects.</p>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-24">
                <svg className="animate-spin h-10 w-10 text-white opacity-50" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            ) : (
              <DeploymentsList deployments={deployments} isGlobal={true} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
