"use client";

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
  return (
    <div className="w-full">
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
                deployments.map((dep) => (
                  <tr key={dep.id} className="hover:bg-[#27272a]/20 transition-colors group">
                    {isGlobal && (
                      <td className="px-6 py-4 font-medium text-white">
                        {dep.projectName || 'Unknown'}
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 font-semibold">
                        <div className={`w-2 h-2 rounded-full ${(dep.status === 'SUCCESS' || dep.status === 'DEPLOYED') ? 'bg-[#22c55e]' : dep.status === 'FAILED' ? 'bg-[#ef4444]' : 'bg-[#eab308]'}`}></div>
                        {(dep.status === 'SUCCESS' || dep.status === 'DEPLOYED') ? 'Ready' : dep.status}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-[#71717a]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                        <span className="font-mono text-[#a1a1aa] text-xs bg-[#27272a] px-2 py-0.5 rounded border border-[#3f3f46]">
                          {dep.commitHash ? dep.commitHash.substring(0,7) : 'manual'}
                        </span>
                        <span className="text-[#e4e4e7] truncate max-w-[200px] inline-block align-middle">
                          {dep.commitMessage || 'Deployment trigger'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[#a1a1aa] whitespace-nowrap">
                      {new Date(dep.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                       <button className="text-[#a1a1aa] hover:text-white transition-colors opacity-0 group-hover:opacity-100 p-2 hover:bg-[#27272a] rounded-lg">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                       </button>
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
