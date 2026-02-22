"use client";

import React, { useState, useEffect } from "react";
import { useRole } from "@/lib/RoleContext";
import { useToast } from "@/components/Toast";
import { formatNum } from "@/lib/format";
import {
  Loader2,
  Settings,
  Wifi,
  WifiOff,
  RefreshCw,
  MessageSquare,
  AlertTriangle,
  Check,
  X,
  Mail,
  Copy,
  ExternalLink,
} from "lucide-react";

interface WahaConfig {
  baseUrl: string;
  session: string;
  apiKey: string;
  groupId: string;
  groupName: string;
}

interface WahaGroup {
  id: string;
  name: string;
  participants?: { id: string }[];
}

interface SyncResult {
  total_members: number;
  total_participants: number;
  matched: number;
  updated: number;
  already_correct: number;
}

const DEFAULT_CONFIG: WahaConfig = {
  baseUrl: "",
  session: "default",
  apiKey: "",
  groupId: "",
  groupName: "",
};

const EMAIL_TEMPLATE_TYPES = [
  { key: "invite", label: "Undangan", subject: "Undangan Bergabung - Ikastara Kita" },
  { key: "confirmation", label: "Konfirmasi", subject: "Konfirmasi Email - Ikastara Kita" },
  { key: "recovery", label: "Reset Password", subject: "Atur Ulang Password - Ikastara Kita" },
  { key: "magic_link", label: "Magic Link", subject: "Masuk ke Ikastara Kita" },
];

export default function AdminSettingsPage() {
  const { canManageUsers, loading: roleLoading } = useRole();
  const { showToast } = useToast();

  // Active settings tab
  const [activeTab, setActiveTab] = useState<"whatsapp" | "email">("whatsapp");

  // WAHA state
  const [config, setConfig] = useState<WahaConfig>(DEFAULT_CONFIG);
  const [configLoading, setConfigLoading] = useState(true);
  const [testLoading, setTestLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "failed">("idle");
  const [groups, setGroups] = useState<WahaGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  // Email template state
  const [activeEmailTab, setActiveEmailTab] = useState("invite");
  const [copiedHtml, setCopiedHtml] = useState<string | null>(null);
  const [copiedSubject, setCopiedSubject] = useState<string | null>(null);

  // Load existing config on mount
  useEffect(() => {
    if (!roleLoading && canManageUsers) {
      loadConfig();
    } else if (!roleLoading && !canManageUsers) {
      setConfigLoading(false);
    }
  }, [roleLoading, canManageUsers]);

  async function loadConfig() {
    setConfigLoading(true);
    try {
      const response = await fetch("/api/settings?key=waha_config");
      if (!response.ok) throw new Error("Gagal memuat konfigurasi");
      const data = await response.json();
      if (data.value) {
        const saved = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
        setConfig({ ...DEFAULT_CONFIG, ...saved });
        if (saved.groupId) {
          setSelectedGroupId(saved.groupId);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal memuat konfigurasi";
      showToast(message, "error");
    } finally {
      setConfigLoading(false);
    }
  }

  async function handleTestConnection() {
    if (!config.baseUrl.trim()) {
      showToast("Base URL harus diisi", "error");
      return;
    }

    setTestLoading(true);
    setConnectionStatus("idle");
    try {
      const params = new URLSearchParams({
        baseUrl: config.baseUrl,
        session: config.session,
      });
      if (config.apiKey) params.set("apiKey", config.apiKey);

      const response = await fetch(`/api/waha/groups?${params.toString()}`);
      if (!response.ok) throw new Error("Koneksi gagal");

      setConnectionStatus("success");
      showToast("Koneksi berhasil!", "success");
    } catch {
      setConnectionStatus("failed");
      showToast("Koneksi gagal. Periksa konfigurasi WAHA.", "error");
    } finally {
      setTestLoading(false);
    }
  }

  async function handleSaveConfig() {
    if (!config.baseUrl.trim()) {
      showToast("Base URL harus diisi", "error");
      return;
    }

    setSaveLoading(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "waha_config", value: config }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Gagal menyimpan konfigurasi");
      }

      showToast("Konfigurasi berhasil disimpan", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal menyimpan konfigurasi";
      showToast(message, "error");
    } finally {
      setSaveLoading(false);
    }
  }

  async function handleLoadGroups() {
    if (!config.baseUrl.trim()) {
      showToast("Simpan konfigurasi terlebih dahulu", "error");
      return;
    }

    setGroupsLoading(true);
    try {
      const params = new URLSearchParams({
        baseUrl: config.baseUrl,
        session: config.session,
      });
      if (config.apiKey) params.set("apiKey", config.apiKey);

      const response = await fetch(`/api/waha/groups?${params.toString()}`);
      if (!response.ok) throw new Error("Gagal memuat daftar grup");

      const data = await response.json();
      setGroups(data);
      showToast(`${data.length} grup ditemukan`, "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal memuat daftar grup";
      showToast(message, "error");
    } finally {
      setGroupsLoading(false);
    }
  }

  async function handleSaveGroup() {
    if (!selectedGroupId) {
      showToast("Pilih grup terlebih dahulu", "error");
      return;
    }

    const selectedGroup = groups.find((g) => g.id === selectedGroupId);
    const updatedConfig: WahaConfig = {
      ...config,
      groupId: selectedGroupId,
      groupName: selectedGroup?.name || "",
    };

    setSaveLoading(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "waha_config", value: updatedConfig }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Gagal menyimpan grup");
      }

      setConfig(updatedConfig);
      showToast("Grup berhasil disimpan", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal menyimpan grup";
      showToast(message, "error");
    } finally {
      setSaveLoading(false);
    }
  }

  async function handleSync() {
    setSyncLoading(true);
    setSyncResult(null);
    try {
      const response = await fetch("/api/waha/sync", {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Gagal melakukan sinkronisasi");
      }

      const data: SyncResult = await response.json();
      setSyncResult(data);
      showToast("Sinkronisasi berhasil!", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal melakukan sinkronisasi";
      showToast(message, "error");
    } finally {
      setSyncLoading(false);
    }
  }

  // Email template helpers
  const copyHtml = async (key: string) => {
    try {
      const res = await fetch(`/api/email-templates?type=${key}`);
      const data = await res.json();
      await navigator.clipboard.writeText(data.html);
      setCopiedHtml(key);
      setTimeout(() => setCopiedHtml(null), 2000);
      showToast("HTML template berhasil disalin", "success");
    } catch {
      showToast("Gagal menyalin template", "error");
    }
  };

  const copySubject = async (subject: string, key: string) => {
    await navigator.clipboard.writeText(subject);
    setCopiedSubject(key);
    setTimeout(() => setCopiedSubject(null), 2000);
    showToast("Subject berhasil disalin", "success");
  };

  // Loading state
  if (roleLoading || configLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#0B27BC]" />
          <p className="text-sm text-muted-foreground">Memuat data...</p>
        </div>
      </div>
    );
  }

  // Access denied
  if (!canManageUsers) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-center px-4">
          <div className="p-3 rounded-full bg-red-100">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Akses Ditolak</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Anda tidak memiliki izin untuk mengakses halaman ini. Hanya admin yang dapat mengelola pengaturan.
          </p>
        </div>
      </div>
    );
  }

  const activeEmailTemplate = EMAIL_TEMPLATE_TYPES.find((t) => t.key === activeEmailTab)!;

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0B27BC] text-white shadow-lg">
        <div className="px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-[#FE8DA1]" />
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white">Pengaturan</h1>
              <p className="text-xs text-white/70">Kelola konfigurasi sistem</p>
            </div>
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-[#fcb7c3] via-[#FE8DA1] to-[#fcb7c3]" />
      </header>

      <div className="px-4 sm:px-6 py-6 max-w-2xl mx-auto space-y-4">
        {/* Tab Switcher */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("whatsapp")}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === "whatsapp"
                ? "bg-[#0B27BC] text-white shadow-sm"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            WhatsApp
          </button>
          <button
            onClick={() => setActiveTab("email")}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              activeTab === "email"
                ? "bg-[#0B27BC] text-white shadow-sm"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            <Mail className="w-4 h-4" />
            Email Templates
          </button>
        </div>

        {/* ── WhatsApp Tab ─────────────────────────────────────────── */}
        {activeTab === "whatsapp" && (
          <div className="space-y-6">
            {/* Section 1: WAHA Configuration */}
            <div className="bg-white rounded-xl border border-border p-4 sm:p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
                <Settings className="w-4 h-4 text-[#0B27BC]" />
                Konfigurasi WAHA
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Base URL</label>
                  <input
                    type="text"
                    value={config.baseUrl}
                    onChange={(e) => setConfig((prev) => ({ ...prev, baseUrl: e.target.value }))}
                    placeholder="http://localhost:3000"
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Session</label>
                  <input
                    type="text"
                    value={config.session}
                    onChange={(e) => setConfig((prev) => ({ ...prev, session: e.target.value }))}
                    placeholder="default"
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">API Key</label>
                  <input
                    type="password"
                    value={config.apiKey}
                    onChange={(e) => setConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
                    placeholder="Opsional"
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]"
                  />
                </div>

                {connectionStatus !== "idle" && (
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                      connectionStatus === "success"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-red-50 text-red-700 border border-red-200"
                    }`}
                  >
                    {connectionStatus === "success" ? (
                      <><Check className="w-4 h-4" /><span>Koneksi berhasil</span></>
                    ) : (
                      <><X className="w-4 h-4" /><span>Koneksi gagal</span></>
                    )}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    onClick={handleTestConnection}
                    disabled={testLoading}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-[#0B27BC] bg-[#0B27BC]/10 rounded-lg hover:bg-[#0B27BC]/20 transition-colors disabled:opacity-50"
                  >
                    {testLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : connectionStatus === "success" ? (
                      <Wifi className="w-4 h-4" />
                    ) : connectionStatus === "failed" ? (
                      <WifiOff className="w-4 h-4" />
                    ) : (
                      <Wifi className="w-4 h-4" />
                    )}
                    Test Koneksi
                  </button>
                  <button
                    onClick={handleSaveConfig}
                    disabled={saveLoading}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0B27BC] rounded-lg hover:bg-[#091fa0] transition-colors disabled:opacity-50"
                  >
                    {saveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
                    Simpan Konfigurasi
                  </button>
                </div>
              </div>
            </div>

            {/* Section 2: Target WhatsApp Group */}
            {config.baseUrl.trim() && (
              <div className="bg-white rounded-xl border border-border p-4 sm:p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
                  <MessageSquare className="w-4 h-4 text-[#0B27BC]" />
                  Target Grup WhatsApp
                </h3>

                <div className="space-y-4">
                  {config.groupName && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0B27BC]/5 border border-[#0B27BC]/10">
                      <MessageSquare className="w-4 h-4 text-[#0B27BC]" />
                      <div className="text-sm">
                        <span className="text-gray-500">Grup aktif: </span>
                        <span className="font-medium text-foreground">{config.groupName}</span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleLoadGroups}
                    disabled={groupsLoading}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-[#0B27BC] bg-[#0B27BC]/10 rounded-lg hover:bg-[#0B27BC]/20 transition-colors disabled:opacity-50"
                  >
                    {groupsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Muat Daftar Grup
                  </button>

                  {groups.length > 0 && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Pilih Grup</label>
                        <select
                          value={selectedGroupId}
                          onChange={(e) => setSelectedGroupId(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] bg-white"
                        >
                          <option value="">-- Pilih grup --</option>
                          {groups.map((group) => (
                            <option key={group.id} value={group.id}>
                              {group.name}
                              {group.participants ? ` (${group.participants.length} peserta)` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={handleSaveGroup}
                        disabled={saveLoading || !selectedGroupId}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0B27BC] rounded-lg hover:bg-[#091fa0] transition-colors disabled:opacity-50"
                      >
                        {saveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Simpan Grup
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Section 3: Sync */}
            {config.groupId && (
              <div className="bg-white rounded-xl border border-border p-4 sm:p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
                  <RefreshCw className="w-4 h-4 text-[#0B27BC]" />
                  Sinkronisasi Grup
                </h3>

                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Sinkronisasi data anggota dengan peserta grup WhatsApp{" "}
                    <span className="font-medium text-foreground">{config.groupName}</span>.
                  </p>

                  <button
                    onClick={handleSync}
                    disabled={syncLoading}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0B27BC] rounded-lg hover:bg-[#091fa0] transition-colors disabled:opacity-50"
                  >
                    {syncLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Sync Sekarang
                  </button>

                  {syncLoading && (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#0B27BC]/5 border border-[#0B27BC]/10">
                      <Loader2 className="w-5 h-5 animate-spin text-[#0B27BC]" />
                      <span className="text-sm text-[#0B27BC] font-medium">Sedang melakukan sinkronisasi...</span>
                    </div>
                  )}

                  {syncResult && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                        <Check className="w-4 h-4" />
                        Sinkronisasi selesai
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="bg-gray-50 rounded-lg border border-border p-3 text-center">
                          <p className="text-xl font-bold text-foreground">{formatNum(syncResult.total_members)}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Total anggota di database</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg border border-border p-3 text-center">
                          <p className="text-xl font-bold text-foreground">{formatNum(syncResult.total_participants)}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Total peserta di grup</p>
                        </div>
                        <div className="bg-[#0B27BC]/5 rounded-lg border border-[#0B27BC]/10 p-3 text-center">
                          <p className="text-xl font-bold text-[#0B27BC]">{formatNum(syncResult.matched)}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Yang cocok</p>
                        </div>
                        <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-3 text-center">
                          <p className="text-xl font-bold text-emerald-700">{formatNum(syncResult.updated)}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Yang diperbarui</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg border border-border p-3 text-center">
                          <p className="text-xl font-bold text-foreground">{formatNum(syncResult.already_correct)}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Yang sudah benar</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Email Templates Tab ──────────────────────────────────── */}
        {activeTab === "email" && (
          <div className="space-y-4">
            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">Cara Menggunakan</h3>
              <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
                <li>Pilih template di bawah, lalu klik <strong>&quot;Copy HTML&quot;</strong></li>
                <li>
                  Buka{" "}
                  <a
                    href="https://supabase.com/dashboard/project/unzusbynaxkticlgtrsg/auth/templates"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-medium inline-flex items-center gap-0.5"
                  >
                    Supabase Dashboard
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li>Pilih template yang sesuai (Invite, Confirm signup, dll.)</li>
                <li>Ganti <strong>Subject</strong> dengan subject yang sudah disediakan</li>
                <li>Paste HTML ke field <strong>&quot;Body&quot;</strong>, lalu <strong>&quot;Save&quot;</strong></li>
              </ol>
            </div>

            {/* Email template tabs */}
            <div className="flex gap-2 flex-wrap">
              {EMAIL_TEMPLATE_TYPES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveEmailTab(t.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    activeEmailTab === t.key
                      ? "bg-[#0B27BC] text-white shadow-sm"
                      : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Active template card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Template info bar */}
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
                <div className="space-y-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900">{activeEmailTemplate.label}</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-500">Subject:</span>
                    <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono truncate max-w-[200px]">
                      {activeEmailTemplate.subject}
                    </code>
                    <button
                      onClick={() => copySubject(activeEmailTemplate.subject, activeEmailTemplate.key)}
                      className="text-xs text-[#0B27BC] hover:underline inline-flex items-center gap-1 shrink-0"
                    >
                      {copiedSubject === activeEmailTemplate.key ? (
                        <><Check className="w-3 h-3" /> Copied</>
                      ) : (
                        <><Copy className="w-3 h-3" /> Copy</>
                      )}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => copyHtml(activeEmailTemplate.key)}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors shrink-0 ${
                    copiedHtml === activeEmailTemplate.key
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-[#0B27BC] text-white hover:bg-[#091fa0]"
                  }`}
                >
                  {copiedHtml === activeEmailTemplate.key ? (
                    <><Check className="w-4 h-4" /> Copied!</>
                  ) : (
                    <><Copy className="w-4 h-4" /> Copy HTML</>
                  )}
                </button>
              </div>

              {/* Preview iframe */}
              <div className="bg-gray-100 p-3 sm:p-4">
                <div className="bg-white rounded-lg shadow-inner mx-auto" style={{ maxWidth: 520 }}>
                  <iframe
                    src={`/api/email-templates?type=${activeEmailTab}_html`}
                    className="w-full border-0 rounded-lg"
                    style={{ height: 520 }}
                    title={`Preview: ${activeEmailTemplate.label}`}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
