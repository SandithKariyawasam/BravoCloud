"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid, Box, List, Activity, Gauge, Eye, Shield, Globe,
  Variable, Globe2, Plug, Database, ToggleLeft, Cpu, Network, Maximize,
  GitMerge, PieChart, LifeBuoy, Settings, ChevronRight, ChevronLeft,
  BookOpen, AlertTriangle, RefreshCw, Zap, Image as ImageIcon, ExternalLink,
  Sparkles, Circle, ListTodo, Wrench, ListOrdered, KeyRound, UserRound,
  Puzzle, BarChart3, MessageSquare
} from "lucide-react";

interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

interface SidebarProps {
  user?: UserProfile | null;
  isDropdownOpen?: boolean;
  setIsDropdownOpen?: (isOpen: boolean) => void;
  onLogout?: () => void;
}

const BYOKIcon = () => (
  <div className="relative w-4 h-4 flex items-center justify-center opacity-90">
    <UserRound size={12} className="absolute left-0 bottom-0 text-current" />
    <KeyRound size={9} className="absolute right-0 top-0 text-current" />
  </div>
);

export default function Sidebar({ user, isDropdownOpen, setIsDropdownOpen, onLogout }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isProjectView = pathname?.includes('/dashboard/project/');
  const projectId = isProjectView ? pathname.split('/')[3] : null;
  const isDeploymentsPage = pathname?.endsWith('/deployments');
  const isLogsPage = pathname?.endsWith('/logs');
  const isAnalyticsPage = pathname?.endsWith('/analytics');
  const isSpeedInsightsPage = pathname?.endsWith('/speed-insights');
  const isEnvPage = pathname?.endsWith('/env');
  
  const [view, setView] = useState<"main" | "observability" | "ai-gateway" | "settings">("main");
  const [isMounted, setIsMounted] = useState(false);
  const [activeItem, setActiveItem] = useState<string>(() => {
    if (isDeploymentsPage) return "Deployments";
    if (isLogsPage) return "Logs";
    if (isAnalyticsPage) return "Analytics";
    if (isSpeedInsightsPage) return "Speed Insights";
    if (isEnvPage) return "Environment Variables";
    if (pathname === '/dashboard' || (isProjectView && !isDeploymentsPage && !isLogsPage && !isAnalyticsPage && !isSpeedInsightsPage && !isEnvPage)) {
      return isProjectView ? "Overview" : "Projects";
    }
    return "Projects";
  });

  // Sync active item with URL
  useEffect(() => {
    setIsMounted(true);
    if (isDeploymentsPage) {
      setActiveItem("Deployments");
    } else if (isLogsPage) {
      setActiveItem("Logs");
    } else if (isAnalyticsPage) {
      setActiveItem("Analytics");
    } else if (isSpeedInsightsPage) {
      setActiveItem("Speed Insights");
    } else if (isEnvPage) {
      setActiveItem("Environment Variables");
    } else if (pathname === '/dashboard' || (isProjectView && !isDeploymentsPage && !isLogsPage && !isAnalyticsPage && !isSpeedInsightsPage && !isEnvPage)) {
      setActiveItem(isProjectView ? "Overview" : "Projects");
    }
  }, [pathname, isDeploymentsPage, isLogsPage, isAnalyticsPage, isSpeedInsightsPage, isProjectView]);
  const [activeObsItem, setActiveObsItem] = useState<string>("Overview");
  const [activeAIItem, setActiveAIItem] = useState<string>("Overview");
  const [activeSettingsItem, setActiveSettingsItem] = useState<string>("General");
  const [searchQuery, setSearchQuery] = useState("");

  const q = searchQuery.toLowerCase();

  const handleSelect = (newView: typeof view, setActiveFn?: (val: string) => void, val?: string) => {
    setView(newView);
    if (setActiveFn && val) setActiveFn(val);
    setSearchQuery("");
  };

  return (
    <div className="w-64 flex flex-col h-screen overflow-hidden bg-black border-r border-[#27272a]/40">
      {/* Search (Permanently Shown) */}
      <div className="p-3 bg-black z-10 border-b border-transparent">
        <div className="flex items-center bg-[#18181b] border border-[#27272a] rounded-md px-3 py-1.5 transition-all focus-within:border-[#3f3f46] focus-within:bg-[#18181b] group">
          <input
            type="text"
            placeholder="Find..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-sm text-[#a1a1aa] placeholder-[#71717a] outline-none flex-1 font-medium"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-sidebar-scrollbar pb-4">
        {/* MAIN VIEW */}
        {(q || view === "main") && (
          <nav className={`px-2 space-y-0.5 ${!q && "mt-1"}`}>
            <SidebarItem icon={<LayoutGrid size={16} />} label={isProjectView ? "Overview" : "Projects"} active={!q && view === "main" && (activeItem === "Projects" || activeItem === "Overview")} onClick={() => {
              handleSelect("main", setActiveItem, isProjectView ? "Overview" : "Projects");
              if (isProjectView && projectId) {
                router.push(`/dashboard/project/${projectId}`);
              } else {
                router.push('/dashboard');
              }
            }} q={q} category="Main" />
            <SidebarItem icon={<Box size={16} />} label="Deployments" active={!q && view === "main" && activeItem === "Deployments"} onClick={() => {
              handleSelect("main", setActiveItem, "Deployments");
              if (isProjectView && projectId) {
                router.push(`/dashboard/project/${projectId}/deployments`);
              } else {
                router.push('/dashboard/deployments');
              }
            }} q={q} category="Main" />
            {isProjectView && (
              <>
                <SidebarItem icon={<List size={16} />} label="Logs" active={!q && view === "main" && activeItem === "Logs"} onClick={() => {
                  handleSelect("main", setActiveItem, "Logs");
                  if (projectId) {
                    router.push(`/dashboard/project/${projectId}/logs`);
                  }
                }} q={q} category="Main" />
                <SidebarItem icon={<PieChart size={16} />} label="Analytics" active={!q && view === "main" && activeItem === "Analytics"} onClick={() => {
                  handleSelect("main", setActiveItem, "Analytics");
                  if (projectId) {
                    router.push(`/dashboard/project/${projectId}/analytics`);
                  }
                }} q={q} category="Main" />
                <SidebarItem icon={<Gauge size={16} />} label="Speed Insights" active={!q && view === "main" && activeItem === "Speed Insights"} onClick={() => {
                  handleSelect("main", setActiveItem, "Speed Insights");
                  if (projectId) {
                    router.push(`/dashboard/project/${projectId}/speed-insights`);
                  }
                }} q={q} category="Main" />
              </>
            )}
            <SidebarItem icon={<Eye size={16} />} label="Observability" badge="Soon" q={q} category="Main" />
            <SidebarItem icon={<Shield size={16} />} label="Firewall" badge="Soon" q={q} category="Main" />
            <SidebarItem icon={<Globe size={16} />} label="CDN" badge="Soon" q={q} category="Main" />

            {!q && <div className="h-px bg-[#27272a]/50 my-3 mx-2" />}

            <SidebarItem icon={<Variable size={16} />} label="Environment Variables" active={!q && view === "main" && activeItem === "Environment Variables"} onClick={() => {
              handleSelect("main", setActiveItem, "Environment Variables");
              if (projectId) {
                router.push(`/dashboard/project/${projectId}/env`);
              }
            }} q={q} category="Main" />
            <SidebarItem icon={<Globe2 size={16} />} label="Domains" active={!q && view === "main" && activeItem === "Domains"} onClick={() => handleSelect("main", setActiveItem, "Domains")} q={q} category="Main" />
            <SidebarItem icon={<Plug size={16} />} label="Integrations" active={!q && view === "main" && activeItem === "Integrations"} onClick={() => handleSelect("main", setActiveItem, "Integrations")} q={q} category="Main" />
            <SidebarItem icon={<Database size={16} />} label="Storage" active={!q && view === "main" && activeItem === "Storage"} onClick={() => handleSelect("main", setActiveItem, "Storage")} q={q} category="Main" />
            <SidebarItem icon={<Cpu size={16} />} label="Agent" hasArrow active={!q && view === "main" && activeItem === "Agent"} onClick={() => handleSelect("main", setActiveItem, "Agent")} q={q} category="Main" />
            <SidebarItem icon={<Network size={16} />} label="AI Gateway" hasArrow onClick={() => handleSelect("ai-gateway")} q={q} category="Main" />
            <SidebarItem icon={<GitMerge size={16} />} label="Workflows" active={!q && view === "main" && activeItem === "Workflows"} onClick={() => handleSelect("main", setActiveItem, "Workflows")} q={q} category="Main" />

            {!q && <div className="h-px bg-[#27272a]/50 my-3 mx-2" />}

            <SidebarItem icon={<PieChart size={16} />} label="Usage" active={!q && view === "main" && activeItem === "Usage"} onClick={() => handleSelect("main", setActiveItem, "Usage")} q={q} category="Main" />
            <SidebarItem icon={<LifeBuoy size={16} />} label="Support" active={!q && view === "main" && activeItem === "Support"} onClick={() => handleSelect("main", setActiveItem, "Support")} q={q} category="Main" />
            <SidebarItem icon={<Settings size={16} />} label="Settings" hasArrow onClick={() => handleSelect("settings")} q={q} category="Main" />
          </nav>
        )}

        {/* OBSERVABILITY VIEW */}
        {(q || view === "observability") && (
          <nav className="px-2 space-y-0.5">
            {!q && (
              <div className="flex items-center px-2 py-2 text-white border-b border-[#27272a]/40 mb-2 relative min-h-[45px]">
                <button onClick={() => setView("main")} className="absolute left-1 p-1 hover:bg-[#18181b] rounded-md transition-all text-[#a1a1aa] hover:text-white">
                  <ChevronLeft size={16} />
                </button>
                <span className="font-semibold text-sm mx-auto tracking-wide">Observability</span>
              </div>
            )}

            <SidebarItem icon={<LayoutGrid size={16} />} label="Overview" active={!q && view === "observability" && activeObsItem === "Overview"} onClick={() => handleSelect("observability", setActiveObsItem, "Overview")} q={q} category="Observability" />
            <SidebarItem icon={<Activity size={16} />} label="Query" active={!q && view === "observability" && activeObsItem === "Query"} onClick={() => handleSelect("observability", setActiveObsItem, "Query")} q={q} category="Observability" />
            <SidebarItem icon={<BookOpen size={16} />} label="Notebooks" active={!q && view === "observability" && activeObsItem === "Notebooks"} onClick={() => handleSelect("observability", setActiveObsItem, "Notebooks")} q={q} category="Observability" />
            <SidebarItem icon={<AlertTriangle size={16} />} label="Alerts" active={!q && view === "observability" && activeObsItem === "Alerts"} onClick={() => handleSelect("observability", setActiveObsItem, "Alerts")} q={q} category="Observability" />

            {!q && <div className="px-3 pt-4 pb-1 text-[10px] font-bold text-[#71717a] tracking-widest uppercase">Compute</div>}

            <SidebarItem icon={<div className="w-4 h-4 rounded border border-current flex items-center justify-center font-mono text-[10px] leading-none font-bold opacity-80">f</div>} label="Functions" active={!q && view === "observability" && activeObsItem === "Functions"} onClick={() => handleSelect("observability", setActiveObsItem, "Functions")} q={q} category="Observability" />
            <SidebarItem icon={<Globe size={16} />} label="External APIs" active={!q && view === "observability" && activeObsItem === "External APIs"} onClick={() => handleSelect("observability", setActiveObsItem, "External APIs")} q={q} category="Observability" />
            <SidebarItem icon={<div className="w-4 h-4 rounded border border-current flex items-center justify-center font-mono text-[10px] leading-none font-bold opacity-80">m</div>} label="Middleware" active={!q && view === "observability" && activeObsItem === "Middleware"} onClick={() => handleSelect("observability", setActiveObsItem, "Middleware")} q={q} category="Observability" />

            {!q && <div className="px-3 pt-4 pb-1 text-[10px] font-bold text-[#71717a] tracking-widest uppercase">CDN</div>}

            <SidebarItem icon={<Globe size={16} />} label="Edge Requests" active={!q && view === "observability" && activeObsItem === "Edge Requests"} onClick={() => handleSelect("observability", setActiveObsItem, "Edge Requests")} q={q} category="Observability" />
            <SidebarItem icon={<RefreshCw size={16} />} label="ISR" active={!q && view === "observability" && activeObsItem === "ISR"} onClick={() => handleSelect("observability", setActiveObsItem, "ISR")} q={q} category="Observability" />
            <SidebarItem icon={<Zap size={16} />} label="Fast Data Transfer" active={!q && view === "observability" && activeObsItem === "Fast Data Transfer"} onClick={() => handleSelect("observability", setActiveObsItem, "Fast Data Transfer")} q={q} category="Observability" />
            <SidebarItem icon={<ImageIcon size={16} />} label="Image Optimization" active={!q && view === "observability" && activeObsItem === "Image Optimization"} onClick={() => handleSelect("observability", setActiveObsItem, "Image Optimization")} q={q} category="Observability" />
            <SidebarItem icon={<ExternalLink size={16} />} label="External Origins" active={!q && view === "observability" && activeObsItem === "External Origins"} onClick={() => handleSelect("observability", setActiveObsItem, "External Origins")} q={q} category="Observability" />
            <SidebarItem icon={<Network size={16} />} label="Microfrontends" active={!q && view === "observability" && activeObsItem === "Microfrontends"} onClick={() => handleSelect("observability", setActiveObsItem, "Microfrontends")} q={q} category="Observability" />

            {!q && <div className="px-3 pt-4 pb-1 text-[10px] font-bold text-[#71717a] tracking-widest uppercase">Services</div>}

            <SidebarItem icon={<Sparkles size={16} />} label="AI" active={!q && view === "observability" && activeObsItem === "AI"} onClick={() => handleSelect("observability", setActiveObsItem, "AI")} q={q} category="Observability" />
            <SidebarItem icon={<Circle size={16} />} label="Blob" active={!q && view === "observability" && activeObsItem === "Blob"} onClick={() => handleSelect("observability", setActiveObsItem, "Blob")} q={q} category="Observability" />
            <SidebarItem icon={<ListTodo size={16} />} label="Queues" badge="Beta" active={!q && view === "observability" && activeObsItem === "Queues"} onClick={() => handleSelect("observability", setActiveObsItem, "Queues")} q={q} category="Observability" />
          </nav>
        )}

        {/* AI GATEWAY VIEW */}
        {(q || view === "ai-gateway") && (
          <nav className="px-2 space-y-0.5">
            {!q && (
              <div className="flex items-center px-2 py-2 text-white border-b border-[#27272a]/40 mb-2 relative min-h-[45px]">
                <button onClick={() => setView("main")} className="absolute left-1 p-1 hover:bg-[#18181b] rounded-md transition-all text-[#a1a1aa] hover:text-white">
                  <ChevronLeft size={16} />
                </button>
                <span className="font-semibold text-sm mx-auto tracking-wide">AI Gateway</span>
              </div>
            )}

            <SidebarItem icon={<Network size={16} />} label="Overview" active={!q && view === "ai-gateway" && activeAIItem === "Overview"} onClick={() => handleSelect("ai-gateway", setActiveAIItem, "Overview")} q={q} category="AI Gateway" />
            <SidebarItem icon={<Wrench size={16} />} label="Quick Start" active={!q && view === "ai-gateway" && activeAIItem === "Quick Start"} onClick={() => handleSelect("ai-gateway", setActiveAIItem, "Quick Start")} q={q} category="AI Gateway" />
            <SidebarItem icon={<ListOrdered size={16} />} label="Model List" active={!q && view === "ai-gateway" && activeAIItem === "Model List"} onClick={() => handleSelect("ai-gateway", setActiveAIItem, "Model List")} q={q} category="AI Gateway" />
            <SidebarItem icon={<KeyRound size={16} />} label="API Keys" active={!q && view === "ai-gateway" && activeAIItem === "API Keys"} onClick={() => handleSelect("ai-gateway", setActiveAIItem, "API Keys")} q={q} category="AI Gateway" />
            <SidebarItem icon={<BYOKIcon />} label="Bring Your Own Key" active={!q && view === "ai-gateway" && activeAIItem === "Bring Your Own Key"} onClick={() => handleSelect("ai-gateway", setActiveAIItem, "Bring Your Own Key")} q={q} category="AI Gateway" />
            <SidebarItem icon={<Puzzle size={16} />} label="Templates" active={!q && view === "ai-gateway" && activeAIItem === "Templates"} onClick={() => handleSelect("ai-gateway", setActiveAIItem, "Templates")} q={q} category="AI Gateway" />
            <SidebarItem icon={<BarChart3 size={16} />} label="Leaderboards" active={!q && view === "ai-gateway" && activeAIItem === "Leaderboards"} onClick={() => handleSelect("ai-gateway", setActiveAIItem, "Leaderboards")} q={q} category="AI Gateway" />
            <SidebarItem icon={<Settings size={16} />} label="Settings" active={!q && view === "ai-gateway" && activeAIItem === "Settings"} onClick={() => handleSelect("ai-gateway", setActiveAIItem, "Settings")} q={q} category="AI Gateway" />
            <SidebarItem icon={<MessageSquare size={16} />} label="Playground" hasExternal active={!q && view === "ai-gateway" && activeAIItem === "Playground"} onClick={() => handleSelect("ai-gateway", setActiveAIItem, "Playground")} q={q} category="AI Gateway" />
            <SidebarItem icon={<BookOpen size={16} />} label="Documentation" hasExternal active={!q && view === "ai-gateway" && activeAIItem === "Documentation"} onClick={() => handleSelect("ai-gateway", setActiveAIItem, "Documentation")} q={q} category="AI Gateway" />
          </nav>
        )}

        {/* SETTINGS VIEW */}
        {(q || view === "settings") && (
          <nav className="px-2 space-y-0.5">
            {!q && (
              <div className="flex items-center px-2 py-2 text-white border-b border-[#27272a]/40 mb-2 relative min-h-[45px]">
                <button onClick={() => setView("main")} className="absolute left-1 p-1 hover:bg-[#18181b] rounded-md transition-all text-[#a1a1aa] hover:text-white">
                  <ChevronLeft size={16} />
                </button>
                <span className="font-semibold text-sm mx-auto tracking-wide">Settings</span>
              </div>
            )}

            {[
              "General", "Billing", "Build and Deployment", "Invoices", "Members",
              "Access Groups", "Agent", "Drains", "Alerts", "Webhooks",
              "Security & Privacy", "Deployment Protection", "Microfrontends",
              "Networking", "Activity", "My Notifications", "Apps"
            ].map(item => (
              <SidebarItem
                key={item}
                label={item}
                active={!q && view === "settings" && activeSettingsItem === item}
                onClick={() => handleSelect("settings", setActiveSettingsItem, item)}
                q={q}
                category="Settings"
              />
            ))}
          </nav>
        )}
      </div>

      {/* USER PROFILE FOOTER */}
      {user && (
        <div className="p-4 border-t border-[#27272a]/40 bg-black relative">
          {isDropdownOpen && setIsDropdownOpen && onLogout && (
            <div className="absolute bottom-full left-4 mb-2 w-56 bg-[#18181b] border border-[#27272a] rounded-xl shadow-xl z-50 overflow-hidden">
              <button
                onClick={onLogout}
                className="w-full text-left px-4 py-3 text-sm text-[#a1a1aa] hover:bg-[#27272a] hover:text-white transition-colors flex items-center gap-2 font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          )}

          <div
            onClick={() => setIsDropdownOpen && setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-3 px-3 py-2 bg-[#18181b]/50 border border-[#27272a] rounded-xl hover:bg-[#27272a] transition-colors cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-full overflow-hidden border border-[#3f3f46] group-hover:border-white transition-colors flex-shrink-0">
              <img
                src={user.avatarUrl || "https://github.com/ghost.png"}
                alt={user.username}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-semibold text-[#a1a1aa] group-hover:text-white transition-colors truncate">
                {user.displayName || user.username}
              </span>
              <span className="text-xs text-[#71717a] truncate">@{user.username}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarItem({
  icon,
  label,
  active = false,
  hasArrow = false,
  hasExternal = false,
  badge,
  onClick,
  q,
  category
}: {
  icon?: React.ReactNode;
  label: string;
  active?: boolean;
  hasArrow?: boolean;
  hasExternal?: boolean;
  badge?: string;
  onClick?: () => void;
  q?: string;
  category?: string;
}) {
  if (q && !label.toLowerCase().includes(q) && !(category && category.toLowerCase().includes(q))) {
    return null;
  }

  return (
    <a
      onClick={(e) => {
        e.preventDefault();
        if (onClick) onClick();
      }}
      href="#"
      className={`group flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all duration-200 cursor-pointer outline-none border ${active
          ? 'bg-[#27272a] text-white font-medium border-[#27272a]'
          : 'text-[#a1a1aa] hover:bg-[#18181b] hover:text-white border-transparent'
        }`}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <div className={active ? "text-white" : "text-[#a1a1aa] group-hover:text-white transition-colors"}>
            {icon}
          </div>
        )}
        <span className="font-medium">{label}</span>
      </div>

      <div className="flex items-center gap-2">
        {category && q && (
          <span className="text-[9px] font-medium text-[#71717a] bg-[#18181b] px-1.5 py-0.5 rounded border border-[#27272a] uppercase tracking-wider">{category}</span>
        )}
        {badge && (
          <span className={`flex items-center justify-center text-[10px] font-semibold px-2 h-5 rounded-full ${badge === "Beta"
              ? 'bg-[#27272a] text-white border border-[#3f3f46] text-[9px] uppercase tracking-wider'
              : 'bg-[#27272a] text-white border border-[#3f3f46]'
            }`}>
            {badge}
          </span>
        )}
        {hasArrow && (
          <ChevronRight size={14} className={active ? "text-[#a1a1aa]" : "text-[#71717a] group-hover:text-[#a1a1aa]"} />
        )}
        {hasExternal && (
          <ExternalLink size={12} className={active ? "text-[#a1a1aa]" : "text-[#71717a] group-hover:text-[#a1a1aa]"} />
        )}
      </div>
    </a>
  );
}
