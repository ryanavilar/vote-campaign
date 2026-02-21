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

export default function AdminSettingsPage() {
  const { canManageUsers, loading: roleLoading } = useRole();
  const { showToast } = useToast();

  const [config, setConfig] = useState<WahaConfig>(DEFAULT_CONFIG);
  const [configLoading, setConfigLoading] = useState(true);
  const [testLoading, setTestLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);

  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "success" | "failed"
  >("idle");
  const [groups, setGroups] = useState<WahaGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

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
      const message =
        err instanceof Error ? err.message : "Gagal memuat konfigurasi";
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
      const message =
        err instanceof Error ? err.message : "Gagal menyimpan konfigurasi";
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
      const message =
        err instanceof Error ? err.message : "Gagal memuat daftar grup";
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
      const message =
        err instanceof Error ? err.message : "Gagal menyimpan grup";
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
      const message =
        err instanceof Error ? err.message : "Gagal melakukan sinkronisasi";
      showToast(message, "error");
    } finally {
      setSyncLoading(false);
    }
  }

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
          <h2 className="text-lg font-semibold text-foreground">
            Akses Ditolak
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Anda tidak memiliki izin untuk mengakses halaman ini. Hanya admin
            yang dapat mengelola pengaturan.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0B27BC] text-white shadow-lg">
        <div className="px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-[#FE8DA1]" />
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white">
                Pengaturan
              </h1>
              <p className="text-xs text-white/70">
                Konfigurasi integrasi WhatsApp (WAHA)
              </p>
            </div>
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-[#fcb7c3] via-[#FE8DA1] to-[#fcb7c3]" />
      </header>

      <div className="px-4 sm:px-6 py-6 max-w-2xl mx-auto space-y-6">
        {/* Section 1: WAHA Configuration */}
        <div className="bg-white rounded-xl border border-border p-4 sm:p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
            <Settings className="w-4 h-4 text-[#0B27BC]" />
            Konfigurasi WAHA
          </h3>

          <div className="space-y-4">
            {/* Base URL */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Base URL
              </label>
              <input
                type="text"
                value={config.baseUrl}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, baseUrl: e.target.value }))
                }
                placeholder="http://localhost:3000"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]"
              />
            </div>

            {/* Session */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Session
              </label>
              <input
                type="text"
                value={config.session}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, session: e.target.value }))
                }
                placeholder="default"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]"
              />
            </div>

            {/* API Key */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                API Key
              </label>
              <input
                type="password"
                value={config.apiKey}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, apiKey: e.target.value }))
                }
                placeholder="Opsional"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC]"
              />
            </div>

            {/* Connection status */}
            {connectionStatus !== "idle" && (
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                  connectionStatus === "success"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {connectionStatus === "success" ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Koneksi berhasil</span>
                  </>
                ) : (
                  <>
                    <X className="w-4 h-4" />
                    <span>Koneksi gagal</span>
                  </>
                )}
              </div>
            )}

            {/* Action buttons */}
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
                {saveLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Settings className="w-4 h-4" />
                )}
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
              {/* Current group info */}
              {config.groupName && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0B27BC]/5 border border-[#0B27BC]/10">
                  <MessageSquare className="w-4 h-4 text-[#0B27BC]" />
                  <div className="text-sm">
                    <span className="text-gray-500">Grup aktif: </span>
                    <span className="font-medium text-foreground">
                      {config.groupName}
                    </span>
                  </div>
                </div>
              )}

              {/* Load groups button */}
              <button
                onClick={handleLoadGroups}
                disabled={groupsLoading}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-[#0B27BC] bg-[#0B27BC]/10 rounded-lg hover:bg-[#0B27BC]/20 transition-colors disabled:opacity-50"
              >
                {groupsLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Muat Daftar Grup
              </button>

              {/* Group select dropdown */}
              {groups.length > 0 && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Pilih Grup
                    </label>
                    <select
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B27BC]/20 focus:border-[#0B27BC] bg-white"
                    >
                      <option value="">-- Pilih grup --</option>
                      {groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                          {group.participants
                            ? ` (${group.participants.length} peserta)`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={handleSaveGroup}
                    disabled={saveLoading || !selectedGroupId}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0B27BC] rounded-lg hover:bg-[#091fa0] transition-colors disabled:opacity-50"
                  >
                    {saveLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
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
                <span className="font-medium text-foreground">
                  {config.groupName}
                </span>
                .
              </p>

              <button
                onClick={handleSync}
                disabled={syncLoading}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0B27BC] rounded-lg hover:bg-[#091fa0] transition-colors disabled:opacity-50"
              >
                {syncLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Sync Sekarang
              </button>

              {/* Sync loading indicator */}
              {syncLoading && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#0B27BC]/5 border border-[#0B27BC]/10">
                  <Loader2 className="w-5 h-5 animate-spin text-[#0B27BC]" />
                  <span className="text-sm text-[#0B27BC] font-medium">
                    Sedang melakukan sinkronisasi...
                  </span>
                </div>
              )}

              {/* Sync results */}
              {syncResult && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                    <Check className="w-4 h-4" />
                    Sinkronisasi selesai
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-gray-50 rounded-lg border border-border p-3 text-center">
                      <p className="text-xl font-bold text-foreground">
                        {formatNum(syncResult.total_members)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Total anggota di database
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg border border-border p-3 text-center">
                      <p className="text-xl font-bold text-foreground">
                        {formatNum(syncResult.total_participants)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Total peserta di grup
                      </p>
                    </div>
                    <div className="bg-[#0B27BC]/5 rounded-lg border border-[#0B27BC]/10 p-3 text-center">
                      <p className="text-xl font-bold text-[#0B27BC]">
                        {formatNum(syncResult.matched)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Yang cocok
                      </p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-3 text-center">
                      <p className="text-xl font-bold text-emerald-700">
                        {formatNum(syncResult.updated)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Yang diperbarui
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg border border-border p-3 text-center">
                      <p className="text-xl font-bold text-foreground">
                        {formatNum(syncResult.already_correct)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Yang sudah benar
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
