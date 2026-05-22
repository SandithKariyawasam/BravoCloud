"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Database, HardDrive, Trash2, CheckCircle2, Copy, AlertCircle, Loader2 } from "lucide-react";
import BackgroundAnimation from "../../../../components/BackgroundAnimation";
import Sidebar from "../../../../components/Sidebar";

export default function ProjectStoragePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const router = useRouter();
  
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  const [storageItems, setStorageItems] = useState<any[]>([]);
  const [provisioning, setProvisioning] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("bravocloud_token");
    if (!token) {
      window.location.href = "/";
      return;
    }

    const cachedUser = sessionStorage.getItem("bravocloud_user");
    const cachedProject = sessionStorage.getItem(`bravocloud_project_${projectId}`);
    
    if (cachedUser && cachedProject) {
      setUser(JSON.parse(cachedUser));
      const proj = JSON.parse(cachedProject);
      setProject(proj);
      setStorageItems(proj.storage || []);
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
        setStorageItems(projData.storage || []);
        sessionStorage.setItem(`bravocloud_project_${projectId}`, JSON.stringify(projData));
      }
      setLoading(false);
    })
    .catch((err) => {
      console.error(err);
      setLoading(false);
    });
  }, [projectId]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleProvision = async (type: string) => {
    if (provisioning) return;
    setProvisioning(type);
    
    const token = localStorage.getItem("bravocloud_token");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    try {
      const res = await fetch(`${apiUrl}/api/projects/${projectId}/storage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ type })
      });

      const data = await res.json();
      if (res.ok) {
        setStorageItems(data.storage);
        if (project) {
          const updatedProject = { ...project, storage: data.storage, envVars: data.envVars };
          setProject(updatedProject);
          sessionStorage.setItem(`bravocloud_project_${projectId}`, JSON.stringify(updatedProject));
        }
      } else {
        alert(data.error || "Failed to provision storage.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while provisioning.");
    } finally {
      setProvisioning(null);
    }
  };

  const handleDelete = async (storageId: string) => {
    if (!confirm(`Are you sure you want to remove this storage resource? Note: This deletes the database permanently.`)) return;
    
    const token = localStorage.getItem("bravocloud_token");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    try {
      const res = await fetch(`${apiUrl}/api/projects/${projectId}/storage/${storageId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      if (res.ok) {
        setStorageItems(data.storage);
        if (project) {
          const updatedProject = { ...project, storage: data.storage };
          setProject(updatedProject);
          sessionStorage.setItem(`bravocloud_project_${projectId}`, JSON.stringify(updatedProject));
        }
      } else {
        alert(data.error || "Failed to delete storage.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while deleting.");
    }
  };

  const storageOptions = [
    {
      type: "postgres",
      name: "PostgreSQL Database",
      desc: "Serverless, reliable, secure PostgreSQL databases.",
      logo: "https://upload.wikimedia.org/wikipedia/commons/2/29/Postgresql_elephant.svg",
      glowColor: "via-blue-500",
      blurColor: "from-blue-500",
      invert: false
    },
    {
      type: "redis",
      name: "Redis Cache",
      desc: "High-performance, scalable in-memory Redis caching.",
      logo: "https://raw.githubusercontent.com/devicons/devicon/master/icons/redis/redis-original.svg",
      glowColor: "via-red-500",
      blurColor: "from-red-500",
      invert: false
    },
    {
      type: "s3",
      name: "Object Storage",
      desc: "Serverless, reliable, secure AWS Object storage.",
      logo: "https://upload.wikimedia.org/wikipedia/commons/9/93/Amazon_Web_Services_Logo.svg",
      glowColor: "via-amber-500",
      blurColor: "from-amber-500",
      invert: true // Invert the AWS logo so it's white/light instead of black on dark theme
    }
  ];

  if (loading) {
    return (
      <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
        <Sidebar user={user} />
        <div className="flex-1 flex flex-col relative bg-black p-8">
          <BackgroundAnimation />
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
            <p className="mt-4 text-[#a1a1aa] text-sm">Loading storage...</p>
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

        <div className="max-w-6xl mx-auto flex flex-col gap-6 relative z-10 w-full mt-4">
          {/* Header */}
          <div className="mb-2">
            <div className="flex items-center gap-2 text-sm text-[#71717a] font-medium mb-6">
              <button onClick={() => router.push('/dashboard')} className="hover:text-white transition-colors">Dashboard</button>
              <span>/</span>
              <button onClick={() => router.push(`/dashboard/project/${project.id}`)} className="hover:text-white transition-colors">{project.name}</button>
              <span>/</span>
              <span className="text-white">Storage</span>
            </div>
            
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-[#27272a]">
              <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Storage</h1>
                <p className="text-[#a1a1aa] max-w-2xl text-sm">
                  Provision AWS databases and object storage. Credentials are automatically injected into your project's environment.
                </p>
              </div>
            </div>
          </div>

          {/* Marketplace Provisioning */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {storageOptions.map((opt) => (
              <button 
                key={opt.type}
                onClick={() => handleProvision(opt.type)}
                disabled={provisioning !== null}
                className="group relative bg-[#09090b] border border-[#27272a] rounded-xl p-6 flex flex-col items-center justify-center min-h-[240px] hover:border-[#3f3f46] transition-all duration-300 shadow-xl overflow-hidden text-left"
              >
                {/* Top Gradient Line */}
                <div className={`absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent ${opt.glowColor} to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-500`}></div>
                
                {/* Top Glow Blur */}
                <div className={`absolute top-0 inset-x-0 h-24 bg-gradient-to-b ${opt.blurColor} to-transparent opacity-10 group-hover:opacity-30 transition-opacity duration-500 blur-2xl pointer-events-none`}></div>

                {/* Badge */}
                <div className="absolute top-4 left-4 bg-[#18181b] border border-[#27272a] text-[#e4e4e7] px-3 py-1 rounded-full text-xs font-semibold z-10 shadow-sm">
                  Storage
                </div>

                {/* Spinner or Logo */}
                {provisioning === opt.type ? (
                  <div className="flex-1 flex flex-col items-center justify-center mt-8">
                    <Loader2 className="w-10 h-10 text-white animate-spin mb-4" />
                    <span className="text-[#a1a1aa] text-sm">Provisioning...</span>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 flex items-center justify-center mt-8 mb-4 z-10 w-full">
                      <img 
                        src={opt.logo} 
                        alt={opt.name} 
                        className={`h-12 w-auto object-contain filter ${opt.invert ? 'invert brightness-0 brightness-150' : ''} group-hover:scale-105 transition-transform duration-500 drop-shadow-xl`} 
                      />
                    </div>
                    <p className="text-[#a1a1aa] text-sm text-center max-w-[220px] z-10 group-hover:text-[#e4e4e7] transition-colors">{opt.desc}</p>
                  </>
                )}
              </button>
            ))}
          </div>

          {/* Attached Resources */}
          <div>
            <h2 className="text-xl font-bold tracking-tight mb-4">Connected Resources</h2>
            {storageItems.length === 0 ? (
              <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-12 text-center text-[#71717a] flex flex-col items-center">
                <Database size={48} className="mb-4 opacity-50" />
                <p>No storage resources connected to this project.</p>
                <p className="text-xs mt-2">Provision a database or bucket above to get started.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {storageItems.map((item: any, index: number) => (
                  <div key={index} className="bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden shadow-xl">
                    <div className="p-5 border-b border-[#27272a] bg-[#121214] flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-[#18181b] border border-[#27272a] rounded-lg flex items-center justify-center">
                          {item.type === 'postgres' ? <Database className="text-blue-500" size={20} /> :
                           item.type === 'redis' ? <HardDrive className="text-red-500" size={20} /> :
                           <Database className="text-yellow-500" size={20} />}
                        </div>
                        <div>
                          <h4 className="font-bold">{item.name}</h4>
                          <div className="flex items-center gap-2 text-xs text-[#a1a1aa] mt-1">
                            <span className="capitalize">{item.type}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-emerald-500">
                              <CheckCircle2 size={12} /> {item.status || "Active"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="text-[#71717a] hover:text-red-500 transition-colors bg-[#18181b] border border-[#27272a] p-2 rounded-md"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    
                    <div className="p-5 bg-[#09090b]">
                      <h5 className="text-sm font-semibold mb-3 text-[#e4e4e7]">Injected Environment Variables</h5>
                      <div className="space-y-3">
                        {item.type === 's3' && (
                          <>
                            <EnvRow name="AWS_S3_BUCKET_NAME" value={item.id} copied={copied} onCopy={copyToClipboard} />
                            <EnvRow name="AWS_REGION" value={item.region} copied={copied} onCopy={copyToClipboard} />
                          </>
                        )}
                        {item.type === 'postgres' && (
                          <>
                            <EnvRow name="POSTGRES_URL" value={`postgresql://postgres:********@${item.endpoint}:5432/postgres`} copied={copied} onCopy={copyToClipboard} isSecret />
                            <EnvRow name="POSTGRES_HOST" value={item.endpoint} copied={copied} onCopy={copyToClipboard} />
                          </>
                        )}
                        {item.type === 'redis' && (
                          <EnvRow name="REDIS_URL" value={`redis://${item.endpoint}:6379`} copied={copied} onCopy={copyToClipboard} />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}

function EnvRow({ name, value, copied, onCopy, isSecret = false }: { name: string, value: string, copied: string | null, onCopy: (text: string, id: string) => void, isSecret?: boolean }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-4 items-center bg-[#18181b] border border-[#27272a] rounded-md p-3">
      <div className="text-xs font-semibold text-[#71717a] font-mono">{name}</div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-mono text-white truncate max-w-md">{isSecret ? "************************" : value}</span>
        <button onClick={() => onCopy(value, name)} className="text-[#71717a] hover:text-white transition-colors p-1">
          {copied === name ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}
