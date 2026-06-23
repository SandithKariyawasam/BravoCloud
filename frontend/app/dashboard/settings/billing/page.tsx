"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CreditCard, Building2, Download, Plus, Zap, ShieldCheck, Clock, ArrowRight, X, Trash2, CheckCircle2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
  const [addressObj, setAddressObj] = useState({
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'United States'
  });
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
        if (bData.billingAddress && typeof bData.billingAddress === 'object') {
          setAddressObj(bData.billingAddress);
        } else if (bData.billingAddress && typeof bData.billingAddress === 'string') {
          setAddressObj(prev => ({ ...prev, line1: bData.billingAddress }));
        }
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
        body: JSON.stringify({ billingAddress: addressObj, taxId: taxIdText })
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

  const handleDownloadInvoice = async (inv: any) => {
    const doc = new jsPDF();
    const formattedInvoiceNumber = inv.invoiceNumber.replace('INV-', 'B');
    
    // Header & Logo
    try {
      const response = await fetch('/BravoCloud-logo.png');
      if (response.ok) {
        const blob = await response.blob();
        const base64data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        doc.addImage(base64data, 'PNG', 14, 10, 15, 15);
      } else {
        doc.setFontSize(22);
        doc.setTextColor(39, 39, 42);
        doc.text("BravoCloud", 14, 22);
      }
    } catch (e) {
      doc.setFontSize(22);
      doc.setTextColor(39, 39, 42);
      doc.text("BravoCloud", 14, 22);
    }
    
    // Company Address
    doc.setFontSize(10);
    doc.setTextColor(113, 113, 122); // Zinc 500
    doc.text("BravoScript Inc.", 14, 32);
    doc.text("123 Tech Avenue, Suite 400", 14, 37);
    doc.text("Wester Province, CA 94105", 14, 42);
    doc.text("Colombo 11, Sri Lanka", 14, 47);

    // Invoice Details
    doc.setFontSize(10);
    doc.setTextColor(39, 39, 42); // Zinc 800
    doc.text("Invoice #: " + formattedInvoiceNumber, 120, 32);
    doc.text("Date: " + new Date(inv.date).toLocaleDateString(), 120, 37);
    doc.text("Status: " + inv.status, 120, 42);
    
    // Billing Period
    const invDate = new Date(inv.date);
    const firstDay = new Date(invDate.getFullYear(), invDate.getMonth(), 1);
    const lastDay = new Date(invDate.getFullYear(), invDate.getMonth() + 1, 0);
    doc.text(`Billing Period: ${firstDay.toLocaleDateString()} - ${lastDay.toLocaleDateString()}`, 120, 47);

    // Bill To
    doc.setFontSize(12);
    doc.setTextColor(39, 39, 42);
    doc.text("Bill To:", 14, 62);
    
    doc.setFontSize(10);
    doc.setTextColor(113, 113, 122);
    
    let yPos = 68;
    if (user?.name) {
      doc.text(user.name, 14, yPos);
      yPos += 5;
    }
    
    if (billingData?.billingAddress) {
      const addr = billingData.billingAddress;
      if (typeof addr === 'object') {
        if (addr.line1) { doc.text(addr.line1, 14, yPos); yPos += 5; }
        if (addr.line2) { doc.text(addr.line2, 14, yPos); yPos += 5; }
        if (addr.city) { doc.text(`${addr.city}, ${addr.state} ${addr.postalCode}`, 14, yPos); yPos += 5; }
        if (addr.country) { doc.text(addr.country, 14, yPos); yPos += 5; }
      } else {
        const lines = String(addr).split('\n');
        lines.forEach(line => {
          doc.text(line, 14, yPos);
          yPos += 5;
        });
      }
    } else {
      doc.text("No billing address on file.", 14, yPos);
    }

    if (billingData?.taxId) {
      yPos += 5;
      doc.text(`Tax ID / VAT: ${billingData.taxId}`, 14, yPos);
    }

    // Table
    const tableData = [
      ["BravoCloud Serverless Hosting (Monthly)", "$0.00", `$${inv.amount.toFixed(2)}`]
    ];

    autoTable(doc, {
      startY: yPos + 10,
      head: [['Description', 'Unit Price', 'Amount']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [39, 39, 42], textColor: 255 },
      styles: { fontSize: 10, cellPadding: 6 },
    });

    const finalY = (doc as any).lastAutoTable.finalY || yPos + 30;
    
    // Total
    doc.setFontSize(12);
    doc.setTextColor(39, 39, 42);
    doc.text(`Total Due: $${inv.amount.toFixed(2)}`, 140, finalY + 10);
    
    // Services Link & Footer
    doc.setFontSize(10);
    doc.setTextColor(59, 130, 246); // Blue color for link
    doc.textWithLink("Your services: bravocloud.tech/dashboard/services", 14, finalY + 20, { url: 'https://bravocloud.tech/dashboard/' });

    doc.setTextColor(113, 113, 122);
    doc.text("Thank you for using BravoCloud!", 14, finalY + 30);

    doc.save(`${formattedInvoiceNumber}.pdf`);
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
                              <button 
                                onClick={() => handleDownloadInvoice(inv)}
                                className="text-[#a1a1aa] hover:text-white transition-colors" 
                                title="Download"
                              >
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
                <div className="text-sm text-[#a1a1aa] leading-relaxed">
                  {billingAddress ? (
                    typeof billingAddress === 'object' ? (
                      <>
                        <p>{billingAddress.line1}</p>
                        {billingAddress.line2 && <p>{billingAddress.line2}</p>}
                        <p>{billingAddress.city}, {billingAddress.state} {billingAddress.postalCode}</p>
                        <p>{billingAddress.country}</p>
                      </>
                    ) : (
                      <p className="whitespace-pre-wrap">{billingAddress}</p>
                    )
                  ) : <p className="italic">No billing address set.</p>}
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
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm text-[#a1a1aa] mb-1">Country / Region</label>
                  <select
                    value={addressObj.country}
                    onChange={e => setAddressObj({ ...addressObj, country: e.target.value })}
                    className="w-full bg-black border border-[#27272a] rounded-lg px-3 py-2 text-white focus:border-white outline-none transition-colors"
                  >
                    <option value="Afghanistan">Afghanistan</option>
                    <option value="Albania">Albania</option>
                    <option value="Algeria">Algeria</option>
                    <option value="American Samoa">American Samoa</option>
                    <option value="Andorra">Andorra</option>
                    <option value="Angola">Angola</option>
                    <option value="Anguilla">Anguilla</option>
                    <option value="Antarctica">Antarctica</option>
                    <option value="Antigua and Barbuda">Antigua and Barbuda</option>
                    <option value="Argentina">Argentina</option>
                    <option value="Armenia">Armenia</option>
                    <option value="Aruba">Aruba</option>
                    <option value="Australia">Australia</option>
                    <option value="Austria">Austria</option>
                    <option value="Azerbaijan">Azerbaijan</option>
                    <option value="Bahamas">Bahamas</option>
                    <option value="Bahrain">Bahrain</option>
                    <option value="Bangladesh">Bangladesh</option>
                    <option value="Barbados">Barbados</option>
                    <option value="Belarus">Belarus</option>
                    <option value="Belgium">Belgium</option>
                    <option value="Belize">Belize</option>
                    <option value="Benin">Benin</option>
                    <option value="Bermuda">Bermuda</option>
                    <option value="Bhutan">Bhutan</option>
                    <option value="Bolivia">Bolivia</option>
                    <option value="Bonaire, Sint Eustatius and Saba">Bonaire, Sint Eustatius and Saba</option>
                    <option value="Bosnia and Herzegovina">Bosnia and Herzegovina</option>
                    <option value="Botswana">Botswana</option>
                    <option value="Bouvet Island">Bouvet Island</option>
                    <option value="Brazil">Brazil</option>
                    <option value="British Indian Ocean Territory">British Indian Ocean Territory</option>
                    <option value="Brunei Darussalam">Brunei Darussalam</option>
                    <option value="Bulgaria">Bulgaria</option>
                    <option value="Burkina Faso">Burkina Faso</option>
                    <option value="Burundi">Burundi</option>
                    <option value="Cabo Verde">Cabo Verde</option>
                    <option value="Cambodia">Cambodia</option>
                    <option value="Cameroon">Cameroon</option>
                    <option value="Canada">Canada</option>
                    <option value="Cayman Islands">Cayman Islands</option>
                    <option value="Central African Republic">Central African Republic</option>
                    <option value="Chad">Chad</option>
                    <option value="Chile">Chile</option>
                    <option value="China">China</option>
                    <option value="Christmas Island">Christmas Island</option>
                    <option value="Cocos (Keeling) Islands">Cocos (Keeling) Islands</option>
                    <option value="Colombia">Colombia</option>
                    <option value="Comoros">Comoros</option>
                    <option value="Congo">Congo</option>
                    <option value="Congo, Democratic Republic of the">Congo, Democratic Republic of the</option>
                    <option value="Cook Islands">Cook Islands</option>
                    <option value="Costa Rica">Costa Rica</option>
                    <option value="Croatia">Croatia</option>
                    <option value="Cuba">Cuba</option>
                    <option value="Curaçao">Curaçao</option>
                    <option value="Cyprus">Cyprus</option>
                    <option value="Czechia">Czechia</option>
                    <option value="Côte d'Ivoire">Côte d'Ivoire</option>
                    <option value="Denmark">Denmark</option>
                    <option value="Djibouti">Djibouti</option>
                    <option value="Dominica">Dominica</option>
                    <option value="Dominican Republic">Dominican Republic</option>
                    <option value="Ecuador">Ecuador</option>
                    <option value="Egypt">Egypt</option>
                    <option value="El Salvador">El Salvador</option>
                    <option value="Equatorial Guinea">Equatorial Guinea</option>
                    <option value="Eritrea">Eritrea</option>
                    <option value="Estonia">Estonia</option>
                    <option value="Eswatini">Eswatini</option>
                    <option value="Ethiopia">Ethiopia</option>
                    <option value="Falkland Islands (Malvinas)">Falkland Islands (Malvinas)</option>
                    <option value="Faroe Islands">Faroe Islands</option>
                    <option value="Fiji">Fiji</option>
                    <option value="Finland">Finland</option>
                    <option value="France">France</option>
                    <option value="French Guiana">French Guiana</option>
                    <option value="French Polynesia">French Polynesia</option>
                    <option value="French Southern Territories">French Southern Territories</option>
                    <option value="Gabon">Gabon</option>
                    <option value="Gambia">Gambia</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Germany">Germany</option>
                    <option value="Ghana">Ghana</option>
                    <option value="Gibraltar">Gibraltar</option>
                    <option value="Greece">Greece</option>
                    <option value="Greenland">Greenland</option>
                    <option value="Grenada">Grenada</option>
                    <option value="Guadeloupe">Guadeloupe</option>
                    <option value="Guam">Guam</option>
                    <option value="Guatemala">Guatemala</option>
                    <option value="Guernsey">Guernsey</option>
                    <option value="Guinea">Guinea</option>
                    <option value="Guinea-Bissau">Guinea-Bissau</option>
                    <option value="Guyana">Guyana</option>
                    <option value="Haiti">Haiti</option>
                    <option value="Heard Island and McDonald Islands">Heard Island and McDonald Islands</option>
                    <option value="Holy See">Holy See</option>
                    <option value="Honduras">Honduras</option>
                    <option value="Hong Kong">Hong Kong</option>
                    <option value="Hungary">Hungary</option>
                    <option value="Iceland">Iceland</option>
                    <option value="India">India</option>
                    <option value="Indonesia">Indonesia</option>
                    <option value="Iran">Iran</option>
                    <option value="Iraq">Iraq</option>
                    <option value="Ireland">Ireland</option>
                    <option value="Isle of Man">Isle of Man</option>
                    <option value="Israel">Israel</option>
                    <option value="Italy">Italy</option>
                    <option value="Jamaica">Jamaica</option>
                    <option value="Japan">Japan</option>
                    <option value="Jersey">Jersey</option>
                    <option value="Jordan">Jordan</option>
                    <option value="Kazakhstan">Kazakhstan</option>
                    <option value="Kenya">Kenya</option>
                    <option value="Kiribati">Kiribati</option>
                    <option value="Korea, Democratic People's Republic of">Korea, Democratic People's Republic of</option>
                    <option value="Korea, Republic of">Korea, Republic of</option>
                    <option value="Kuwait">Kuwait</option>
                    <option value="Kyrgyzstan">Kyrgyzstan</option>
                    <option value="Lao People's Democratic Republic">Lao People's Democratic Republic</option>
                    <option value="Latvia">Latvia</option>
                    <option value="Lebanon">Lebanon</option>
                    <option value="Lesotho">Lesotho</option>
                    <option value="Liberia">Liberia</option>
                    <option value="Libya">Libya</option>
                    <option value="Liechtenstein">Liechtenstein</option>
                    <option value="Lithuania">Lithuania</option>
                    <option value="Luxembourg">Luxembourg</option>
                    <option value="Macao">Macao</option>
                    <option value="Madagascar">Madagascar</option>
                    <option value="Malawi">Malawi</option>
                    <option value="Malaysia">Malaysia</option>
                    <option value="Maldives">Maldives</option>
                    <option value="Mali">Mali</option>
                    <option value="Malta">Malta</option>
                    <option value="Marshall Islands">Marshall Islands</option>
                    <option value="Martinique">Martinique</option>
                    <option value="Mauritania">Mauritania</option>
                    <option value="Mauritius">Mauritius</option>
                    <option value="Mayotte">Mayotte</option>
                    <option value="Mexico">Mexico</option>
                    <option value="Micronesia">Micronesia</option>
                    <option value="Moldova">Moldova</option>
                    <option value="Monaco">Monaco</option>
                    <option value="Mongolia">Mongolia</option>
                    <option value="Montenegro">Montenegro</option>
                    <option value="Montserrat">Montserrat</option>
                    <option value="Morocco">Morocco</option>
                    <option value="Mozambique">Mozambique</option>
                    <option value="Myanmar">Myanmar</option>
                    <option value="Namibia">Namibia</option>
                    <option value="Nauru">Nauru</option>
                    <option value="Nepal">Nepal</option>
                    <option value="Netherlands">Netherlands</option>
                    <option value="New Caledonia">New Caledonia</option>
                    <option value="New Zealand">New Zealand</option>
                    <option value="Nicaragua">Nicaragua</option>
                    <option value="Niger">Niger</option>
                    <option value="Nigeria">Nigeria</option>
                    <option value="Niue">Niue</option>
                    <option value="Norfolk Island">Norfolk Island</option>
                    <option value="North Macedonia">North Macedonia</option>
                    <option value="Northern Mariana Islands">Northern Mariana Islands</option>
                    <option value="Norway">Norway</option>
                    <option value="Oman">Oman</option>
                    <option value="Pakistan">Pakistan</option>
                    <option value="Palau">Palau</option>
                    <option value="Palestine, State of">Palestine, State of</option>
                    <option value="Panama">Panama</option>
                    <option value="Papua New Guinea">Papua New Guinea</option>
                    <option value="Paraguay">Paraguay</option>
                    <option value="Peru">Peru</option>
                    <option value="Philippines">Philippines</option>
                    <option value="Pitcairn">Pitcairn</option>
                    <option value="Poland">Poland</option>
                    <option value="Portugal">Portugal</option>
                    <option value="Puerto Rico">Puerto Rico</option>
                    <option value="Qatar">Qatar</option>
                    <option value="Romania">Romania</option>
                    <option value="Russian Federation">Russian Federation</option>
                    <option value="Rwanda">Rwanda</option>
                    <option value="Réunion">Réunion</option>
                    <option value="Saint Barthélemy">Saint Barthélemy</option>
                    <option value="Saint Helena, Ascension and Tristan da Cunha">Saint Helena, Ascension and Tristan da Cunha</option>
                    <option value="Saint Kitts and Nevis">Saint Kitts and Nevis</option>
                    <option value="Saint Lucia">Saint Lucia</option>
                    <option value="Saint Martin (French part)">Saint Martin (French part)</option>
                    <option value="Saint Pierre and Miquelon">Saint Pierre and Miquelon</option>
                    <option value="Saint Vincent and the Grenadines">Saint Vincent and the Grenadines</option>
                    <option value="Samoa">Samoa</option>
                    <option value="San Marino">San Marino</option>
                    <option value="Sao Tome and Principe">Sao Tome and Principe</option>
                    <option value="Saudi Arabia">Saudi Arabia</option>
                    <option value="Senegal">Senegal</option>
                    <option value="Serbia">Serbia</option>
                    <option value="Seychelles">Seychelles</option>
                    <option value="Sierra Leone">Sierra Leone</option>
                    <option value="Singapore">Singapore</option>
                    <option value="Sint Maarten (Dutch part)">Sint Maarten (Dutch part)</option>
                    <option value="Slovakia">Slovakia</option>
                    <option value="Slovenia">Slovenia</option>
                    <option value="Solomon Islands">Solomon Islands</option>
                    <option value="Somalia">Somalia</option>
                    <option value="South Africa">South Africa</option>
                    <option value="South Georgia and the South Sandwich Islands">South Georgia and the South Sandwich Islands</option>
                    <option value="South Sudan">South Sudan</option>
                    <option value="Spain">Spain</option>
                    <option value="Sri Lanka">Sri Lanka</option>
                    <option value="Sudan">Sudan</option>
                    <option value="Suriname">Suriname</option>
                    <option value="Svalbard and Jan Mayen">Svalbard and Jan Mayen</option>
                    <option value="Sweden">Sweden</option>
                    <option value="Switzerland">Switzerland</option>
                    <option value="Syrian Arab Republic">Syrian Arab Republic</option>
                    <option value="Taiwan">Taiwan</option>
                    <option value="Tajikistan">Tajikistan</option>
                    <option value="Tanzania, United Republic of">Tanzania, United Republic of</option>
                    <option value="Thailand">Thailand</option>
                    <option value="Timor-Leste">Timor-Leste</option>
                    <option value="Togo">Togo</option>
                    <option value="Tokelau">Tokelau</option>
                    <option value="Tonga">Tonga</option>
                    <option value="Trinidad and Tobago">Trinidad and Tobago</option>
                    <option value="Tunisia">Tunisia</option>
                    <option value="Turkey">Turkey</option>
                    <option value="Turkmenistan">Turkmenistan</option>
                    <option value="Turks and Caicos Islands">Turks and Caicos Islands</option>
                    <option value="Tuvalu">Tuvalu</option>
                    <option value="Uganda">Uganda</option>
                    <option value="Ukraine">Ukraine</option>
                    <option value="United Arab Emirates">United Arab Emirates</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="United States Minor Outlying Islands">United States Minor Outlying Islands</option>
                    <option value="United States">United States</option>
                    <option value="Uruguay">Uruguay</option>
                    <option value="Uzbekistan">Uzbekistan</option>
                    <option value="Vanuatu">Vanuatu</option>
                    <option value="Venezuela">Venezuela</option>
                    <option value="Viet Nam">Viet Nam</option>
                    <option value="Virgin Islands (British)">Virgin Islands (British)</option>
                    <option value="Virgin Islands (U.S.)">Virgin Islands (U.S.)</option>
                    <option value="Wallis and Futuna">Wallis and Futuna</option>
                    <option value="Western Sahara">Western Sahara</option>
                    <option value="Yemen">Yemen</option>
                    <option value="Zambia">Zambia</option>
                    <option value="Zimbabwe">Zimbabwe</option>
                    <option value="Åland Islands">Åland Islands</option>

                  </select>
                </div>
                <div>
                  <label className="block text-sm text-[#a1a1aa] mb-1">Address Line 1</label>
                  <input
                    type="text"
                    value={addressObj.line1}
                    onChange={e => setAddressObj({ ...addressObj, line1: e.target.value })}
                    placeholder="Street address, P.O. box, company name"
                    required
                    className="w-full bg-black border border-[#27272a] rounded-lg px-3 py-2 text-white focus:border-white outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#a1a1aa] mb-1">Address Line 2 (Optional)</label>
                  <input
                    type="text"
                    value={addressObj.line2}
                    onChange={e => setAddressObj({ ...addressObj, line2: e.target.value })}
                    placeholder="Apartment, suite, unit, building, floor, etc."
                    className="w-full bg-black border border-[#27272a] rounded-lg px-3 py-2 text-white focus:border-white outline-none transition-colors"
                  />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm text-[#a1a1aa] mb-1">City</label>
                    <input
                      type="text"
                      value={addressObj.city}
                      onChange={e => setAddressObj({ ...addressObj, city: e.target.value })}
                      required
                      className="w-full bg-black border border-[#27272a] rounded-lg px-3 py-2 text-white focus:border-white outline-none transition-colors"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm text-[#a1a1aa] mb-1">State / Province</label>
                    <input
                      type="text"
                      value={addressObj.state}
                      onChange={e => setAddressObj({ ...addressObj, state: e.target.value })}
                      required
                      className="w-full bg-black border border-[#27272a] rounded-lg px-3 py-2 text-white focus:border-white outline-none transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-[#a1a1aa] mb-1">ZIP / Postal Code</label>
                  <input
                    type="text"
                    value={addressObj.postalCode}
                    onChange={e => setAddressObj({ ...addressObj, postalCode: e.target.value })}
                    required
                    className="w-full bg-black border border-[#27272a] rounded-lg px-3 py-2 text-white focus:border-white outline-none transition-colors"
                  />
                </div>
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
