"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PieChart, Zap, CheckCircle2, Loader2, CreditCard, ChevronRight, Server } from "lucide-react";
import BackgroundAnimation from "../../components/BackgroundAnimation";
import Sidebar from "../../components/Sidebar";

export default function UsagePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [usageData, setUsageData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("bravocloud_token");
    if (!token) {
      window.location.href = "/";
      return;
    }

    const cachedUser = sessionStorage.getItem("bravocloud_user");
    if (cachedUser) {
      setUser(JSON.parse(cachedUser));
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    
    Promise.all([
      fetch(`${apiUrl}/auth/me`, { headers: { "Authorization": `Bearer ${token}` } }),
      fetch(`${apiUrl}/api/usage`, { headers: { "Authorization": `Bearer ${token}` } })
    ])
    .then(async ([userRes, usageRes]) => {
      if (userRes.ok) {
        const userData = (await userRes.json()).user;
        setUser(userData);
        sessionStorage.setItem("bravocloud_user", JSON.stringify(userData));
      }
      if (usageRes.ok) {
        const usageResponse = await usageRes.json();
        setUsageData(usageResponse.currentCycle);
      }
      setLoading(false);
    })
    .catch((err) => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
        <Sidebar user={user} />
        <div className="flex-1 flex flex-col relative bg-black p-8">
          <BackgroundAnimation />
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
            <p className="mt-4 text-[#a1a1aa] text-sm">Aggregating Cloud Usage...</p>
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

        <div className="max-w-5xl mx-auto flex flex-col gap-6 relative z-10 w-full mt-4">
          {/* Header */}
          <div className="mb-2">
            <div className="flex items-center gap-2 text-sm text-[#71717a] font-medium mb-6">
              <button onClick={() => router.push('/dashboard')} className="hover:text-white transition-colors">Dashboard</button>
              <span>/</span>
              <span className="text-white">Usage</span>
            </div>
            
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[#27272a]">
              <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Usage & Billing</h1>
                <p className="text-[#a1a1aa] max-w-2xl text-sm">
                  Monitor your infrastructure consumption and current billing cycle costs.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column: Metrics */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              
              {/* Total Cost Widget */}
              <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-6 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />
                <div className="flex flex-col gap-1 relative z-10">
                  <span className="text-[#a1a1aa] text-sm font-medium uppercase tracking-wider flex items-center gap-2">
                    <CreditCard size={16} /> Current Billing Cycle
                  </span>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-5xl font-bold tracking-tighter">
                      ${usageData?.total?.toFixed(2) || "0.00"}
                    </span>
                    <span className="text-[#a1a1aa]">USD</span>
                  </div>
                  <p className="text-xs text-[#71717a] mt-4">
                    Your estimated cost for the current month. Costs update daily.
                  </p>
                </div>
              </div>

              {/* Breakdown List */}
              <div className="bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden shadow-2xl">
                <div className="px-6 py-4 border-b border-[#27272a] bg-[#121214]">
                  <h3 className="font-semibold text-[#e4e4e7] flex items-center gap-2">
                    <Server size={18} className="text-blue-500" /> Infrastructure Breakdown
                  </h3>
                </div>
                <div className="p-2">
                  {usageData?.breakdown?.length > 0 ? (
                    usageData.breakdown.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-4 hover:bg-[#18181b] rounded-lg transition-colors border-b border-[#27272a] last:border-0">
                        <span className="font-medium text-[#e4e4e7]">{item.service}</span>
                        <span className="text-[#a1a1aa] font-mono text-sm">${item.cost.toFixed(2)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-[#71717a] text-sm">
                      No usage data available for this cycle yet.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Upsell */}
            <div className="flex flex-col gap-6">
              
              <div className="bg-gradient-to-b from-[#18181b] to-[#09090b] border border-amber-500/30 rounded-xl p-6 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/20 blur-[60px] rounded-full pointer-events-none transition-all duration-500 group-hover:bg-amber-500/30 group-hover:scale-150" />
                
                <div className="flex items-center gap-2 text-amber-500 mb-4 font-bold tracking-tight">
                  <Zap size={20} className="fill-amber-500" /> PRO PLAN
                </div>
                
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold text-white">$29</span>
                  <span className="text-[#a1a1aa] text-sm">/mo per user</span>
                </div>

                <p className="text-sm text-[#e4e4e7] leading-relaxed mb-6">
                  Get full access to enterprise-grade software capabilities on top of your pay-as-you-go infrastructure.
                </p>

                <div className="flex flex-col gap-3 mb-8">
                  <div className="flex items-center gap-3 text-sm text-[#a1a1aa]">
                    <CheckCircle2 size={16} className="text-amber-500 flex-shrink-0" />
                    <span>Advanced Analytics & Speed Insights</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-[#a1a1aa]">
                    <CheckCircle2 size={16} className="text-amber-500 flex-shrink-0" />
                    <span>Team Collaboration & Workspaces</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-[#a1a1aa]">
                    <CheckCircle2 size={16} className="text-amber-500 flex-shrink-0" />
                    <span>GitHub Preview Deployments</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-[#a1a1aa]">
                    <CheckCircle2 size={16} className="text-amber-500 flex-shrink-0" />
                    <span>Extended 30-Day Log Retention</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-[#a1a1aa]">
                    <CheckCircle2 size={16} className="text-amber-500 flex-shrink-0" />
                    <span>Advanced Firewall & Security Rules</span>
                  </div>
                </div>

                <button className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.5)]">
                  Upgrade to Pro <ChevronRight size={16} />
                </button>
              </div>

            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
