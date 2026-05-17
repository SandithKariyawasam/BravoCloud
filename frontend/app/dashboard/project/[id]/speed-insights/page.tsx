"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Monitor, Copy, CheckCircle2 } from "lucide-react";
import BackgroundAnimation from "../../../../components/BackgroundAnimation";
import Sidebar from "../../../../components/Sidebar";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";



const METRICS = [
  "Real Experience Score",
  "First Contentful Paint",
  "Largest Contentful Paint",
  "Interaction to Next Paint",
  "Cumulative Layout Shift",
  "First Input Delay",
  "Time to First Byte"
];

export default function ProjectSpeedInsightsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const router = useRouter();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  
  const [activeMetric, setActiveMetric] = useState("Real Experience Score");
  const [chartData, setChartData] = useState<any[]>([]);
  const [thresholds, setThresholds] = useState({ poor: 0, needsImprovement: 0, great: 0 });
  const [topCountries, setTopCountries] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [isFetchingMetric, setIsFetchingMetric] = useState(false);

  const copySnippet = () => {
    const origin = process.env.NEXT_PUBLIC_FRONTEND_URL || "https://www.bravocloud.tech";
    const snippet = `<script src="${origin}/api/analytics/script.js" data-bravocloud-id="${projectId}"></script>`;
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    const token = localStorage.getItem("bravocloud_token");
    if (!token) {
      window.location.href = "/";
      return;
    }

    // Instantly load from sessionStorage cache if available
    const cachedUser = sessionStorage.getItem("bravocloud_user");
    const cachedProject = sessionStorage.getItem(`bravocloud_project_${projectId}`);
    
    if (cachedUser && cachedProject) {
      setUser(JSON.parse(cachedUser));
      setProject(JSON.parse(cachedProject));
      setLoading(false);
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    
    Promise.all([
      fetch(`${apiUrl}/auth/me`, { headers: { "Authorization": `Bearer ${token}` } }),
      fetch(`${apiUrl}/api/projects/${projectId}`, { headers: { "Authorization": `Bearer ${token}` } })
    ])
    .then(async ([userRes, projRes]) => {
      if (userRes.ok) {
        const userData = (await userRes.json()).user;
        setUser(userData);
        sessionStorage.setItem("bravocloud_user", JSON.stringify(userData));
      }
      if (projRes.ok) {
        const projData = (await projRes.json()).project;
        setProject(projData);
        sessionStorage.setItem(`bravocloud_project_${projectId}`, JSON.stringify(projData));
      }
      setLoading(false);
    })
    .catch((err) => {
      console.error(err);
      setLoading(false);
    });
  }, [projectId]);

  useEffect(() => {
    const token = localStorage.getItem("bravocloud_token");
    if (!token || !projectId) return;

    // Instantly load from sessionStorage cache if available and skip fetch
    const cacheKey = `bravocloud_speed_insights_${projectId}_${activeMetric}`;
    const cachedDataStr = sessionStorage.getItem(cacheKey);
    
    if (cachedDataStr) {
      const data = JSON.parse(cachedDataStr);
      if (data.chartData) setChartData(data.chartData);
      if (data.thresholds) setThresholds(data.thresholds);
      if (data.topCountries) setTopCountries(data.topCountries);
      return;
    }

    setIsFetchingMetric(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    
    fetch(`${apiUrl}/api/speed-insights/${projectId}?metric=${encodeURIComponent(activeMetric)}`, {
      headers: { "Authorization": `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      sessionStorage.setItem(cacheKey, JSON.stringify(data));
      if (data.chartData) setChartData(data.chartData);
      if (data.thresholds) setThresholds(data.thresholds);
      if (data.topCountries) setTopCountries(data.topCountries);
    })
    .catch(err => console.error("Failed to load speed insights data:", err))
    .finally(() => setIsFetchingMetric(false));
    
  }, [activeMetric, projectId]);

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
            <span className="text-white">Speed Insights</span>
          </div>

          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-[#27272a]">
            <div className="flex items-start gap-5">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold tracking-tight">Speed Insights</h1>
                </div>
                <p className="text-[#a1a1aa] max-w-2xl text-sm">
                  Analyze performance metrics and Core Web Vitals for {project.name}.
                </p>
              </div>
            </div>
          </div>

          {/* Setup Banner (Hidden if tracking is active) */}
          {(thresholds.poor + thresholds.needsImprovement + thresholds.great === 0) && (
            <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-6 mb-2 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)]">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 z-0" />
              <div className="relative z-10">
                <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <Monitor className="text-purple-400" size={20} />
                  Setup Speed Insights
                </h2>
                <p className="text-sm text-[#a1a1aa] max-w-2xl">
                  Paste this snippet into the <code className="bg-[#18181b] px-1 py-0.5 rounded text-white border border-[#27272a]">&lt;head&gt;</code> of your application. It automatically loads Web Vitals to start gathering performance metrics.
                </p>
              </div>

              <div className="relative z-10 flex items-center gap-2 bg-[#18181b] border border-[#27272a] rounded-lg p-1 w-full md:w-auto">
                <div className="px-4 py-2 text-sm font-mono text-[#a1a1aa] overflow-x-auto whitespace-nowrap max-w-[300px] md:max-w-[400px]">
                  {`<script src="${process.env.NEXT_PUBLIC_FRONTEND_URL || "https://www.bravocloud.tech"}/api/analytics/script.js" data-bravocloud-id="${projectId}"></script>`}
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
          )}

          {/* Speed Insights UI Grid */}
          <div className="flex flex-col lg:flex-row gap-6 mt-2">
            
            {/* Left Metrics Sidebar */}
            <div className="w-full lg:w-64 shrink-0 flex flex-col border border-[#27272a] rounded-xl bg-[#18181b]/60 backdrop-blur-md overflow-hidden">
              {METRICS.map((metric) => (
                <button
                  key={metric}
                  onClick={() => setActiveMetric(metric)}
                  className={`p-4 text-left border-b border-[#27272a] last:border-b-0 transition-all ${activeMetric === metric ? 'bg-[#27272a] border-l-2 border-l-white' : 'hover:bg-[#27272a]/50 border-l-2 border-l-transparent'}`}
                >
                  <div className="text-sm font-semibold mb-2">{metric}</div>
                  {/* Miniature dummy bar to simulate the screenshot visual */}
                  <div className="flex items-center gap-1 opacity-50">
                    <div className="h-[2px] bg-[#a1a1aa] w-8"></div>
                    <div className="h-[2px] bg-[#a1a1aa] w-12"></div>
                    <div className="h-[2px] bg-[#a1a1aa] w-4"></div>
                  </div>
                </button>
              ))}
            </div>

            {/* Main Insights Area */}
            <div className="flex-1 flex flex-col gap-6">
              
              {/* Top Graph Section */}
              <div className="border border-[#27272a] rounded-xl bg-[#18181b]/60 backdrop-blur-md p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="text-xs text-[#a1a1aa] mb-1">Desktop</div>
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                      {activeMetric}
                      {isFetchingMetric && <svg className="animate-spin h-4 w-4 text-[#a1a1aa]" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                    </h2>
                    <p className="text-[#a1a1aa] text-sm mt-4 max-w-md">
                      Measures the overall user experience. To provide a good user experience, pages should have optimal scores.
                    </p>
                  </div>
                  
                  {/* Legend */}
                  <div className="flex items-center gap-4 text-xs text-[#a1a1aa]">
                    <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#3b82f6]"></span> P75</div>
                    <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full border border-[#52525b]"></span> P90</div>
                    <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full border border-[#52525b]"></span> P95</div>
                    <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full border border-[#52525b]"></span> P99</div>
                  </div>
                </div>

                {/* CSS Graph */}
                <div className="h-64 mt-8 relative border-b border-l border-[#27272a] flex items-end justify-between px-4 pb-0 pt-4">
                  {/* Y-axis labels */}
                  <div className="absolute left-[-28px] top-0 text-xs text-[#71717a]">100</div>
                  <div className="absolute left-[-28px] top-1/2 -translate-y-1/2 text-xs text-[#71717a]">50</div>
                  <div className="absolute left-[-20px] bottom-0 text-xs text-[#71717a]">0</div>

                  {/* Horizontal Grid lines */}
                  <div className="absolute w-full h-[1px] border-t border-dashed border-[#27272a] top-[20%] left-0 z-0"></div>
                  <div className="absolute w-full h-[1px] border-t border-dashed border-[#27272a] top-[60%] left-0 z-0"></div>

                  {/* Bars */}
                  {chartData.map((point, idx) => {
                    const maxVal = activeMetric === 'Real Experience Score' ? 100 : activeMetric === 'Cumulative Layout Shift' ? 0.2 : 2500;
                    const heightPercent = Math.max(5, (point.value / maxVal) * 100);
                    
                    return (
                      <div key={idx} className="flex flex-col items-center justify-end h-full w-full relative z-10 group">
                        {/* Tooltip */}
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-8 bg-[#27272a] text-white text-xs py-1 px-2 rounded whitespace-nowrap transition-opacity pointer-events-none z-20">
                          {point.value}
                        </div>
                        
                        {/* Bar */}
                        <div 
                          className="w-2 bg-[#3b82f6]/50 rounded-t-sm group-hover:bg-[#3b82f6] transition-all relative"
                          style={{ height: `${heightPercent}%` }}
                        >
                           {/* P75 Marker */}
                           <div className="absolute top-0 w-3 h-3 rounded-full bg-[#3b82f6] left-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-black"></div>
                        </div>
                        
                        {/* X-axis label */}
                        <div className="absolute -bottom-6 text-xs text-[#71717a] whitespace-nowrap">{point.date}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Thresholds Area */}
              <div className="border border-[#27272a] rounded-xl bg-[#18181b]/60 backdrop-blur-md overflow-hidden">
                <div className="flex items-center gap-6 px-6 pt-4 border-b border-[#27272a]">
                  <button className="pb-4 border-b-2 border-white text-sm font-semibold">Routes</button>
                  <button className="pb-4 border-b-2 border-transparent text-sm text-[#a1a1aa] hover:text-white transition-colors">Paths</button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#27272a]">
                  {/* Poor */}
                  <div className="p-6 h-40 flex flex-col">
                    <div className="flex items-center justify-between mb-auto">
                      <div className="flex items-center gap-2 text-[#ef4444] text-sm font-semibold">
                        <span className="w-4 h-4 rounded-full bg-[#ef4444]/20 flex items-center justify-center text-[10px]">!</span>
                        Poor
                      </div>
                      <div className="text-[#a1a1aa] text-xs">&lt;50</div>
                    </div>
                    {thresholds.poor > 0 ? (
                      <div className="flex flex-col items-center justify-center text-white text-3xl font-bold h-full">
                        {thresholds.poor}
                        <span className="text-xs text-[#a1a1aa] font-normal mt-1">events</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-[#71717a] text-xs gap-2 h-full">
                         <svg className="w-5 h-5 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18"/><path strokeLinecap="round" strokeLinejoin="round" d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg>
                         No data available
                      </div>
                    )}
                  </div>
                  
                  {/* Needs Improvement */}
                  <div className="p-6 h-40 flex flex-col">
                    <div className="flex items-center justify-between mb-auto">
                      <div className="flex items-center gap-2 text-[#eab308] text-sm font-semibold">
                        <span className="w-4 h-4 rounded-full bg-[#eab308]/20 flex items-center justify-center text-[10px]">!</span>
                        Needs Improvement
                      </div>
                      <div className="text-[#a1a1aa] text-xs">50 - 90</div>
                    </div>
                    {thresholds.needsImprovement > 0 ? (
                      <div className="flex flex-col items-center justify-center text-white text-3xl font-bold h-full">
                        {thresholds.needsImprovement}
                        <span className="text-xs text-[#a1a1aa] font-normal mt-1">events</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-[#71717a] text-xs gap-2 h-full">
                         <svg className="w-5 h-5 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18"/><path strokeLinecap="round" strokeLinejoin="round" d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg>
                         No data available
                      </div>
                    )}
                  </div>

                  {/* Great */}
                  <div className="p-6 h-40 flex flex-col">
                    <div className="flex items-center justify-between mb-auto">
                      <div className="flex items-center gap-2 text-[#22c55e] text-sm font-semibold">
                        <span className="w-4 h-4 rounded-full bg-[#22c55e]/20 flex items-center justify-center text-[10px]">✓</span>
                        Great
                      </div>
                      <div className="text-[#a1a1aa] text-xs">&gt;90</div>
                    </div>
                    {thresholds.great > 0 ? (
                      <div className="flex flex-col items-center justify-center text-white text-3xl font-bold h-full">
                        {thresholds.great}
                        <span className="text-xs text-[#a1a1aa] font-normal mt-1">events</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-[#71717a] text-xs gap-2 h-full">
                         <svg className="w-5 h-5 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18"/><path strokeLinecap="round" strokeLinejoin="round" d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg>
                         No data available
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Map Area */}
              <div className="border border-[#27272a] rounded-xl bg-[#18181b]/60 backdrop-blur-md overflow-hidden mb-12">
                <div className="px-6 py-4 border-b border-[#27272a] font-semibold text-sm">
                  Countries
                </div>
                <div className="flex flex-col md:flex-row">
                  <div className="w-full md:w-2/3 p-0 bg-[#09090b] flex items-center justify-center relative min-h-[300px] overflow-hidden">
                    <div className="w-full h-full opacity-60 hover:opacity-100 transition-opacity duration-500 cursor-grab active:cursor-grabbing">
                      <ComposableMap
                        projectionConfig={{ scale: 170 }}
                        width={800}
                        height={400}
                        style={{ width: "100%", height: "100%" }}
                      >
                        <ZoomableGroup 
                          zoom={1} 
                          minZoom={1} 
                          maxZoom={8}
                          translateExtent={[
                            [0, 0],
                            [800, 400]
                          ]}
                        >
                          <Geographies geography={geoUrl}>
                            {({ geographies }) =>
                              geographies.map((geo) => {
                                // Check if this country is in our topCountries list
                                const countryData = topCountries.find(
                                  (c) => c.name.toLowerCase() === geo.properties.name.toLowerCase()
                                );

                                // Color based on score if data exists
                                let fillColor = "#27272a"; // Default dark gray
                                if (countryData) {
                                  if (countryData.score > 90) fillColor = "#22c55e"; // Green
                                  else if (countryData.score >= 50) fillColor = "#eab308"; // Yellow
                                  else fillColor = "#ef4444"; // Red
                                }

                                return (
                                  <Geography
                                    key={geo.rsmKey}
                                    geography={geo}
                                    fill={fillColor}
                                    stroke="#18181b"
                                    strokeWidth={0.5}
                                    style={{
                                      default: { outline: "none" },
                                      hover: { fill: "#3f3f46", outline: "none" },
                                      pressed: { outline: "none" },
                                    }}
                                  />
                                );
                              })
                            }
                          </Geographies>
                        </ZoomableGroup>
                      </ComposableMap>
                    </div>
                  </div>
                  
                  <div className="w-full md:w-1/3 border-l border-[#27272a] flex flex-col">
                    <div className="flex items-center justify-between p-4 border-b border-[#27272a] hover:bg-[#27272a]/20 cursor-pointer">
                      <div className="flex items-center gap-2 text-[#ef4444] text-sm font-semibold">
                        <span className="text-[#71717a] mr-2">&gt;</span>
                        <span className="w-4 h-4 rounded-full bg-[#ef4444]/20 flex items-center justify-center text-[10px]">!</span>
                        Poor
                      </div>
                      <div className="text-[#a1a1aa] text-xs">&lt;50</div>
                    </div>
                    
                    <div className="flex items-center justify-between p-4 border-b border-[#27272a] hover:bg-[#27272a]/20 cursor-pointer">
                      <div className="flex items-center gap-2 text-[#eab308] text-sm font-semibold">
                        <span className="text-[#71717a] mr-2">&gt;</span>
                        <span className="w-4 h-4 rounded-full bg-[#eab308]/20 flex items-center justify-center text-[10px]">!</span>
                        Needs Improvement
                      </div>
                      <div className="text-[#a1a1aa] text-xs">50 - 90</div>
                    </div>

                    <div className="flex flex-col border-b border-[#27272a]">
                      <div className="flex items-center justify-between p-4 bg-[#27272a]/20 cursor-pointer">
                        <div className="flex items-center gap-2 text-[#22c55e] text-sm font-semibold">
                          <span className="text-[#71717a] mr-2">v</span>
                          <span className="w-4 h-4 rounded-full bg-[#22c55e]/20 flex items-center justify-center text-[10px]">✓</span>
                          Great
                        </div>
                        <div className="text-[#a1a1aa] text-xs">&gt;90</div>
                      </div>
                      <div className="p-4 flex flex-col gap-3 text-sm">
                        {topCountries.length > 0 ? topCountries.map((c, i) => (
                          <div key={i} className="flex justify-between items-center text-[#e4e4e7]">
                            <span>{c.name}</span>
                            <span className="font-mono">{c.score}</span>
                          </div>
                        )) : (
                          <div className="text-[#71717a] text-xs text-center py-4">No country data available</div>
                        )}
                      </div>
                    </div>
                    
                  </div>
                </div>
                <div className="px-6 py-3 border-t border-[#27272a] flex justify-between items-center text-xs text-[#71717a]">
                  <span>Data points collected</span>
                  <span>Updated just now</span>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
