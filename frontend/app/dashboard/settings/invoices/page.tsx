"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Download, Clock, Mail, Building, FileText, CheckCircle2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import BackgroundAnimation from "../../../components/BackgroundAnimation";
import Sidebar from "../../../components/Sidebar";

export default function InvoicesSettingsPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [billingData, setBillingData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Invoice Settings Form State
  const [companyName, setCompanyName] = useState('');
  const [invoiceEmail, setInvoiceEmail] = useState('');
  const [invoiceMemo, setInvoiceMemo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const fetchBillingData = async (token: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

      // Fetch user settings
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
        if (bData.invoiceSettings) {
          setCompanyName(bData.invoiceSettings.companyName || '');
          setInvoiceEmail(bData.invoiceSettings.invoiceEmail || '');
          setInvoiceMemo(bData.invoiceSettings.memo || '');
        }
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

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("bravocloud_token");
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

      const res = await fetch(`${apiUrl}/api/billing/invoice-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ invoiceSettings: { companyName, invoiceEmail, memo: invoiceMemo } })
      });

      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
        await fetchBillingData(token!);
      }
    } catch (error) {
      console.error("Failed to update invoice settings", error);
    } finally {
      setIsSubmitting(false);
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
        doc.addImage(base64data, 'PNG',  14, 10, 15, 15);
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
    doc.text("Western Province, CA 94105", 14, 42);
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
    const recipientName = billingData?.invoiceSettings?.companyName || user?.name || user?.username;
    if (recipientName) {
      doc.text(recipientName, 14, yPos);
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

    // Memo
    if (billingData?.invoiceSettings?.memo) {
      yPos += 10;
      doc.setFontSize(9);
      doc.setTextColor(161, 161, 170);
      doc.text("Notes: " + billingData.invoiceSettings.memo, 14, yPos);
      yPos += 5;
    }

    // Table
    const tableData = [
      ["BravoCloud Serverless Hosting (Monthly)", "$0.00", `$${inv.amount.toFixed(2)}`]
    ];

    autoTable(doc, {
      startY: yPos + 5,
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
            <p className="mt-4 text-[#a1a1aa] text-sm">Loading invoices...</p>
          </div>
        </div>
      </div>
    );
  }

  const { invoices } = billingData;

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
      <Sidebar user={user} />

      <div className="flex-1 flex flex-col relative overflow-y-auto overflow-x-hidden bg-black p-8">
        <BackgroundAnimation />

        <div className="max-w-5xl mx-auto flex flex-col gap-8 relative z-10 w-full mt-4 pb-20">

          {/* Header */}
          <div className="flex flex-col gap-2 pb-6 border-b border-[#27272a]">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              Invoices
            </h1>
            <p className="text-[#a1a1aa] max-w-2xl text-sm mt-1">
              Configure how your invoices are generated, view billing history, and download receipts.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            <div className="lg:col-span-2 space-y-8">
              
              {/* Invoices History */}
              <section className="bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden shadow-lg">
                <div className="p-6 border-b border-[#27272a]">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-1">
                    <Clock size={18} className="text-blue-400" /> Invoice History
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
                            <td className="px-6 py-4 text-[#a1a1aa]">{inv.invoiceNumber.replace('INV-', 'B')}</td>
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
              {/* Invoice Settings Panel */}
              <div className="bg-[#121214] border border-[#27272a] rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <FileText className="text-teal-400" size={20} />
                  <h3 className="text-white font-semibold">Invoice Settings</h3>
                </div>
                <form onSubmit={handleSaveSettings} className="space-y-4">
                  <div>
                    <label className="block text-sm text-[#a1a1aa] mb-1 flex items-center gap-2">
                      <Building size={14} /> Company Name
                    </label>
                    <input 
                      type="text"
                      value={companyName}
                      onChange={e => setCompanyName(e.target.value)}
                      placeholder="e.g. Acme Corp"
                      className="w-full bg-black border border-[#27272a] rounded-lg px-3 py-2 text-white focus:border-white outline-none transition-colors text-sm"
                    />
                    <p className="text-xs text-[#71717a] mt-1">Appears as the "Bill To" name on invoices.</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-[#a1a1aa] mb-1 flex items-center gap-2">
                      <Mail size={14} /> Invoice Email
                    </label>
                    <input 
                      type="email"
                      value={invoiceEmail}
                      onChange={e => setInvoiceEmail(e.target.value)}
                      placeholder="billing@example.com"
                      className="w-full bg-black border border-[#27272a] rounded-lg px-3 py-2 text-white focus:border-white outline-none transition-colors text-sm"
                    />
                    <p className="text-xs text-[#71717a] mt-1">Where PDF receipts should be sent.</p>
                  </div>

                  <div>
                    <label className="block text-sm text-[#a1a1aa] mb-1 flex items-center gap-2">
                      <FileText size={14} /> Custom Memo
                    </label>
                    <textarea 
                      value={invoiceMemo}
                      onChange={e => setInvoiceMemo(e.target.value)}
                      placeholder="PO Number: 12345..."
                      rows={3}
                      className="w-full bg-black border border-[#27272a] rounded-lg px-3 py-2 text-white focus:border-white outline-none transition-colors resize-none text-sm"
                    />
                    <p className="text-xs text-[#71717a] mt-1">Extra text added to the bottom of the invoice.</p>
                  </div>

                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-white hover:bg-gray-200 text-black py-2 rounded-lg font-semibold transition-colors flex items-center justify-center disabled:opacity-50 text-sm mt-2"
                  >
                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : (
                      savedSuccess ? <><CheckCircle2 size={16} className="mr-2" /> Saved!</> : 'Save Settings'
                    )}
                  </button>
                </form>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
