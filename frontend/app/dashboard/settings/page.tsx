"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, User as UserIcon, CreditCard, Key, Trash2, Plus, Copy, CheckCircle2, ShieldAlert } from "lucide-react";
import BackgroundAnimation from "../../components/BackgroundAnimation";
import Sidebar from "../../components/Sidebar";

const Github = ({ size = 20, className = "" }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

export default function GlobalSettingsPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Profile Form
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Token Generation Form
  const [newTokenName, setNewTokenName] = useState("");
  const [generatingToken, setGeneratingToken] = useState(false);
  const [newlyGeneratedToken, setNewlyGeneratedToken] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("bravocloud_token");
    if (!token) {
      window.location.href = "/";
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    fetch(`${apiUrl}/api/user/settings`, { headers: { "Authorization": `Bearer ${token}` } })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setTokens(data.tokens || []);
          setName(data.user.name || "");
          setUsername(data.user.username || "");
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const saveProfile = async () => {
    setSavingProfile(true);
    setProfileMessage("");
    const token = localStorage.getItem("bravocloud_token");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    try {
      const res = await fetch(`${apiUrl}/api/user/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, username })
      });

      if (res.ok) {
        setProfileMessage("Profile updated successfully!");
        setTimeout(() => setProfileMessage(""), 3000);
      } else {
        alert("Failed to update profile.");
      }
    } catch (err) {
      console.error(err);
      alert("Error updating profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image is too large. Maximum size is 5MB.");
      return;
    }
    
    setUploadingAvatar(true);
    setProfileMessage("");
    const token = localStorage.getItem("bravocloud_token");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    const formData = new FormData();
    formData.append("avatar", file);

    try {
      const res = await fetch(`${apiUrl}/api/user/avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (res.ok) {
        setUser({ ...user, avatarUrl: data.avatarUrl });
        setProfileMessage("Avatar updated!");
        setTimeout(() => setProfileMessage(""), 3000);
      } else {
        alert(data.error || "Failed to upload avatar.");
      }
    } catch (err) {
      console.error(err);
      alert("Error uploading avatar.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const generateToken = async () => {
    if (!newTokenName.trim()) return alert("Please enter a name for the token.");

    setGeneratingToken(true);
    const token = localStorage.getItem("bravocloud_token");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    try {
      const res = await fetch(`${apiUrl}/api/user/tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newTokenName })
      });

      const data = await res.json();
      if (res.ok) {
        setTokens([...tokens, data.token]);
        setNewlyGeneratedToken(data.secret);
        setNewTokenName("");
      } else {
        alert(data.error || "Failed to generate token.");
      }
    } catch (err) {
      console.error(err);
      alert("Error generating token.");
    } finally {
      setGeneratingToken(false);
    }
  };

  const revokeToken = async (tokenId: string) => {
    if (!confirm("Are you sure you want to revoke this token? Any scripts using it will immediately fail.")) return;

    const token = localStorage.getItem("bravocloud_token");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    try {
      const res = await fetch(`${apiUrl}/api/user/tokens/${tokenId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setTokens(tokens.filter(t => t.id !== tokenId));
      } else {
        alert("Failed to revoke token.");
      }
    } catch (err) {
      console.error(err);
      alert("Error revoking token.");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Token copied to clipboard! Save it securely.");
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

  if (!user) return null;

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
      <Sidebar user={user} />

      <div className="flex-1 flex flex-col relative overflow-y-auto overflow-x-hidden bg-black p-8">
        <BackgroundAnimation />

        <div className="max-w-4xl mx-auto flex flex-col gap-8 relative z-10 w-full mt-4 pb-20">

          {/* Header */}
          <div className="flex flex-col gap-2 pb-6 border-b border-[#27272a]">
            <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
            <p className="text-[#a1a1aa] max-w-2xl text-sm mt-1">
              Manage your personal profile, linked integrations, API access, and billing preferences.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">

            {/* Main Content Area */}
            <div className="md:col-span-12 space-y-8">

              {/* Profile Section */}
              <section className="bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden shadow-lg">
                <div className="p-6 border-b border-[#27272a]">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-6">
                    <UserIcon size={18} className="text-blue-400" /> Personal Profile
                  </h3>

                  <div className="flex flex-col md:flex-row gap-8 items-start">
                    <div className="flex flex-col items-center gap-3">
                      <div className="relative">
                        <img 
                          src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`} 
                          alt="Avatar" 
                          className={`w-24 h-24 rounded-full border-4 border-[#27272a] object-cover transition-opacity ${uploadingAvatar ? 'opacity-50' : 'opacity-100'}`}
                        />
                        {uploadingAvatar && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 text-white animate-spin" />
                          </div>
                        )}
                      </div>
                      
                      <label className="cursor-pointer text-xs text-[#a1a1aa] hover:text-white transition-colors bg-[#18181b] px-3 py-1.5 rounded-md border border-[#27272a] relative overflow-hidden">
                        {uploadingAvatar ? "Uploading..." : "Change Avatar"}
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          onChange={uploadAvatar}
                          disabled={uploadingAvatar}
                        />
                      </label>
                      <span className="text-[10px] text-[#71717a] mt-1 text-center">Max size: 5MB<br/>JPG, PNG, WebP</span>
                    </div>

                    <div className="flex-1 grid grid-cols-1 gap-5 w-full">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-[#e4e4e7] mb-1">Display Name</label>
                          <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-[#121214] border border-[#3f3f46] rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[#e4e4e7] mb-1">Username</label>
                          <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-[#121214] border border-[#3f3f46] rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#a1a1aa] mb-1">Email Address</label>
                        <input
                          type="email"
                          value={user.email || ""}
                          disabled
                          className="w-full bg-[#121214] border border-[#27272a] rounded-md px-3 py-2 text-[#71717a] text-sm cursor-not-allowed opacity-70"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-[#121214] p-4 flex items-center justify-between">
                  <span className="text-blue-400 text-sm font-medium flex items-center gap-2">
                    {profileMessage && <CheckCircle2 size={16} />} {profileMessage}
                  </span>
                  <button
                    onClick={saveProfile}
                    disabled={savingProfile}
                    className="bg-[#27272a] hover:bg-[#3f3f46] border border-[#3f3f46] disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
                  >
                    {savingProfile ? <Loader2 size={16} className="animate-spin" /> : "Save Profile"}
                  </button>
                </div>
              </section>

              {/* Linked Accounts */}
              <section className="bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden shadow-lg p-6">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-1">
                  <Github size={18} className="text-gray-300" /> Linked Integrations
                </h3>
                <p className="text-[#a1a1aa] text-sm mb-6 max-w-2xl">
                  Connect third-party accounts to BravoCloud to enable automated Git deployments and repository syncing.
                </p>

                <div className="border border-[#27272a] bg-[#121214] rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-[#27272a] p-3 rounded-md">
                      <Github size={24} className="text-white" />
                    </div>
                    <div>
                      <p className="text-white font-medium">GitHub Account</p>
                      <p className="text-[#a1a1aa] text-sm">Connected as <span className="text-blue-400">{user.username}</span></p>
                    </div>
                  </div>
                  <button className="text-sm bg-[#27272a] hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50 border border-[#3f3f46] px-4 py-2 rounded-md transition-colors text-white">
                    Disconnect
                  </button>
                </div>
              </section>

              {/* API Tokens */}
              <section className="bg-[#09090b] border border-[#27272a] rounded-xl overflow-hidden shadow-lg">
                <div className="p-6 border-b border-[#27272a]">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-1">
                    <Key size={18} className="text-yellow-400" /> Personal Access Tokens
                  </h3>
                  <p className="text-[#a1a1aa] text-sm mb-6 max-w-2xl">
                    Generate API tokens to programmatically interact with BravoCloud resources. These tokens have full access to your account and bypass SSO.
                  </p>

                  {newlyGeneratedToken && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
                      <h4 className="text-yellow-400 font-medium text-sm mb-2 flex items-center gap-2">
                        <ShieldAlert size={16} /> Save this token now!
                      </h4>
                      <p className="text-[#a1a1aa] text-sm mb-3">
                        Make sure to copy your personal access token now. You won't be able to see it again!
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={newlyGeneratedToken}
                          className="bg-[#09090b] border border-[#3f3f46] text-yellow-100 rounded-md px-3 py-2 text-sm w-full font-mono outline-none"
                        />
                        <button
                          onClick={() => copyToClipboard(newlyGeneratedToken)}
                          className="bg-yellow-600 hover:bg-yellow-500 text-black px-4 py-2 rounded-md flex items-center gap-2 font-medium text-sm transition-colors"
                        >
                          <Copy size={16} /> Copy
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-end gap-4 mb-6">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-[#e4e4e7] mb-1">Token Name</label>
                      <input
                        type="text"
                        value={newTokenName}
                        onChange={(e) => setNewTokenName(e.target.value)}
                        placeholder="e.g. CI/CD GitHub Action"
                        className="w-full bg-[#121214] border border-[#3f3f46] rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500 transition-colors"
                      />
                    </div>
                    <button
                      onClick={generateToken}
                      disabled={generatingToken || !newTokenName}
                      className="bg-[#27272a] hover:bg-[#3f3f46] border border-[#3f3f46] disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm h-[38px]"
                    >
                      {generatingToken ? <Loader2 size={16} className="animate-spin" /> : <><Plus size={16} /> Generate</>}
                    </button>
                  </div>

                  {tokens.length > 0 ? (
                    <div className="border border-[#27272a] rounded-lg overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-[#121214] border-b border-[#27272a] text-[#a1a1aa]">
                          <tr>
                            <th className="px-4 py-3 font-medium">Token Name</th>
                            <th className="px-4 py-3 font-medium">Created On</th>
                            <th className="px-4 py-3 font-medium text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#27272a]">
                          {tokens.map((token: any) => (
                            <tr key={token.id} className="hover:bg-[#121214] transition-colors">
                              <td className="px-4 py-3 font-medium text-white">{token.name}</td>
                              <td className="px-4 py-3 text-[#71717a]">{new Date(token.createdAt).toLocaleDateString()}</td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={() => revokeToken(token.id)}
                                  className="text-[#a1a1aa] hover:text-red-400 transition-colors"
                                  title="Revoke Token"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-[#71717a] text-sm text-center py-6 bg-[#121214] border border-[#27272a] border-dashed rounded-lg">
                      No active API tokens found.
                    </p>
                  )}
                </div>
              </section>



            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
