"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LifeBuoy, Search, MessageSquare, Plus, FileText, CheckCircle2, Circle, Send, X, Loader2 } from "lucide-react";
import BackgroundAnimation from "../../components/BackgroundAnimation";
import Sidebar from "../../components/Sidebar";

export default function SupportPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({ subject: '', description: '', priority: 'Low' });

  useEffect(() => {
    const token = localStorage.getItem("bravocloud_token");
    if (!token) {
      window.location.href = "/";
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    
    Promise.all([
      fetch(`${apiUrl}/auth/me`, { headers: { "Authorization": `Bearer ${token}` } }),
      fetch(`${apiUrl}/api/support/tickets`, { headers: { "Authorization": `Bearer ${token}` } })
    ])
    .then(async ([userRes, ticketsRes]) => {
      if (userRes.ok) setUser((await userRes.json()).user);
      if (ticketsRes.ok) setTickets((await ticketsRes.json()).tickets || []);
      setLoading(false);
    })
    .catch((err) => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const token = localStorage.getItem("bravocloud_token");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    try {
      const res = await fetch(`${apiUrl}/api/support/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        const data = await res.json();
        setTickets([data.ticket, ...tickets]);
        setShowModal(false);
        setForm({ subject: '', description: '', priority: 'Low' });
      } else {
        alert("Failed to submit ticket.");
      }
    } catch (err) {
      console.error(err);
      alert("Error submitting ticket.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const communityLinks = [
    { title: "Discord Community", desc: "Chat with the team and other developers.", icon: <MessageSquare size={20} className="text-[#5865F2]" />, link: "#" },
    { title: "X (Twitter)", desc: "Follow us for announcements and updates.", icon: <svg viewBox="0 0 24 24" aria-hidden="true" className="w-5 h-5 fill-current"><g><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></g></svg>, link: "#" },
    { title: "Stack Overflow", desc: "Ask questions using the bravocloud tag.", icon: <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#F58025]"><path d="M15.725 0l-1.72 1.277 4.286 5.98 1.72-1.277zm-3.842 4.135l-1.385 1.597 6.453 5.485 1.385-1.597zm-3.085 5.56l-.88 1.91 8.5 3.99.88-1.91zm-1.63 7.02l-.125 2.115 9.405.515.125-2.115zm-1.025 7.23H22v-2h-15.86v2zM5.5 17.2V26H24v-8.8h-2.12v6.6H7.62v-6.6H5.5z" /></svg>, link: "#" },
    { title: "Documentation", desc: "Read guides and API references.", icon: <FileText size={20} className="text-white" />, link: "#" }
  ];

  if (loading) {
    return (
      <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
        <Sidebar user={user} />
        <div className="flex-1 flex flex-col relative overflow-y-auto overflow-x-hidden bg-black p-8">
          <BackgroundAnimation />
          <div className="flex items-center justify-center h-full relative z-10">
            <Loader2 className="animate-spin text-white opacity-50" size={32} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
      <Sidebar user={user} />

      <div className="flex-1 flex flex-col relative overflow-y-auto overflow-x-hidden bg-black custom-sidebar-scrollbar p-8">
        <BackgroundAnimation />

        <div className="max-w-5xl mx-auto w-full relative z-10 mt-4 flex flex-col gap-10">
          
          {/* Header */}
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Support Hub</h1>
            <p className="text-[#a1a1aa] max-w-2xl text-[15px]">Need help with your deployment? Connect with our community, browse documentation, or open a ticket with our support team.</p>
          </div>

          {/* Search Box */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-[#71717a] group-focus-within:text-white transition-colors" />
            </div>
            <input 
              type="text" 
              className="w-full bg-[#121214] border border-[#27272a] rounded-xl py-4 pl-12 pr-4 text-[15px] focus:outline-none focus:border-[#3f3f46] focus:bg-[#18181b] transition-all"
              placeholder="Search documentation, guides, and error codes..."
            />
          </div>

          {/* Community Links Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {communityLinks.map((item, idx) => (
              <a key={idx} href={item.link} className="bg-[#121214] border border-[#27272a] hover:border-[#3f3f46] rounded-xl p-5 flex flex-col gap-3 transition-colors group">
                <div className="w-10 h-10 rounded-lg bg-[#18181b] border border-[#27272a] flex items-center justify-center">
                  {item.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-[15px] group-hover:text-white transition-colors">{item.title}</h3>
                  <p className="text-sm text-[#a1a1aa] mt-1">{item.desc}</p>
                </div>
              </a>
            ))}
          </div>

          {/* Ticketing Section */}
          <div className="bg-[#121214] border border-[#27272a] rounded-xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-[#27272a] flex justify-between items-center">
              <div className="flex items-center gap-3">
                <LifeBuoy className="text-[#a1a1aa]" size={20} />
                <h2 className="text-lg font-semibold">Support Tickets</h2>
              </div>
              <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors">
                <Plus size={16} />
                New Ticket
              </button>
            </div>
            
            <div className="p-0">
              {tickets.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-[#18181b] flex items-center justify-center mb-4">
                    <LifeBuoy size={24} className="text-[#3f3f46]" />
                  </div>
                  <h3 className="font-semibold mb-1">No Support Tickets</h3>
                  <p className="text-sm text-[#a1a1aa]">You haven't opened any support tickets yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="text-[#a1a1aa] bg-[#18181b]/50 border-b border-[#27272a]">
                      <tr>
                        <th className="px-6 py-4 font-medium">Subject</th>
                        <th className="px-6 py-4 font-medium">Status</th>
                        <th className="px-6 py-4 font-medium">Priority</th>
                        <th className="px-6 py-4 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#27272a]">
                      {tickets.map(t => (
                        <tr key={t.id} className="hover:bg-[#18181b] transition-colors group cursor-pointer">
                          <td className="px-6 py-4 font-medium group-hover:text-white transition-colors">
                            {t.subject}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${t.status === 'Open' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : t.status === 'Resolved' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
                              {t.status === 'Open' ? <Circle size={10} className="fill-current" /> : <CheckCircle2 size={12} />}
                              {t.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-xs font-medium ${t.priority === 'High' ? 'text-red-400' : t.priority === 'Medium' ? 'text-yellow-400' : 'text-[#a1a1aa]'}`}>
                              {t.priority}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-[#a1a1aa]">
                            {new Date(t.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* New Ticket Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#121214] border border-[#27272a] rounded-xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-[#27272a]">
              <h2 className="text-xl font-bold">Create Support Ticket</h2>
              <button onClick={() => setShowModal(false)} className="text-[#a1a1aa] hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
              
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-[#a1a1aa]">Subject</label>
                <input 
                  type="text" 
                  required
                  value={form.subject}
                  onChange={e => setForm({...form, subject: e.target.value})}
                  className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#3f3f46] text-white" 
                  placeholder="E.g., Domain configuration issue"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-[#a1a1aa]">Priority</label>
                <select 
                  value={form.priority}
                  onChange={e => setForm({...form, priority: e.target.value})}
                  className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#3f3f46] text-white appearance-none"
                >
                  <option value="Low">Low - General inquiry</option>
                  <option value="Medium">Medium - Feature not working</option>
                  <option value="High">High - Production is down</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-[#a1a1aa]">Description</label>
                <textarea 
                  required
                  rows={4}
                  value={form.description}
                  onChange={e => setForm({...form, description: e.target.value})}
                  className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#3f3f46] text-white resize-none" 
                  placeholder="Please describe the issue in detail. Include steps to reproduce if applicable."
                />
              </div>

              <div className="flex justify-end gap-3 mt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-[#a1a1aa] hover:text-white transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50">
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Submit Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
