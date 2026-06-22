"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CreditCard, Building2, Download, Plus, Zap, ShieldCheck, Clock, ArrowRight, X, Trash2 } from "lucide-react";
import BackgroundAnimation from "../../../components/BackgroundAnimation";
import Sidebar from "../../../components/Sidebar";

export default function BillingSettingsPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [billingData, setBillingData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

  // Card Form State
  const [cardNumber, setCardNumber] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardName, setCardName] = useState('');
  const [isSubmittingCard, setIsSubmittingCard] = useState(false);

  // Address Form State
  const [addressText, setAddressText] = useState('');
  const [taxIdText, setTaxIdText] = useState('');
  const [isSubmittingAddress, setIsSubmittingAddress] = useState(false);

  const fetchBillingData = async (token: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      
      // Fetch user settings to get the plan
      const userRes = await fetch(`${apiUrl}/api/user/settings`, { headers: { "Authorization": `Bearer ${token}` } });
      if (userRes.ok) {
        const data = await userRes.json();
        setUser(data.user);
      }

      // Fetch billing details
      const billingRes = await fetch(`${apiUrl}/api/billing`, { headers: { "Authorization": `Bearer ${token}` } });
      if (billingRes.ok) {
        const bData = await billingRes.json();
        setBillingData(bData);
        setAddressText(bData.billingAddress || '');
        setTaxIdText(bData.taxId || '');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("bravocloud_token");
    if (!token) {
      window.location.href = "/";
      return;
    }
    fetchBillingData(token);
  }, []);

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingCard(true);
    try {
      const token = localStorage.getItem("bravocloud_token");
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      
      const res = await fetch(`${apiUrl}/api/billing/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ cardNumber, expMonth, expYear, cvc, name: cardName })
      });
      
      if (res.ok) {
        setIsAddCardModalOpen(false);
        setCardNumber('');
        setExpMonth('');
        setExpYear('');
        setCvc('');
        setCardName('');
        await fetchBillingData(token!);
      }
    } catch (error) {
      console.error("Failed to add card", error);
    } finally {
      setIsSubmittingCard(false);
    }
  };

  const handleDeleteCard = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payment method?')) return;
    try {
      const token = localStorage.getItem("bravocloud_token");
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const res = await fetch(`${apiUrl}/api/billing/cards/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        await fetchBillingData(token!);
      }
    } catch (error) {
      console.error("Failed to delete card", error);
    }
  };

  const handleUpdateAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingAddress(true);
    try {
      const token = localStorage.getItem("bravocloud_token");
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      
      const res = await fetch(`${apiUrl}/api/billing/address`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ billingAddress: addressText, taxId: taxIdText })
      });
      
      if (res.ok) {
        setIsAddressModalOpen(false);
        await fetchBillingData(token!);
      }
    } catch (error) {
      console.error("Failed to update address", error);
    } finally {
      setIsSubmittingAddress(false);
    }
  };

  if (loading || !user || !billingData) {
    return (
      <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
        <Sidebar user={user} />
        <div className="flex-1 flex flex-col relative bg-black p-8">
          <BackgroundAnimation />
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
            <p className="mt-4 text-[#a1a1aa] text-sm">Loading billing...</p>
          </div>
        </div>
      </div>
    );
  }

  const isPro = user.billingPlan === "Pro";
  const { cards, invoices, billingAddress, taxId } = billingData;

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
      <Sidebar user={user} />

      <div className="flex-1 flex flex-col relative overflow-y-auto overflow-x-hidden bg-black p-8">
        <BackgroundAnimation />

        <div className="max-w-5xl mx-auto flex flex-col gap-8 relative z-10 w-full mt-4 pb-20">

          {/* Header */}
          <div className="flex flex-col gap-2 pb-6 border-b border-[#27272a]">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              Billing & Usage
            </h1>
            <p className="text-[#a1a1aa] max-w-2xl text-sm mt-1">
              Manage your subscription tier, payment methods, and download past invoices.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            <div className="lg:col-span-2 space-y-8">
              
              {/* Current Plan Hero */}
              <section className="relative overflow-hidden border border-[#27272a] rounded-2xl shadow-2xl group">
                <div className={`absolute inset-0 opacity-20 transition-opacity duration-500 group-hover:opacity-30 ${isPro ? 'bg-gradient-to-br from-violet-600 via-indigo-600 to-transparent' : 'bg-gradient-to-br from-emerald-600 via-emerald-900 to-transparent'}`} />
                <div className="relative p-8 flex flex-col md:flex-row items-center justify-between gap-6 backdrop-blur-sm bg-black/40">
                  <div className="flex items-center gap-6">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border shadow-inner ${isPro ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
                      <Zap size={32} />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-2xl font-bold text-white">{isPro ? 'Pro Plan' : 'Hobby Plan'}</h2>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${isPro ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'}`}>
                          Active
                        </span>
                      </div>
                      <p className="text-[#a1a1aa] text-sm">
                        {isPro ? 'You have access to premium compute and unlimited bandwidth.' : 'Free for personal projects and non-commercial use.'}
                      </p>
                    </div>
                  </div>
                  
                  {!isPro && (
                    <button className="whitespace-nowrap bg-white text-black hover:bg-gray-200 px-6 py-3 rounded-xl font-semibold transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)] flex items-center gap-2">
                      Upgrade to Pro
                      <ArrowRight size={18} />
                    </button>
                  )}
                  {isPro && (
                    <button className="whitespace-nowrap bg-[#27272a] text-white hover:bg-[#3f3f46] border border-[#3f3f46] px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2">
                      Manage Plan
                    </button>
                  )}
                </div>
              </section>

              {/* Payment Methods */}
              <section className="bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden shadow-lg">
                <div className="p-6 border-b border-[#27272a] flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-1">
                      <CreditCard size={18} className="text-blue-400" /> Payment Methods
                    </h3>
                    <p className="text-[#a1a1aa] text-sm">
                      Credit cards and billing addresses associated with your account.
                    </p>
                  </div>
                  <button 
                    onClick={() => setIsAddCardModalOpen(true)}
                    className="bg-[#27272a] hover:bg-[#3f3f46] border border-[#3f3f46] text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
                  >
                    <Plus size={16} /> Add Card
                  </button>
                </div>
                
                <div className="p-6 space-y-4">
                  {cards.length === 0 ? (
                    <p className="text-[#a1a1aa] text-sm">No payment methods found.</p>
                  ) : (
                    cards.map((card: any) => (
                      <div key={card.id} className="flex items-center justify-between p-4 border border-[#27272a] bg-[#121214] rounded-xl hover:border-[#3f3f46] transition-colors group">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-8 bg-white rounded flex items-center justify-center p-1 text-black font-bold text-xs uppercase">
                            {card.brand}
                          </div>
                          <div>
                            <p className="text-white font-medium flex items-center gap-2">
                              {card.brand} ending in {card.last4}
                              {card.isDefault && (
                                <span className="bg-[#27272a] text-[#a1a1aa] text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Default</span>
                              )}
                            </p>
                            <p className="text-[#71717a] text-sm">Expires {card.expMonth}/{card.expYear}</p>
                          </div>
                        </div>
                        <button onClick={() => handleDeleteCard(card.id)} className="text-[#71717a] hover:text-red-400 transition-colors">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Invoices */}
              <section className="bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden shadow-lg">
                <div className="p-6 border-b border-[#27272a]">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-1">
                    <Clock size={18} className="text-orange-400" /> Billing History
                  </h3>
                  <p className="text-[#a1a1aa] text-sm">
                    View and download past invoices.
                  </p>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#121214] border-b border-[#27272a] text-[#71717a]">
                      <tr>
                        <th className="px-6 py-3 font-medium">Date</th>
                        <th className="px-6 py-3 font-medium">Invoice Number</th>
                        <th className="px-6 py-3 font-medium">Amount</th>
                        <th className="px-6 py-3 font-medium">Status</th>
                        <th className="px-6 py-3 font-medium text-right">Invoice</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#27272a]">
                      {invoices.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-[#71717a]">No invoices found</td>
                        </tr>
                      ) : (
                        invoices.map((inv: any) => (
                          <tr key={inv.id} className="hover:bg-[#121214] transition-colors">
                            <td className="px-6 py-4 text-[#e4e4e7]">{new Date(inv.date).toLocaleDateString()}</td>
                            <td className="px-6 py-4 text-[#a1a1aa]">{inv.invoiceNumber}</td>
                            <td className="px-6 py-4 text-white font-medium">${inv.amount.toFixed(2)}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${inv.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'}`}>
                                {inv.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button className="text-[#a1a1aa] hover:text-white transition-colors" title="Download">
                                <Download size={16} className="inline" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

            </div>

            <div className="space-y-6">
              {/* Billing Info Panel */}
              <div className="bg-[#121214] border border-[#27272a] rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <Building2 className="text-pink-400" size={20} />
                  <h3 className="text-white font-semibold">Billing Address</h3>
                </div>
                <div className="text-sm text-[#a1a1aa] leading-relaxed whitespace-pre-wrap">
                  {billingAddress ? billingAddress : <p className="italic">No billing address set.</p>}
                </div>
                <button 
                  onClick={() => setIsAddressModalOpen(true)}
                  className="text-blue-400 hover:text-blue-300 text-sm font-medium mt-4 transition-colors"
                >
                  {billingAddress ? 'Update Address' : 'Add Address'}
                </button>
              </div>

              {/* Tax Settings */}
              <div className="bg-[#121214] border border-[#27272a] rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <ShieldCheck className="text-teal-400" size={20} />
                  <h3 className="text-white font-semibold">Tax Details</h3>
                </div>
                <p className="text-sm text-[#a1a1aa] mb-4">
                  {taxId ? `Tax ID: ${taxId}` : 'Enter your VAT or tax identification number for business invoices.'}
                </p>
                <button 
                  onClick={() => setIsAddressModalOpen(true)}
                  className="w-full bg-[#27272a] hover:bg-[#3f3f46] border border-[#3f3f46] text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
                >
                  {taxId ? 'Update Tax ID' : 'Add Tax ID'}
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Add Card Modal */}
      {isAddCardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[#27272a]">
              <h2 className="text-lg font-semibold text-white">Add Payment Method</h2>
              <button onClick={() => setIsAddCardModalOpen(false)} className="text-[#a1a1aa] hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddCard} className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-[#a1a1aa] mb-1">Name on Card</label>
                <input 
                  type="text" 
                  value={cardName} 
                  onChange={e => setCardName(e.target.value)} 
                  required
                  className="w-full bg-black border border-[#27272a] rounded-lg px-3 py-2 text-white focus:border-white outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-[#a1a1aa] mb-1">Card Number</label>
                <input 
                  type="text" 
                  value={cardNumber} 
                  onChange={e => setCardNumber(e.target.value)} 
                  required
                  placeholder="**** **** **** ****"
                  className="w-full bg-black border border-[#27272a] rounded-lg px-3 py-2 text-white focus:border-white outline-none transition-colors"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm text-[#a1a1aa] mb-1">Expiration</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={expMonth} 
                      onChange={e => setExpMonth(e.target.value)} 
                      placeholder="MM" 
                      maxLength={2}
                      required
                      className="w-full bg-black border border-[#27272a] rounded-lg px-3 py-2 text-white focus:border-white outline-none transition-colors text-center"
                    />
                    <span className="text-[#a1a1aa] flex items-center">/</span>
                    <input 
                      type="text" 
                      value={expYear} 
                      onChange={e => setExpYear(e.target.value)} 
                      placeholder="YY" 
                      maxLength={2}
                      required
                      className="w-full bg-black border border-[#27272a] rounded-lg px-3 py-2 text-white focus:border-white outline-none transition-colors text-center"
                    />
                  </div>
                </div>
                <div className="w-1/3">
                  <label className="block text-sm text-[#a1a1aa] mb-1">CVC</label>
                  <input 
                    type="text" 
                    value={cvc} 
                    onChange={e => setCvc(e.target.value)} 
                    required
                    placeholder="123"
                    maxLength={4}
                    className="w-full bg-black border border-[#27272a] rounded-lg px-3 py-2 text-white focus:border-white outline-none transition-colors"
                  />
                </div>
              </div>
              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={isSubmittingCard}
                  className="w-full bg-white hover:bg-gray-200 text-black py-2.5 rounded-lg font-semibold transition-colors flex items-center justify-center disabled:opacity-50"
                >
                  {isSubmittingCard ? <Loader2 size={18} className="animate-spin" /> : 'Save Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Address Modal */}
      {isAddressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[#27272a]">
              <h2 className="text-lg font-semibold text-white">Update Billing Details</h2>
              <button onClick={() => setIsAddressModalOpen(false)} className="text-[#a1a1aa] hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdateAddress} className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-[#a1a1aa] mb-1">Billing Address</label>
                <textarea 
                  value={addressText} 
                  onChange={e => setAddressText(e.target.value)} 
                  rows={4}
                  placeholder="123 Cloud Avenue&#10;San Francisco, CA 94107"
                  className="w-full bg-black border border-[#27272a] rounded-lg px-3 py-2 text-white focus:border-white outline-none transition-colors resize-none"
                />
              </div>
              <div>
                <label className="block text-sm text-[#a1a1aa] mb-1">Tax ID / VAT (Optional)</label>
                <input 
                  type="text" 
                  value={taxIdText} 
                  onChange={e => setTaxIdText(e.target.value)} 
                  placeholder="e.g. GB123456789"
                  className="w-full bg-black border border-[#27272a] rounded-lg px-3 py-2 text-white focus:border-white outline-none transition-colors"
                />
              </div>
              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={isSubmittingAddress}
                  className="w-full bg-white hover:bg-gray-200 text-black py-2.5 rounded-lg font-semibold transition-colors flex items-center justify-center disabled:opacity-50"
                >
                  {isSubmittingAddress ? <Loader2 size={18} className="animate-spin" /> : 'Save Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
