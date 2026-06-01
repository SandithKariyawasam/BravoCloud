"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp, Plus, X, GitBranch, Settings, Info, Eye, Lock, EyeOff, Globe, Box } from "lucide-react";

interface Repo {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  htmlUrl: string;
  description: string;
  language: string;
  updatedAt: string;
}

interface ProjectConfigModalProps {
  repo: Repo;
  onClose: () => void;
}

export default function ProjectConfigModal({ repo, onClose }: ProjectConfigModalProps) {
  const [buildSettingsOpen, setBuildSettingsOpen] = useState(false);
  const [envVarsOpen, setEnvVarsOpen] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [showEnvValue, setShowEnvValue] = useState(false);

  // Form State
  const [projectName, setProjectName] = useState(repo.name.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
  const [framework, setFramework] = useState("Next.js");
  const [rootDir, setRootDir] = useState("./");

  // Build Overrides
  const [overrideBuildCmd, setOverrideBuildCmd] = useState(false);
  const [overrideOutputDir, setOverrideOutputDir] = useState(false);
  const [overrideInstallCmd, setOverrideInstallCmd] = useState(false);

  const [envVars, setEnvVars] = useState([{ key: "", value: "" }]);

  const handleDeploy = () => {
    setDeploying(true);
    // Simulated deployment
    setTimeout(() => {
      // Could close or transition to a success state here
    }, 3000);
  };

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: "", value: "" }]);
  };

  const updateEnvVar = (index: number, field: 'key' | 'value', val: string) => {
    const newVars = [...envVars];
    newVars[index][field] = val;
    setEnvVars(newVars);
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-center items-start overflow-y-auto bg-black/60 backdrop-blur-sm pt-12 pb-24">
      {/* Modal Container */}
      <div className="w-full max-w-3xl bg-[#0a0a0a] border border-[#27272a] rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col relative animate-slide-up-fade">

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-[#a1a1aa] hover:text-white hover:bg-[#27272a] rounded-md transition-all"
        >
          <X size={20} />
        </button>

        {/* Header Content */}
        <div className="p-8 border-b border-[#27272a]/50">
          <h2 className="text-3xl font-bold text-white mb-6">New Project</h2>

          <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-[#a1a1aa] text-xs font-semibold mb-1 uppercase tracking-wider">Importing from GitHub</span>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                <span className="text-white font-semibold">{repo.fullName}</span>
                <div className="flex items-center gap-1.5 ml-3 text-[#a1a1aa] bg-[#27272a]/50 px-2.5 py-1 rounded-md text-sm border border-[#27272a]">
                  <GitBranch size={14} />
                  <span>main</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className="p-8 flex flex-col gap-8">

          {/* Project Details */}
          <div className="flex flex-col gap-6">
            <p className="text-sm font-medium text-white/90">Choose where you want to create the project and give it a name.</p>

            <div className="grid grid-cols-1 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-[#a1a1aa] ml-1">Project Name</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="bg-black border border-[#27272a] rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all font-medium"
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-[#27272a]/50 w-full" />

          {/* Framework Preset & Root Dir */}
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-[#a1a1aa] ml-1">Application Preset</label>
              <FrameworkSelect value={framework} onChange={setFramework} />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-[#a1a1aa] ml-1">Root Directory</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={rootDir}
                  onChange={(e) => setRootDir(e.target.value)}
                  className="bg-black border border-[#27272a] rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all flex-1 font-mono"
                />
                <button className="px-4 py-2.5 text-sm font-semibold bg-[#18181b] border border-[#27272a] text-white rounded-lg hover:bg-[#27272a] transition-all">
                  Edit
                </button>
              </div>
            </div>
          </div>

          {/* Collapsible Overrides */}
          <div className="flex flex-col gap-4">

            {/* Build Settings */}
            <div className="border border-[#27272a] rounded-lg overflow-hidden bg-black">
              <button
                onClick={() => setBuildSettingsOpen(!buildSettingsOpen)}
                className="w-full flex items-center gap-3 p-4 hover:bg-[#18181b] transition-colors"
              >
                {buildSettingsOpen ? <ChevronUp size={16} className="text-[#a1a1aa]" /> : <ChevronDown size={16} className="text-[#a1a1aa]" />}
                <span className="text-sm font-medium text-white">Build and Output Settings</span>
              </button>

              {buildSettingsOpen && (
                <div className="p-5 border-t border-[#27272a] flex flex-col gap-5 bg-[#18181b]/30">

                  {/* Build Command */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-[#a1a1aa] ml-1">
                      Build Command <Info size={12} className="text-[#71717a]" />
                    </div>
                    <div className="flex items-center gap-3 bg-black border border-[#27272a] rounded-lg p-2 focus-within:border-white transition-all">
                      <input
                        type="text"
                        placeholder="`npm run build` or `react-scripts build`"
                        disabled={!overrideBuildCmd}
                        className="bg-transparent flex-1 text-sm text-white focus:outline-none font-mono disabled:opacity-50"
                      />
                      <ToggleSwitch checked={overrideBuildCmd} onChange={() => setOverrideBuildCmd(!overrideBuildCmd)} />
                    </div>
                  </div>

                  {/* Output Directory */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-[#a1a1aa] ml-1">
                      Output Directory <Info size={12} className="text-[#71717a]" />
                    </div>
                    <div className="flex items-center gap-3 bg-black border border-[#27272a] rounded-lg p-2 focus-within:border-white transition-all">
                      <input
                        type="text"
                        placeholder="build"
                        disabled={!overrideOutputDir}
                        className="bg-transparent flex-1 text-sm text-white focus:outline-none font-mono disabled:opacity-50"
                      />
                      <ToggleSwitch checked={overrideOutputDir} onChange={() => setOverrideOutputDir(!overrideOutputDir)} />
                    </div>
                  </div>

                  {/* Install Command */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-[#a1a1aa] ml-1">
                      Install Command <Info size={12} className="text-[#71717a]" />
                    </div>
                    <div className="flex items-center gap-3 bg-black border border-[#27272a] rounded-lg p-2 focus-within:border-white transition-all">
                      <input
                        type="text"
                        placeholder="`yarn install` or `npm install`"
                        disabled={!overrideInstallCmd}
                        className="bg-transparent flex-1 text-sm text-white focus:outline-none font-mono disabled:opacity-50"
                      />
                      <ToggleSwitch checked={overrideInstallCmd} onChange={() => setOverrideInstallCmd(!overrideInstallCmd)} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Environment Variables */}
            <div className="border border-[#27272a] rounded-lg overflow-hidden bg-black">
              <button
                onClick={() => setEnvVarsOpen(!envVarsOpen)}
                className="w-full flex items-center gap-3 p-4 hover:bg-[#18181b] transition-colors"
              >
                {envVarsOpen ? <ChevronUp size={16} className="text-[#a1a1aa]" /> : <ChevronDown size={16} className="text-[#a1a1aa]" />}
                <span className="text-sm font-medium text-white">Environment Variables</span>
              </button>

              {envVarsOpen && (
                <div className="p-5 border-t border-[#27272a] flex flex-col gap-5 bg-[#18181b]/30">
                  {envVars.map((env, i) => (
                    <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-[#27272a] p-3 rounded-lg bg-black">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-[#a1a1aa]">Key</label>
                        <input
                          type="text"
                          placeholder="EXAMPLE_NAME"
                          value={env.key}
                          onChange={(e) => updateEnvVar(i, 'key', e.target.value)}
                          className="bg-black border border-[#27272a] rounded-md p-2 text-sm text-white focus:outline-none focus:border-[#71717a] font-mono"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5 relative">
                        <label className="text-xs font-medium text-[#a1a1aa]">Value</label>
                        <div className="relative flex items-center">
                          <input
                            type={showEnvValue ? "text" : "password"}
                            value={env.value}
                            onChange={(e) => updateEnvVar(i, 'value', e.target.value)}
                            className="bg-black border border-[#27272a] rounded-md p-2 pr-20 text-sm text-white focus:outline-none focus:border-[#71717a] w-full font-mono"
                          />
                          <div className="absolute right-2 flex items-center gap-2">
                            <button onClick={() => setShowEnvValue(!showEnvValue)} className="text-[#71717a] hover:text-white transition-colors">
                              {showEnvValue ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                            <Lock size={12} className="text-[#a1a1aa]" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="flex flex-col gap-2 mt-2">
                    <label className="text-xs font-medium text-[#a1a1aa]">Environments</label>
                    <div className="flex items-center justify-between bg-black border border-[#27272a] rounded-lg p-2.5 hover:border-[#3f3f46] transition-colors cursor-pointer">
                      <div className="flex items-center gap-2 text-sm text-white">
                        <Globe size={14} className="text-[#a1a1aa]" />
                        <span>Production and Preview</span>
                      </div>
                      <ChevronDown size={14} className="text-[#a1a1aa]" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-4 border-t border-[#27272a]">
                    <div className="flex items-center gap-3">
                      <button className="px-3 py-1.5 text-xs font-semibold bg-[#18181b] border border-[#27272a] text-white rounded hover:bg-[#27272a] transition-colors">
                        Import .env
                      </button>
                      <span className="text-xs text-[#71717a]">
                        or paste the .env contents <a href="#" className="text-[#3b82f6] hover:underline">Learn more</a>
                      </span>
                    </div>
                    <button
                      onClick={addEnvVar}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#18181b] border border-[#27272a] text-white rounded hover:bg-[#27272a] transition-colors"
                    >
                      <Plus size={14} />
                      Add More
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Deploy Button */}
          <button
            onClick={handleDeploy}
            disabled={deploying}
            className={`w-full py-3.5 rounded-lg text-black font-semibold text-sm transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] flex items-center justify-center gap-2 ${deploying
              ? 'bg-gray-400 cursor-not-allowed opacity-80'
              : 'bg-white hover:bg-gray-200 hover:scale-[1.01]'
              }`}
          >
            {deploying ? (
              <>
                <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                Deploying...
              </>
            ) : "Deploy"}
          </button>
        </div>

        {/* Deployment Visualization Footer */}
        <div className="border-t border-[#27272a] bg-black rounded-b-xl p-8 relative overflow-hidden min-h-[250px] flex flex-col items-center">
          <div className="w-full relative z-10 flex flex-col">
            <h3 className="text-2xl font-bold text-white mb-2">Deployment</h3>
            <p className="text-[#a1a1aa] text-sm">
              {deploying ? "Building your project. This may take a moment..." : "Once you're ready, start deploying to see the progress here.."}
            </p>
          </div>

          {/* Decorative World Icon Graphic */}
          <div className="absolute -bottom-[200px] left-1/2 -translate-x-1/2 pointer-events-none overflow-visible flex items-center justify-center">
            <Globe
              size={500}
              strokeWidth={0.5}
              className={`text-[#3b82f6] ${deploying ? 'opacity-40 shadow-blue-500/50 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'opacity-10'}`}
              style={{
                animation: deploying ? 'spin 4s linear infinite, pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'spin 60s linear infinite'
              }}
            />
          </div>

          {deploying && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
              <div className="flex flex-col items-center gap-4 bg-[#18181b] border border-[#27272a] rounded-xl p-6 shadow-2xl animate-scale-in">
                <div className="flex gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" />
                </div>
                <div className="text-sm font-mono text-[#a1a1aa]">
                  [1/4] Resolving packages...
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// Simple internal toggle switch component
function ToggleSwitch({ checked, onChange }: { checked: boolean, onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`w-9 h-5 rounded-full relative transition-colors ${checked ? 'bg-white' : 'bg-[#27272a]'}`}
    >
      <div
        className={`w-3.5 h-3.5 bg-black rounded-full absolute top-[3px] transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-[3px]'}`}
      />
    </button>
  );
}

type FrameworkOption = {
  value: string;
  label: string;
  icon: string | null;
  badge?: "Experimental" | "Not available";
};

const frameworkOptions: FrameworkOption[] = [
  { value: "Angular", label: "Angular", icon: "https://cdn.simpleicons.org/angular" },
  { value: "Astro", label: "Astro", icon: "https://cdn.simpleicons.org/astro", badge: "Not available" },
  { value: "React", label: "React", icon: "https://cdn.simpleicons.org/react" },
  { value: "Django", label: "Django", icon: "https://cdn.simpleicons.org/django" },
  { value: "Docusaurus (v1)", label: "Docusaurus (v1)", icon: "https://cdn.simpleicons.org/docusaurus", badge: "Not available" },
  { value: "Docusaurus (v2+)", label: "Docusaurus (v2+)", icon: "https://cdn.simpleicons.org/docusaurus", badge: "Not available" },
  { value: "Ember.js", label: "Ember.js", icon: "https://cdn.simpleicons.org/emberdotjs", badge: "Not available" },
  { value: "Express", label: "Express", icon: "https://cdn.simpleicons.org/express/white" },
  { value: "FastAPI", label: "FastAPI", icon: "https://cdn.simpleicons.org/fastapi", badge: "Not available" },
  { value: "Fastify", label: "Fastify", icon: "https://cdn.simpleicons.org/fastify/white", badge: "Not available" },
  { value: "Flask", label: "Flask", icon: "https://cdn.simpleicons.org/flask/white", badge: "Not available" },
  { value: "Gatsby.js", label: "Gatsby.js", icon: "https://cdn.simpleicons.org/gatsby", badge: "Not available" },
  { value: "Go", label: "Go", icon: "https://cdn.simpleicons.org/go" },
  { value: "Gridsome", label: "Gridsome", icon: "https://cdn.simpleicons.org/gridsome", badge: "Not available" },
  { value: "Hexo", label: "Hexo", icon: "https://cdn.simpleicons.org/hexo", badge: "Not available" },
  { value: "Hugo", label: "Hugo", icon: "https://cdn.simpleicons.org/hugo", badge: "Not available" },
  { value: "Ionic Angular", label: "Ionic Angular", icon: "https://cdn.simpleicons.org/ionic", badge: "Not available" },
  { value: "Ionic React", label: "Ionic React", icon: "https://cdn.simpleicons.org/ionic", badge: "Not available" },
  { value: "Jekyll", label: "Jekyll", icon: "https://cdn.simpleicons.org/jekyll", badge: "Not available" },
  { value: "Koa", label: "Koa", icon: "https://cdn.simpleicons.org/koa/white", badge: "Not available" },
  { value: "NestJS", label: "NestJS", icon: "https://cdn.simpleicons.org/nestjs" },
  { value: "Next.js", label: "Next.js", icon: "https://cdn.simpleicons.org/nextdotjs/white" },
  { value: "Node", label: "Node", icon: "https://cdn.simpleicons.org/nodedotjs" },
  { value: "Polymer", label: "Polymer", icon: "https://cdn.simpleicons.org/polymerproject", badge: "Not available" },
  { value: "Preact", label: "Preact", icon: "https://cdn.simpleicons.org/preact", badge: "Not available" },
  { value: "Python", label: "Python", icon: "https://cdn.simpleicons.org/python" },
  { value: "React Router", label: "React Router", icon: "https://cdn.simpleicons.org/reactrouter" },
  { value: "RedwoodJS", label: "RedwoodJS", icon: "https://cdn.simpleicons.org/redwoodjs", badge: "Not available" },
  { value: "Remix", label: "Remix", icon: "https://cdn.simpleicons.org/remix", badge: "Not available" },
  { value: "Sanity", label: "Sanity", icon: "https://cdn.simpleicons.org/sanity", badge: "Not available" },
  { value: "Sanity (v3)", label: "Sanity (v3)", icon: "https://cdn.simpleicons.org/sanity", badge: "Not available" },
  { value: "SolidStart (v0)", label: "SolidStart (v0)", icon: "https://cdn.simpleicons.org/solid", badge: "Not available" },
  { value: "SolidStart (v1)", label: "SolidStart (v1)", icon: "https://cdn.simpleicons.org/solid", badge: "Not available" },
  { value: "Stencil", label: "Stencil", icon: "https://cdn.simpleicons.org/stencil", badge: "Not available" },
  { value: "Storybook", label: "Storybook", icon: "https://cdn.simpleicons.org/storybook", badge: "Not available" },
  { value: "Svelte", label: "Svelte", icon: "https://cdn.simpleicons.org/svelte", badge: "Not available" },
  { value: "SvelteKit", label: "SvelteKit", icon: "https://cdn.simpleicons.org/svelte", badge: "Not available" },
  { value: "SvelteKit (v0)", label: "SvelteKit (v0)", icon: "https://cdn.simpleicons.org/svelte", badge: "Not available" },
  { value: "Vite", label: "Vite", icon: "https://cdn.simpleicons.org/vite" },
  { value: "VitePress", label: "VitePress", icon: "https://cdn.simpleicons.org/vite" },
  { value: "Vue.js", label: "Vue.js", icon: "https://cdn.simpleicons.org/vuedotjs" },
  { value: "VuePress", label: "VuePress", icon: "https://cdn.simpleicons.org/vuedotjs", badge: "Experimental" },
];

function FrameworkSelect({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = frameworkOptions.find(o => o.value === value) || frameworkOptions[0];

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div
        className="w-full flex items-center justify-between bg-black border border-[#27272a] rounded-lg p-2.5 text-sm text-white hover:border-[#3f3f46] transition-all cursor-pointer font-medium"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          {selectedOption.icon ? (
            <div className="relative w-5 h-5 flex-none">
              <img src={selectedOption.icon} alt={selectedOption.label} className="w-5 h-5 object-contain absolute inset-0" onError={(e) => { e.currentTarget.style.display = 'none'; const sibling = e.currentTarget.nextElementSibling as HTMLElement; if (sibling) { sibling.classList.remove('hidden'); sibling.classList.add('flex'); } }} />
              <div className="hidden w-5 h-5 bg-[#27272a] rounded-md absolute inset-0 items-center justify-center">
                <Box size={12} className="text-[#a1a1aa]" />
              </div>
            </div>
          ) : (
            <div className="w-5 h-5 bg-[#27272a] rounded-md flex-none flex items-center justify-center">
              <Box size={12} className="text-[#a1a1aa]" />
            </div>
          )}
          <span>{selectedOption.label}</span>
        </div>
        <ChevronDown size={14} className={`text-[#a1a1aa] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 max-h-60 overflow-y-auto bg-[#18181b] border border-[#27272a] rounded-lg shadow-xl py-1">
          {frameworkOptions.map((opt) => (
            <div
              key={opt.value}
              className={`flex items-center justify-between px-3 py-2.5 transition-colors ${value === opt.value ? 'bg-[#27272a]/50' : ''} ${opt.badge === 'Not available' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-[#27272a]'}`}
              onClick={() => {
                if (opt.badge !== 'Not available') {
                  onChange(opt.value); setIsOpen(false);
                }
              }}
            >
              <div className="flex items-center gap-3">
                {opt.icon ? (
                  <div className="relative w-5 h-5 flex-none">
                    <img src={opt.icon} alt={opt.label} className="w-5 h-5 object-contain absolute inset-0" onError={(e) => { e.currentTarget.style.display = 'none'; const sibling = e.currentTarget.nextElementSibling as HTMLElement; if (sibling) { sibling.classList.remove('hidden'); sibling.classList.add('flex'); } }} />
                    <div className="hidden w-5 h-5 bg-[#27272a] rounded-md absolute inset-0 items-center justify-center">
                      <Box size={12} className="text-[#a1a1aa]" />
                    </div>
                  </div>
                ) : (
                  <div className="w-5 h-5 bg-[#27272a] rounded-md flex-none flex items-center justify-center">
                    <Box size={12} className="text-[#a1a1aa]" />
                  </div>
                )}
                <span className="text-sm text-white">{opt.label}</span>
              </div>

              {opt.badge && (
                <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${opt.badge === 'Experimental'
                  ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                  : 'bg-red-500/10 text-red-500 border border-red-500/20'
                  }`}>
                  {opt.badge}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
