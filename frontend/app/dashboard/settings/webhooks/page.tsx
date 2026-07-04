"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import BackgroundAnimation from "../../../components/BackgroundAnimation";
import Sidebar from "../../../components/Sidebar";

export default function GlobalWebhooksPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const cachedUser = sessionStorage.getItem("bravocloud_user");
    if (cachedUser) setUser(JSON.parse(cachedUser));
  }, []);

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
      <Sidebar user={user} />
      
      <div className="flex-1 flex flex-col relative overflow-y-auto overflow-x-hidden bg-black p-8">
        <BackgroundAnimation />

        <div className="max-w-5xl mx-auto flex flex-col gap-8 relative z-10 w-full mt-4 pb-20">
          {/* Header */}
          <div className="flex flex-col gap-2 pb-6 border-b border-[#27272a] flex-wrap sm:flex-nowrap justify-between items-start sm:items-center sm:flex-row">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                Workspace Webhooks
              </h1>
              <p className="text-[#a1a1aa] max-w-2xl text-sm mt-1">
                Configure HTTP endpoints that will receive push requests when workspace events occur.
              </p>
            </div>
            <button 
              onClick={() => router.push('/dashboard')}
              className="mt-4 sm:mt-0 bg-white hover:bg-gray-200 text-black px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 text-sm"
            >
              <Plus size={16} /> Create Webhook
            </button>
          </div>

          <div className="space-y-6">
            {/* Active Webhooks Table */}
            <section className="bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#121214] border-b border-[#27272a] text-[#71717a]">
                    <tr>
                      <th className="px-6 py-3 font-medium">Event</th>
                      <th className="px-6 py-3 font-medium">Delivery Method</th>
                      <th className="px-6 py-3 font-medium">Destination</th>
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#27272a]">
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-[#71717a]">No webhooks configured.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
