"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Settings, Save, AlertTriangle, Trash2, Loader2, Info } from "lucide-react";
import BackgroundAnimation from "../../../../components/BackgroundAnimation";
import Sidebar from "../../../../components/Sidebar";

export default function ProjectSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const router = useRouter();

  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Form State
  const [name, setName] = useState("");
  const [framework, setFramework] = useState("nextjs");
  const [buildCommand, setBuildCommand] = useState("");
  const [outputDirectory, setOutputDirectory] = useState("");
  const [installCommand, setInstallCommand] = useState("");
  const [rootDir, setRootDir] = useState("./");

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);

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
          setName(data.project.name || "");
          setFramework(data.project.framework || "nextjs");
          setBuildCommand(data.project.buildCommand || "");
          setOutputDirectory(data.project.outputDirectory || "");
          setInstallCommand(data.project.installCommand || "");
          setRootDir(data.project.rootDir || "./");
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
          name, framework, buildCommand, outputDirectory, installCommand, rootDir
        })
      });

      const data = await res.json();
      if (res.ok) {
        setProject(data.project);
        sessionStorage.setItem(`bravocloud_project_${projectId}`, JSON.stringify(data.project));
        setSaveMessage("Settings saved successfully.");
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

  const handleDelete = async () => {
    if (deleteInput !== project.name) return;

    setDeleting(true);
    const token = localStorage.getItem("bravocloud_token");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    try {
      const res = await fetch(`${apiUrl}/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        sessionStorage.removeItem(`bravocloud_project_${projectId}`);
        router.push("/dashboard");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete project.");
        setDeleting(false);
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting project.");
      setDeleting(false);
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
            <p className="mt-4 text-[#a1a1aa] text-sm">Loading settings...</p>
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
              <span className="text-white">Settings</span>
            </div>

            <div className="flex flex-col gap-2 pb-6 border-b border-[#27272a]">
              <h1 className="text-3xl font-bold tracking-tight">General Settings</h1>
              <p className="text-[#a1a1aa] max-w-2xl text-sm">
                Manage your project details, build configurations, and danger zone actions.
              </p>
            </div>
          </div>

          {/* Project Name Card */}
          <div className="bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-[#27272a]">
              <h3 className="text-xl font-semibold text-white mb-1">Project Name</h3>
              <p className="text-[#a1a1aa] text-sm mb-4">
                Used to identify your project on the dashboard. Changing this will not affect your `.bravocloud.app` subdomain.
              </p>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full max-w-md bg-[#18181b] border border-[#3f3f46] text-white px-4 py-2 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* Build Settings Card */}
          <div className="bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-[#27272a]">
              <h3 className="text-xl font-semibold text-white mb-1">Build & Development Settings</h3>
              <p className="text-[#a1a1aa] text-sm mb-6">
                When you push a new commit, BravoCloud automatically detects your framework and runs the build process. You can override the default commands here.
              </p>

              <div className="space-y-6 max-w-xl">
                <div>
                  <label className="block text-sm font-medium text-[#e4e4e7] mb-2">Framework Preset</label>
                  <select
                    value={framework}
                    onChange={(e) => setFramework(e.target.value)}
                    className="w-full bg-[#18181b] border border-[#3f3f46] text-white px-4 py-2 rounded-lg focus:outline-none focus:border-blue-500 transition-colors appearance-none"
                  >
                    <option value="nextjs">Next.js</option>
                    <option value="react">React (Create React App)</option>
                    <option value="vue">Vue.js</option>
                    <option value="svelte">Svelte</option>
                    <option value="nodejs">Node.js / Express</option>
                    <option value="html">Static HTML</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#e4e4e7] mb-2">Root Directory</label>
                  <input
                    type="text"
                    value={rootDir}
                    onChange={(e) => setRootDir(e.target.value)}
                    placeholder="./"
                    className="w-full bg-[#18181b] border border-[#3f3f46] text-white px-4 py-2 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-sm"
                  />
                  <p className="text-xs text-[#71717a] mt-2">The directory within your repository where your code is located.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#e4e4e7] mb-2">Build Command</label>
                  <input
                    type="text"
                    value={buildCommand}
                    onChange={(e) => setBuildCommand(e.target.value)}
                    placeholder="`npm run build` or `yarn build`"
                    className="w-full bg-[#18181b] border border-[#3f3f46] text-white px-4 py-2 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#e4e4e7] mb-2">Output Directory</label>
                  <input
                    type="text"
                    value={outputDirectory}
                    onChange={(e) => setOutputDirectory(e.target.value)}
                    placeholder="`out`, `dist`, or `build`"
                    className="w-full bg-[#18181b] border border-[#3f3f46] text-white px-4 py-2 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#e4e4e7] mb-2">Install Command</label>
                  <input
                    type="text"
                    value={installCommand}
                    onChange={(e) => setInstallCommand(e.target.value)}
                    placeholder="`npm install` or `yarn install`"
                    className="w-full bg-[#18181b] border border-[#3f3f46] text-white px-4 py-2 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-sm"
                  />
                </div>
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
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="mt-8 border border-red-900/50 rounded-xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-red-900/50 bg-[#1a0505]">
              <h3 className="text-xl font-semibold text-red-500 mb-1 flex items-center gap-2">
                <AlertTriangle size={20} /> Danger Zone
              </h3>
              <p className="text-[#a1a1aa] text-sm mb-6">
                Permanently delete this project from BravoCloud. This action will automatically tear down all associated infrastructure, including databases, buckets, and compute containers.
              </p>

              <button
                onClick={() => setShowDeleteModal(true)}
                className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500 px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Delete Project
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#09090b] border border-[#27272a] rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-2">Delete Project</h3>
              <p className="text-[#a1a1aa] text-sm mb-6 leading-relaxed">
                This action cannot be undone. This will permanently delete the <strong className="text-white">{project.name}</strong> project, its deployments, and tear down all associated AWS databases and storage.
              </p>

              <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
                <Info size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-200 leading-relaxed">
                  Data stored in AWS S3 and RDS will be destroyed immediately. No final snapshots will be taken.
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-[#e4e4e7] mb-2">
                  Please type <strong className="text-red-400 select-none">{project.name}</strong> to confirm.
                </label>
                <input
                  type="text"
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  className="w-full bg-[#18181b] border border-[#3f3f46] text-white px-4 py-2 rounded-lg focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteInput("");
                  }}
                  className="px-4 py-2 text-[#a1a1aa] hover:text-white transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteInput !== project.name || deleting}
                  className="bg-red-500 hover:bg-red-600 disabled:bg-red-500/30 disabled:text-white/50 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  {deleting ? "Deleting..." : "I understand, delete this project"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
