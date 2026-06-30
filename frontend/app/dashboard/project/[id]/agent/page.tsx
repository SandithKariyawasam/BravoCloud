"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";
import BackgroundAnimation from "@/app/components/BackgroundAnimation";
import { Loader2 } from "lucide-react";
import { useConfirm } from "@/app/components/ConfirmContext";

export default function ProjectAgentPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const router = useRouter();
  const confirm = useConfirm();

  const [user, setUser] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [agentId, setAgentId] = useState("");
  const [agents, setAgents] = useState<any[]>([]);
  
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("bravocloud_token");
    if (!token) {
      router.push("/auth/login");
      return;
    }

    const cachedUser = sessionStorage.getItem("bravocloud_user");
    const cachedProject = sessionStorage.getItem(`bravocloud_project_${projectId}`);
    
    if (cachedUser && cachedProject) {
      setUser(JSON.parse(cachedUser));
      const proj = JSON.parse(cachedProject);
      setProject(proj);
      setAgentId(proj.agentId || "");
      setLoading(false);
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    const fetchData = async () => {
      try {
        const userRes = await fetch(`${apiUrl}/auth/me`, { headers: { "Authorization": `Bearer ${token}` } });
        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData);
          sessionStorage.setItem("bravocloud_user", JSON.stringify(userData));
        }

        const projRes = await fetch(`${apiUrl}/api/projects/${projectId}`, { headers: { "Authorization": `Bearer ${token}` } });
        if (projRes.ok) {
          const data = await projRes.json();
          setProject(data.project);
          setAgentId(data.project.agentId || "");
          sessionStorage.setItem(`bravocloud_project_${projectId}`, JSON.stringify(data.project));
        }

        const agentsRes = await fetch(`${apiUrl}/api/agents`, { headers: { "Authorization": `Bearer ${token}` } });
        if (agentsRes.ok) {
          const data = await agentsRes.json();
          setAgents(data.agents || []);
        }

        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };

    fetchData();
  }, [projectId, router]);

  const handleSave = async () => {
    if (project && project.agentId !== agentId && (project.agentId || agentId)) {
      const isAwsToLocal = !project.agentId && agentId;
      const confirmMsg = isAwsToLocal 
        ? "WARNING: Transferring to a Local Agent will shut down the existing AWS compute infrastructure. Proceed?"
        : "WARNING: Transferring away from this Local Agent will kill the running project process on that machine. Proceed?";
      if (!(await confirm(confirmMsg))) return;
    }

    setSaving(true);
    setSaveMessage("");
    const token = localStorage.getItem("bravocloud_token");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    try {
      const res = await fetch(`${apiUrl}/api/projects/${projectId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ agentId })
      });

      if (res.ok) {
        const isTransfer = project && project.agentId !== agentId;
        
        if (project) {
          const updatedProject = { ...project, agentId };
          setProject(updatedProject);
          sessionStorage.setItem(`bravocloud_project_${projectId}`, JSON.stringify(updatedProject));
        }
        
        if (isTransfer) {
          setSaveMessage("Routing updated! Please trigger a Redeploy in the Deployments tab to apply this change.");
          setTimeout(() => setSaveMessage(""), 8000);
        } else {
          setSaveMessage("Agent routing settings saved.");
          setTimeout(() => setSaveMessage(""), 3000);
        }
      } else {
        alert("Failed to save settings.");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
        <Sidebar user={user} />
        <div className="flex-1 flex flex-col relative bg-black p-8">
          <BackgroundAnimation />
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
            <p className="mt-4 text-[#a1a1aa] text-sm">Loading agent settings...</p>
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
              <span className="text-white">Agent</span>
            </div>

            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-[#27272a]">
              <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Build Agent Routing</h1>
                <p className="text-[#a1a1aa] max-w-2xl text-sm">
                  Control where your project runs and builds. Choose between BravoCloud Managed Infrastructure or route builds directly to your private self-hosted machines.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden shadow-2xl">
            <div className="p-6 bg-[#121214]">
              <h3 className="text-lg font-semibold mb-4">Execution Environment</h3>
              <p className="text-[#a1a1aa] text-sm mb-6">
                Assign a specific agent to handle the compilation, building, and serving of this project.
              </p>
              
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-[2]">
                  <div className="flex gap-4">
                    <select
                      value={agentId}
                      onChange={(e) => setAgentId(e.target.value)}
                      className="w-full bg-[#18181b] border border-[#27272a] rounded-md px-4 py-2 text-sm text-white focus:outline-none focus:border-[#3f3f46] font-mono appearance-none"
                    >
                      <option value="">AWS CodeBuild (BravoCloud Managed)</option>
                      {agents.map((agent: any) => (
                        <option key={agent.id} value={agent.id}>
                          Self-Hosted: {agent.name} ({agent.status})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="bg-white text-black hover:bg-gray-200 px-6 py-2 rounded-md font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap text-sm"
                    >
                      {saving ? <Loader2 size={16} className="animate-spin" /> : "Save"}
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-[#71717a]">
                      When a self-hosted agent is selected, code is cloned, built, and hosted directly on the targeted machine, bypassing AWS infrastructure entirely.
                    </p>
                    {saveMessage && <span className="text-emerald-500 text-xs font-medium ml-2">{saveMessage}</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
