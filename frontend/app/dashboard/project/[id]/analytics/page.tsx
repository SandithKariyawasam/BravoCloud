"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import BackgroundAnimation from "../../../../components/BackgroundAnimation";
import Sidebar from "../../../../components/Sidebar";
import { Copy, AlertTriangle, Activity, Globe, Monitor, ShieldAlert, FileText, CheckCircle2 } from "lucide-react";

export default function AnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const router = useRouter();
  
  const [project, setProject] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [metrics, setMetrics] = useState<any>({
    totalVisitors: 0,
    pageViews: 0,
    topPages: [],
    topCountries: [],
    topOS: [],
    topDevices: [],
    errors: []
  });
  
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("bravocloud_token");
    if (!token) {
      window.location.href = "/";
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    
    // Check cache
    const cacheKey = `bravocloud_project_cache_${projectId}`;
    const cachedData = localStorage.getItem(cacheKey);
    let hasCache = false;
    
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        if (parsed.project) {
          setProject(parsed.project);
          if (parsed.user) setUser(parsed.user);
          setLoading(false);
          hasCache = true;
        }
      } catch (e) {}
    }

    try {
      const cachedMetrics = localStorage.getItem(`bravocloud_analytics_cache_${projectId}`);
      if (cachedMetrics) {
        setMetrics(JSON.parse(cachedMetrics));
      }
    } catch (e) {}

    // Initial fetch
    Promise.all([
      fetch(`${apiUrl}/auth/me`, { headers: { "Authorization": `Bearer ${token}` } }),
      fetch(`${apiUrl}/api/projects/${projectId}`, { headers: { "Authorization": `Bearer ${token}` } }),
      fetch(`${apiUrl}/api/analytics/${projectId}`, { headers: { "Authorization": `Bearer ${token}` } })
    ])
    .then(async ([userRes, projRes, analyticsRes]) => {
      let userData = user;
      let projData = project;
      
      if (userRes.ok) {
        const u = await userRes.json();
        userData = u.user;
        setUser(userData);
      }
      if (projRes.ok) {
        const p = await projRes.json();
        projData = p.project;
        setProject(projData);
      }
      
      if (projData) {
        localStorage.setItem(cacheKey, JSON.stringify({ project: projData, user: userData }));
      }

      if (analyticsRes.ok) {
        const a = await analyticsRes.json();
        setMetrics(a.metrics);
        localStorage.setItem(`bravocloud_analytics_cache_${projectId}`, JSON.stringify(a.metrics));
      }
      
      if (!hasCache) setLoading(false);
    })
    .catch((err) => {
      console.error(err);
      if (!hasCache) setLoading(false);
    });

  }, [projectId]);

  const copySnippet = () => {
    const snippet = `<script src="${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/analytics/script.js" data-bravocloud-id="${projectId}"></script>`;
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const calculatePercentage = (count: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((count / total) * 100);
  };

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

  // Calculate totals for percentage bars
  const totalPageCount = metrics.topPages.reduce((acc: number, item: any) => acc + item.count, 0);
  const totalCountryCount = metrics.topCountries.reduce((acc: number, item: any) => acc + item.count, 0);
  const totalDeviceCount = metrics.topDevices.reduce((acc: number, item: any) => acc + item.count, 0);
  const totalOSCount = metrics.topOS.reduce((acc: number, item: any) => acc + item.count, 0);

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
      <Sidebar user={user} />
      
      <div className="flex-1 flex flex-col relative bg-black overflow-y-auto">
        <BackgroundAnimation />
        
        <div className="relative z-10 p-8 max-w-7xl mx-auto w-full">
          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center gap-3 text-sm text-[#a1a1aa] mb-2 font-medium">
              <span className="hover:text-white cursor-pointer transition-colors">{user?.username}</span>
              <span className="text-[#3f3f46]">/</span>
              <span className="hover:text-white cursor-pointer transition-colors">{project?.name}</span>
              <span className="text-[#3f3f46]">/</span>
              <span className="text-white">Analytics</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white flex items-center gap-3">
              <Activity className="text-emerald-400" size={36} />
              Analytics & Insights
            </h1>
          </div>

          {/* Setup Banner */}
          <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-6 mb-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)]">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-blue-500/5 z-0" />
            <div className="relative z-10">
              <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Monitor className="text-blue-400" size={20} />
                Setup Tracking
              </h2>
              <p className="text-sm text-[#a1a1aa] max-w-2xl">
                Paste this snippet into the <code className="bg-[#18181b] px-1 py-0.5 rounded text-white border border-[#27272a]">&lt;head&gt;</code> of your application to automatically start tracking visitors, page views, and javascript errors.
              </p>
            </div>
            
            <div className="relative z-10 flex items-center gap-2 bg-[#18181b] border border-[#27272a] rounded-lg p-1 w-full md:w-auto">
              <div className="px-4 py-2 text-sm font-mono text-[#a1a1aa] overflow-x-auto whitespace-nowrap max-w-[300px] md:max-w-[400px]">
                {`<script src="${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/analytics/script.js" data-bravocloud-id="${projectId}"></script>`}
              </div>
              <button 
                onClick={copySnippet}
                className="bg-white text-black px-4 py-2 rounded-md font-semibold text-sm flex items-center gap-2 hover:bg-gray-200 transition-colors shrink-0"
              >
                {copied ? <CheckCircle2 size={16} className="text-green-600" /> : <Copy size={16} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-6 flex flex-col justify-between h-32 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><Activity size={64} /></div>
              <h3 className="text-sm font-medium text-[#a1a1aa]">Unique Visitors</h3>
              <p className="text-4xl font-bold text-white tracking-tight">{metrics.totalVisitors}</p>
            </div>
            <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-6 flex flex-col justify-between h-32 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><FileText size={64} /></div>
              <h3 className="text-sm font-medium text-[#a1a1aa]">Total Page Views</h3>
              <p className="text-4xl font-bold text-white tracking-tight">{metrics.pageViews}</p>
            </div>
            <div className="bg-[#09090b] border border-[#27272a] border-red-500/20 rounded-xl p-6 flex flex-col justify-between h-32 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 text-red-500"><ShieldAlert size={64} /></div>
              <h3 className="text-sm font-medium text-red-400">Total Errors</h3>
              <p className="text-4xl font-bold text-white tracking-tight">{metrics.errors.length}</p>
            </div>
          </div>

          {/* Breakdowns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
            
            {/* Top Pages */}
            <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-6 border-b border-[#27272a] pb-4 flex items-center gap-2">
                <FileText size={18} className="text-[#a1a1aa]" /> Most Visited Pages
              </h3>
              {metrics.topPages.length === 0 ? (
                <div className="text-center py-10 text-[#71717a] text-sm">No page view data yet.</div>
              ) : (
                <div className="space-y-4">
                  {metrics.topPages.map((page: any, i: number) => (
                    <div key={i} className="flex flex-col gap-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-white truncate max-w-[70%]">{page.name}</span>
                        <span className="text-[#a1a1aa]">{page.count} views</span>
                      </div>
                      <div className="w-full bg-[#18181b] rounded-full h-1.5 overflow-hidden">
                        <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${calculatePercentage(page.count, totalPageCount)}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Countries */}
            <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-6 border-b border-[#27272a] pb-4 flex items-center gap-2">
                <Globe size={18} className="text-[#a1a1aa]" /> Top Countries
              </h3>
              {metrics.topCountries.length === 0 ? (
                <div className="text-center py-10 text-[#71717a] text-sm">No geographic data yet.</div>
              ) : (
                <div className="space-y-4">
                  {metrics.topCountries.map((country: any, i: number) => (
                    <div key={i} className="flex flex-col gap-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-white">{country.name}</span>
                        <span className="text-[#a1a1aa]">{country.count} visitors</span>
                      </div>
                      <div className="w-full bg-[#18181b] rounded-full h-1.5 overflow-hidden">
                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${calculatePercentage(country.count, totalCountryCount)}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Devices */}
            <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-6 border-b border-[#27272a] pb-4 flex items-center gap-2">
                <Monitor size={18} className="text-[#a1a1aa]" /> Devices
              </h3>
              {metrics.topDevices.length === 0 ? (
                <div className="text-center py-10 text-[#71717a] text-sm">No device data yet.</div>
              ) : (
                <div className="space-y-4">
                  {metrics.topDevices.map((device: any, i: number) => (
                    <div key={i} className="flex flex-col gap-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-white capitalize">{device.name}</span>
                        <span className="text-[#a1a1aa]">{device.count} visitors</span>
                      </div>
                      <div className="w-full bg-[#18181b] rounded-full h-1.5 overflow-hidden">
                        <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${calculatePercentage(device.count, totalDeviceCount)}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* OS */}
            <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-6 border-b border-[#27272a] pb-4 flex items-center gap-2">
                <AlertTriangle size={18} className="text-[#a1a1aa]" /> Operating Systems
              </h3>
              {metrics.topOS.length === 0 ? (
                <div className="text-center py-10 text-[#71717a] text-sm">No OS data yet.</div>
              ) : (
                <div className="space-y-4">
                  {metrics.topOS.map((os: any, i: number) => (
                    <div key={i} className="flex flex-col gap-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-white">{os.name}</span>
                        <span className="text-[#a1a1aa]">{os.count} visitors</span>
                      </div>
                      <div className="w-full bg-[#18181b] rounded-full h-1.5 overflow-hidden">
                        <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${calculatePercentage(os.count, totalOSCount)}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Error Tracking ("Failed Features") */}
          <div className="bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden mb-20 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
            <div className="p-6 border-b border-[#27272a] flex items-center justify-between bg-[#18181b]/30">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldAlert size={20} className="text-red-500" />
                Failed Features & Exceptions
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#27272a] text-xs font-semibold text-[#71717a] uppercase tracking-wider bg-[#18181b]">
                    <th className="px-6 py-4">Error Message</th>
                    <th className="px-6 py-4">Page URL</th>
                    <th className="px-6 py-4">Environment</th>
                    <th className="px-6 py-4">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#27272a]">
                  {metrics.errors.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-[#71717a] text-sm">
                        No errors detected! Your application is running smoothly.
                      </td>
                    </tr>
                  ) : (
                    metrics.errors.map((error: any, i: number) => (
                      <tr key={i} className="hover:bg-[#18181b]/50 transition-colors group">
                        <td className="px-6 py-4 max-w-[300px]">
                          <div className="text-red-400 font-mono text-sm truncate" title={error.message}>
                            {error.message}
                          </div>
                          {error.filename && (
                            <div className="text-[#71717a] text-xs mt-1 truncate">
                              at {error.filename}:{error.lineno}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-white text-sm truncate max-w-[200px]" title={error.url}>
                            {error.url}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs text-white">{error.browser}</span>
                            <span className="text-[10px] text-[#71717a]">{error.os}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-[#a1a1aa]">
                          {new Date(error.timestamp).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
