"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, Globe, Shield, Zap, Code, CheckCircle2 } from "lucide-react";
import BackgroundAnimation from "../../../../../components/BackgroundAnimation";
import Sidebar from "../../../../../components/Sidebar";

export default function EdgeNetworkSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const router = useRouter();
  
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Form State
  const [enabled, setEnabled] = useState(false);
  const [cachePolicy, setCachePolicy] = useState("Static Optimized");
  const [geoRestrictionType, setGeoRestrictionType] = useState("none");
  const [geoCountries, setGeoCountries] = useState("");
  const [edgeFunctionCode, setEdgeFunctionCode] = useState("");

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
          
          if (data.project.edgeNetwork) {
            setEnabled(data.project.edgeNetwork.enabled || false);
            setCachePolicy(data.project.edgeNetwork.cachePolicy || "Static Optimized");
            setGeoRestrictionType(data.project.edgeNetwork.geoRestriction?.type || "none");
            setGeoCountries((data.project.edgeNetwork.geoRestriction?.countries || []).join(", "));
            setEdgeFunctionCode(data.project.edgeNetwork.edgeFunctions?.code || "");
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

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage("");
    const token = localStorage.getItem("bravocloud_token");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    const countriesArray = geoCountries.split(",").map(c => c.trim().toUpperCase()).filter(c => c.length === 2);

    const edgeNetwork = {
      enabled,
      cachePolicy,
      geoRestriction: {
        type: geoRestrictionType,
        countries: geoRestrictionType === 'none' ? [] : countriesArray
      },
      edgeFunctions: {
        code: edgeFunctionCode
      }
    };

    try {
      const res = await fetch(`${apiUrl}/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ edgeNetwork })
      });

      const data = await res.json();
      if (res.ok) {
        setProject(data.project);
        sessionStorage.setItem(`bravocloud_project_${projectId}`, JSON.stringify(data.project));
        setSaveMessage("CloudFront CDN & Edge Functions provisioning initiated!");
        setTimeout(() => setSaveMessage(""), 5000);
      } else {
        alert(data.error || "Failed to provision Edge Network.");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving Edge Network settings.");
    } finally {
      setSaving(false);
    }
  };

  const defaultFunctionTemplate = `function handler(event) {
  var request = event.request;
  var headers = request.headers;

  // Add a custom header
  headers['x-bravocloud-edge'] = { value: 'executed-at-edge' };

  return request;
}`;

  if (loading) {
    return (
      <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
        <Sidebar user={user} />
        <div className="flex-1 flex flex-col relative bg-black p-8">
          <BackgroundAnimation />
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
            <p className="mt-4 text-[#a1a1aa] text-sm">Loading edge settings...</p>
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
              <span className="text-white">Edge Network</span>
            </div>
            
            <div className="flex flex-col gap-2 pb-6 border-b border-[#27272a]">
              <h1 className="text-3xl font-bold tracking-tight">Edge Network</h1>
              <p className="text-[#a1a1aa] max-w-2xl text-sm mt-1">
                Distribute your application globally using Amazon CloudFront. Configure global caching, geographic access restrictions, and deploy custom JavaScript directly to Edge locations.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            
            {/* Enable Toggle */}
            <div className="bg-[#09090b] border border-[#27272a] p-6 rounded-xl shadow-lg flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Globe size={18} className="text-blue-400" /> Enable Edge CDN
                </h3>
                <p className="text-[#a1a1aa] text-sm mt-1">
                  Routes all incoming traffic through Amazon CloudFront's global edge network to minimize latency.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                <div className="w-11 h-6 bg-[#27272a] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Cache Policy */}
            <div className={`bg-[#09090b] border border-[#27272a] p-6 rounded-xl shadow-lg transition-opacity ${!enabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Zap size={18} className="text-yellow-400" /> Cache Policy
              </h3>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <label className={`flex-1 cursor-pointer border rounded-lg p-4 transition-colors ${cachePolicy === 'Static Optimized' ? 'bg-blue-600/10 border-blue-500' : 'bg-[#121214] border-[#3f3f46] hover:border-[#71717a]'}`}>
                    <input type="radio" name="cachePolicy" value="Static Optimized" className="sr-only" checked={cachePolicy === 'Static Optimized'} onChange={(e) => setCachePolicy(e.target.value)} />
                    <div className="font-medium text-white mb-1">Static Optimized (Recommended)</div>
                    <div className="text-sm text-[#a1a1aa]">Caches static assets (images, CSS, JS) at edge locations globally.</div>
                  </label>
                  <label className={`flex-1 cursor-pointer border rounded-lg p-4 transition-colors ${cachePolicy === 'Dynamic Content' ? 'bg-blue-600/10 border-blue-500' : 'bg-[#121214] border-[#3f3f46] hover:border-[#71717a]'}`}>
                    <input type="radio" name="cachePolicy" value="Dynamic Content" className="sr-only" checked={cachePolicy === 'Dynamic Content'} onChange={(e) => setCachePolicy(e.target.value)} />
                    <div className="font-medium text-white mb-1">Dynamic Content</div>
                    <div className="text-sm text-[#a1a1aa]">Bypasses caching. Forwards all requests directly to the backend.</div>
                  </label>
                </div>
              </div>
            </div>

            {/* Geo Restrictions */}
            <div className={`bg-[#09090b] border border-[#27272a] p-6 rounded-xl shadow-lg transition-opacity ${!enabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Shield size={18} className="text-red-400" /> Geographic Restrictions
              </h3>
              <div className="space-y-4">
                <select
                  value={geoRestrictionType}
                  onChange={(e) => setGeoRestrictionType(e.target.value)}
                  className="w-full bg-[#121214] border border-[#3f3f46] rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="none">Allow All Countries</option>
                  <option value="whitelist">Whitelist (Only allow specific countries)</option>
                  <option value="blacklist">Blacklist (Block specific countries)</option>
                </select>

                {geoRestrictionType !== 'none' && (
                  <div>
                    <label className="block text-sm font-medium text-[#a1a1aa] mb-1">Country Codes (ISO 3166-1 alpha-2)</label>
                    <input 
                      type="text" 
                      value={geoCountries} 
                      onChange={(e) => setGeoCountries(e.target.value.toUpperCase())}
                      placeholder="e.g. US, GB, CA, FR"
                      className="w-full bg-[#121214] border border-[#3f3f46] rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <p className="text-xs text-[#71717a] mt-2">Enter comma-separated 2-letter country codes.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Edge Functions */}
            <div className={`bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden shadow-lg transition-opacity ${!enabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="p-6 border-b border-[#27272a]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Code size={18} className="text-emerald-400" /> Edge Functions (CloudFront Functions)
                  </h3>
                  <button 
                    onClick={() => setEdgeFunctionCode(defaultFunctionTemplate)}
                    className="text-xs bg-[#27272a] hover:bg-[#3f3f46] text-white px-2 py-1 rounded transition-colors"
                  >
                    Load Template
                  </button>
                </div>
                <p className="text-[#a1a1aa] text-sm mb-4">
                  Execute lightweight JavaScript functions directly at AWS edge locations. Perfect for header manipulation, URL rewrites, or edge authentication before traffic reaches your backend.
                </p>
                
                <textarea
                  value={edgeFunctionCode}
                  onChange={(e) => setEdgeFunctionCode(e.target.value)}
                  placeholder="function handler(event) { ... }"
                  className="w-full h-48 bg-[#121214] border border-[#3f3f46] rounded-md px-4 py-3 text-[#e4e4e7] text-sm font-mono focus:outline-none focus:border-emerald-500 transition-colors"
                  spellCheck="false"
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-between mt-8">
              <span className="text-emerald-500 text-sm font-medium flex items-center gap-2">
                {saveMessage && <CheckCircle2 size={16} />} {saveMessage}
              </span>
              <button 
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? "Provisioning Edge Network..." : "Save Edge Configuration"}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
