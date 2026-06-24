"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Deployment {
  id: string;
  projectId: string;
  projectName?: string;
  status: string;
  commitHash: string;
  createdAt: string;
  commitMessage?: string;
}

interface Props {
  deployments: Deployment[];
  isGlobal?: boolean;
}

export default function DeploymentsList({ deployments, isGlobal = false }: Props) {
  const router = useRouter();
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const handleRedeploy = async (projectId: string) => {
    try {
      const token = localStorage.getItem("bravocloud_token");
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const res = await fetch(`${apiUrl}/api/projects/${projectId}/redeploy`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to redeploy");
      }
      alert("Redeployment queued successfully!");
      window.location.reload();
    } catch (error: any) {
      alert("Redeploy failed: " + error.message);
    }
  };

  return (
    <div className="w-full" onClick={() => setOpenDropdownId(null)}>
      <div className="bg-[#18181b]/60 backdrop-blur-md border border-[#27272a] rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#27272a] text-xs font-semibold text-[#71717a] uppercase tracking-wider bg-[#27272a]/20">
                {isGlobal && <th className="px-6 py-4">Project</th>}
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Commit</th>
                <th className="px-6 py-4">Date & Time</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272a]/50 text-sm">
              {deployments.length === 0 ? (
                <tr>
                  <td colSpan={isGlobal ? 5 : 4} className="px-6 py-12 text-center text-[#71717a]">
                    No deployments found.
                  </td>
                </tr>
              ) : (
                deployments.map((dep, index) => (
                  <tr key={dep.id} className="hover:bg-[#27272a]/20 transition-colors group">
                    {isGlobal && (
                      <td className="px-6 py-4 font-medium text-white">
                        {dep.projectName || 'Unknown'}
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 font-semibold">
                        <div className={`w-2 h-2 rounded-full ${(dep.status === 'SUCCESS' || dep.status === 'DEPLOYED') ? 'bg-[#22c55e]' : dep.status === 'FAILED' ? 'bg-[#ef4444]' : 'bg-[#eab308]'}`}></div>
                        {(dep.status === 'SUCCESS' || dep.status === 'DEPLOYED') ? 'READY' : dep.status}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-[#71717a]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                          <span className="font-mono text-[#a1a1aa] text-xs bg-[#27272a] px-2 py-0.5 rounded border border-[#3f3f46]">
                            {dep.commitHash ? dep.commitHash.substring(0,7) : 'manual'}
                          </span>
                          <span className="text-[#e4e4e7] truncate max-w-[200px] inline-block align-middle">
                            {dep.commitMessage || 'Deployment trigger'}
                          </span>
                        </div>
                        {(dep.publicUrl || dep.localUrl) && (
                          <div className="flex flex-col gap-1 mt-1 pl-6">
                            {dep.publicUrl && (
                              <a href={dep.publicUrl} target="_blank" rel="noreferrer" className="text-[11px] text-[#a1a1aa] hover:text-white flex items-center gap-1.5 w-fit transition-colors">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                {dep.publicUrl.replace('https://', '').replace('http://', '')}
                              </a>
                            )}
                            {dep.localUrl && (
                              <a href={dep.localUrl} target="_blank" rel="noreferrer" className="text-[11px] text-[#a1a1aa] hover:text-white flex items-center gap-1.5 w-fit transition-colors">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                {dep.localUrl.replace('http://', '')} <span className="px-1 py-0.5 rounded bg-[#27272a] text-[9px] font-bold text-white uppercase ml-0.5">Local</span>
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[#a1a1aa] whitespace-nowrap" suppressHydrationWarning>
                      {new Date(dep.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right relative">
                       <button 
                         onClick={(e) => {
                           e.stopPropagation();
                           setOpenDropdownId(openDropdownId === dep.id ? null : dep.id);
                         }}
                         className={`p-2 rounded-lg transition-colors ${openDropdownId === dep.id ? 'bg-[#27272a] text-white opacity-100' : 'text-[#a1a1aa] hover:text-white hover:bg-[#27272a] opacity-0 group-hover:opacity-100'}`}
                       >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                       </button>

                       {openDropdownId === dep.id && (
                         <div className="absolute right-8 top-10 mt-1 w-48 rounded-xl shadow-xl bg-[#18181b] border border-[#27272a] z-[60] overflow-hidden flex flex-col py-1 text-left origin-top-right">
                           <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               setOpenDropdownId(null);
                               handleRedeploy(dep.projectId);
                             }} 
                             className="px-4 py-2.5 text-sm text-[#e4e4e7] hover:bg-[#27272a] hover:text-white flex items-center gap-2 transition-colors"
                           >
                             <svg className="w-4 h-4 text-[#a1a1aa]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                             Redeploy Latest
                           </button>
                           
                           <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               setOpenDropdownId(null);
                               navigator.clipboard.writeText(dep.commitHash);
                               alert("Commit ID copied to clipboard!");
                             }} 
                             className="px-4 py-2.5 text-sm text-[#e4e4e7] hover:bg-[#27272a] hover:text-white flex items-center gap-2 transition-colors"
                           >
                             <svg className="w-4 h-4 text-[#a1a1aa]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                             Copy Commit ID
                           </button>

                           {isGlobal && (
                             <>
                               <div className="h-px bg-[#27272a]/50 my-1 mx-2"></div>
                               <button 
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setOpenDropdownId(null);
                                   router.push(`/dashboard/project/${dep.projectId}`);
                                 }} 
                                 className="px-4 py-2.5 text-sm text-[#e4e4e7] hover:bg-[#27272a] hover:text-white flex items-center gap-2 transition-colors"
                               >
                                 <svg className="w-4 h-4 text-[#a1a1aa]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                 View Project
                               </button>
                             </>
                           )}
                         </div>
                       )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
