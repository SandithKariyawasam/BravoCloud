"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { GitMerge, Save, Loader2, FileCode2, CheckCircle2 } from "lucide-react";
import BackgroundAnimation from "../../../../components/BackgroundAnimation";
import Sidebar from "../../../../components/Sidebar";

export default function ProjectWorkflowsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const router = useRouter();
  
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  const defaultYaml = `version: "1.0"\nproject:\n  name: "your-project-name"\n  framework: "docker"\nbuild:\n  command: "npm run build"\n  outputDirectory: "dist"\ndeploy:\n  autoDeploy: true\n  branch: "main"\n`;

  const [workflowYaml, setWorkflowYaml] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
      setWorkflowYaml(proj.workflowYaml || defaultYaml);
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
        setWorkflowYaml(projData.workflowYaml || defaultYaml);
        sessionStorage.setItem(`bravocloud_project_${projectId}`, JSON.stringify(projData));
      }
      setLoading(false);
    })
    .catch((err) => {
      console.error(err);
      setLoading(false);
    });
  }, [projectId]);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setSaved(false);
    
    const token = localStorage.getItem("bravocloud_token");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    try {
      const res = await fetch(`${apiUrl}/api/projects/${projectId}/workflow`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ workflowYaml })
      });

      if (res.ok) {
        if (project) {
          const updatedProject = { ...project, workflowYaml };
          setProject(updatedProject);
          sessionStorage.setItem(`bravocloud_project_${projectId}`, JSON.stringify(updatedProject));
        }
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to save workflow.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while saving.");
    } finally {
      setIsSaving(false);
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
            <p className="mt-4 text-[#a1a1aa] text-sm">Loading workflows...</p>
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
              <span className="text-white">Workflows</span>
            </div>
            
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[#27272a]">
              <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Workflows</h1>
                <p className="text-[#a1a1aa] max-w-2xl text-sm">
                  Customize your build and deployment pipeline using the <code className="text-amber-500 bg-[#18181b] px-1.5 py-0.5 rounded border border-[#27272a]">bravocloud.yml</code> configuration file.
                </p>
              </div>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="bg-white text-black px-6 py-2 rounded-md font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : (saved ? <CheckCircle2 size={16} className="text-green-600" /> : <Save size={16} />)}
                {isSaving ? "Saving..." : (saved ? "Saved" : "Save Changes")}
              </button>
            </div>
          </div>

          {/* IDE Editor */}
          <div className="bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden shadow-2xl flex flex-col">
            {/* Editor Header */}
            <div className="bg-[#121214] border-b border-[#27272a] px-4 py-3 flex items-center gap-3">
              <FileCode2 size={18} className="text-amber-500" />
              <span className="font-mono text-sm font-semibold text-[#e4e4e7]">bravocloud.yml</span>
              {project.workflowYaml ? (
                <span className="ml-auto text-xs text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">Custom Configuration</span>
              ) : (
                <span className="ml-auto text-xs text-[#a1a1aa] bg-[#27272a] px-2 py-0.5 rounded-full border border-[#3f3f46]">Default Template</span>
              )}
            </div>
            
            {/* Editor Textarea */}
            <div className="relative group">
              <div className="absolute top-0 bottom-0 left-0 w-12 bg-[#121214] border-r border-[#27272a] flex flex-col items-center pt-4 select-none">
                {/* Mock Line Numbers */}
                {workflowYaml.split('\n').map((_, i) => (
                  <div key={i} className="text-[#3f3f46] text-sm font-mono leading-6">{i + 1}</div>
                ))}
              </div>
              <textarea 
                value={workflowYaml}
                onChange={(e) => setWorkflowYaml(e.target.value)}
                spellCheck={false}
                className="w-full min-h-[500px] bg-[#09090b] text-[#e4e4e7] font-mono text-sm p-4 pl-16 leading-6 focus:outline-none resize-y"
                placeholder="Paste your YAML configuration here..."
              />
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
