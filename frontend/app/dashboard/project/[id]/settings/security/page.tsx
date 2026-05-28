"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, Shield, Lock, ShieldAlert, Plus, X, Globe } from "lucide-react";
import BackgroundAnimation from "../../../../../components/BackgroundAnimation";
import Sidebar from "../../../../../components/Sidebar";

export default function SecuritySettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const router = useRouter();
  
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Form State
  const [passwordProtection, setPasswordProtection] = useState(false);
  const [accessPassword, setAccessPassword] = useState("");
  
  const [ipAccessMode, setIpAccessMode] = useState("allow_all");
  const [ipList, setIpList] = useState<string[]>([]);
  const [newIp, setNewIp] = useState("");

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
          setPasswordProtection(data.project.passwordProtection || false);
          setAccessPassword(data.project.accessPassword || "");
          setIpAccessMode(data.project.ipAccessMode || "allow_all");
          setIpList(data.project.ipList || []);
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

    try {
      const res = await fetch(`${apiUrl}/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          passwordProtection, accessPassword, ipAccessMode, ipList
        })
      });

      const data = await res.json();
      if (res.ok) {
        setProject(data.project);
        sessionStorage.setItem(`bravocloud_project_${projectId}`, JSON.stringify(data.project));
        setSaveMessage("Security settings saved successfully.");
        setTimeout(() => setSaveMessage(""), 3000);
      } else {
        alert(data.error || "Failed to update settings.");
      }
    } catch (err) {
      console.error(err);
      alert("Error updating settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddIp = () => {
    if (newIp && !ipList.includes(newIp)) {
      setIpList([...ipList, newIp]);
      setNewIp("");
    }
  };

  const handleRemoveIp = (ipToRemove: string) => {
    setIpList(ipList.filter(ip => ip !== ipToRemove));
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
        <Sidebar user={user} />
        <div className="flex-1 flex flex-col relative bg-black p-8">
          <BackgroundAnimation />
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
            <p className="mt-4 text-[#a1a1aa] text-sm">Loading security settings...</p>
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
              <span className="text-white">Security</span>
            </div>
            
            <div className="flex flex-col gap-2 pb-6 border-b border-[#27272a]">
              <h1 className="text-3xl font-bold tracking-tight">Security & Access</h1>
              <p className="text-[#a1a1aa] max-w-2xl text-sm">
                Configure AWS Web Application Firewalls (WAF) and restrict access to your deployments.
              </p>
            </div>
          </div>

          {/* Password Protection */}
          <div className="bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-[#27272a]">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Lock size={20} className="text-[#71717a]" /> Password Protection
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#a1a1aa]">{passwordProtection ? 'Enabled' : 'Disabled'}</span>
                  <div 
                    onClick={() => setPasswordProtection(!passwordProtection)}
                    className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${passwordProtection ? 'bg-emerald-500' : 'bg-[#27272a]'}`}
                  >
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${passwordProtection ? 'translate-x-4' : ''}`} />
                  </div>
                </div>
              </div>
              <p className="text-[#a1a1aa] text-sm mb-6">
                Require a password to access your `.bravocloud.tech` domain. Perfect for staging environments or internal tools.
              </p>
              
              {passwordProtection && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="block text-sm font-medium text-[#e4e4e7] mb-2">Access Password</label>
                  <input 
                    type="text" 
                    value={accessPassword} 
                    onChange={(e) => setAccessPassword(e.target.value)}
                    placeholder="Enter a secure password..."
                    className="w-full max-w-md bg-[#18181b] border border-[#3f3f46] text-white px-4 py-2 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              )}
            </div>
          </div>

          {/* WAF IP Access Control */}
          <div className="bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-[#27272a]">
              <h3 className="text-xl font-semibold text-white mb-1 flex items-center gap-2">
                <ShieldAlert size={20} className="text-[#71717a]" /> IP Access Control (AWS WAF)
              </h3>
              <p className="text-[#a1a1aa] text-sm mb-6">
                Powered by AWS WAF. Block malicious actors or restrict access to specific office or VPN IP addresses before traffic even reaches your containers.
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-[#e4e4e7] mb-2">Access Mode</label>
                  <select 
                    value={ipAccessMode} 
                    onChange={(e) => setIpAccessMode(e.target.value)}
                    className="w-full max-w-md bg-[#18181b] border border-[#3f3f46] text-white px-4 py-2 rounded-lg focus:outline-none focus:border-blue-500 transition-colors appearance-none"
                  >
                    <option value="allow_all">Allow All Traffic (Default)</option>
                    <option value="allow_specific">Allow Only Specific IPs (Block all others)</option>
                    <option value="block_specific">Block Specific IPs (Allow all others)</option>
                  </select>
                </div>

                {ipAccessMode !== "allow_all" && (
                  <div className="animate-in fade-in slide-in-from-top-2 border border-[#27272a] rounded-lg p-4 bg-[#121214]">
                    <label className="block text-sm font-medium text-[#e4e4e7] mb-2">
                      {ipAccessMode === "allow_specific" ? "Allowed IPs (CIDR Notation)" : "Blocked IPs (CIDR Notation)"}
                    </label>
                    <div className="flex items-center gap-2 mb-4">
                      <input 
                        type="text" 
                        value={newIp}
                        onChange={(e) => setNewIp(e.target.value)}
                        placeholder="e.g. 192.168.1.1 or 10.0.0.0/24"
                        className="flex-1 bg-[#18181b] border border-[#3f3f46] text-white px-4 py-2 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-sm"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddIp();
                          }
                        }}
                      />
                      <button 
                        onClick={handleAddIp}
                        disabled={!newIp}
                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                      >
                        <Plus size={16} /> Add
                      </button>
                    </div>

                    {ipList.length > 0 ? (
                      <ul className="space-y-2">
                        {ipList.map((ip) => (
                          <li key={ip} className="flex items-center justify-between bg-[#18181b] border border-[#27272a] px-3 py-2 rounded-lg">
                            <div className="flex items-center gap-2">
                              <Globe size={14} className="text-[#71717a]" />
                              <span className="font-mono text-sm text-[#e4e4e7]">{ip}</span>
                            </div>
                            <button 
                              onClick={() => handleRemoveIp(ip)}
                              className="text-[#a1a1aa] hover:text-red-500 transition-colors"
                            >
                              <X size={16} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[#71717a] text-sm italic">No IP addresses added yet.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-[#121214] p-4 flex items-center justify-between">
              <span className="text-emerald-500 text-sm font-medium">{saveMessage}</span>
              <button 
                onClick={handleSave}
                disabled={saving}
                className="bg-white text-black hover:bg-gray-200 px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? "Saving WAF Rules..." : "Save Security Rules"}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
