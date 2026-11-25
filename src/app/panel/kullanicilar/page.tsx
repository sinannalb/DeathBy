"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  Plus,
  ShieldCheck,
  Store,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { usePanelAuth } from "@/components/panel/PanelAuthContext";
import { UnauthorizedView } from "@/components/panel/UnauthorizedView";
import { apiFetch, formatDateTimeTR } from "@/components/panel/panel-utils";
import type { BranchDetailDTO, PanelUserDTO } from "@/lib/types";

export default function PanelUsersPage() {
  const { user } = usePanelAuth();
  const isAdmin = user?.role === "ADMIN";

  const [users, setUsers] = useState<PanelUserDTO[]>([]);
  const [branches, setBranches] = useState<BranchDetailDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<PanelUserDTO | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "SYSTEM">("SYSTEM");
  const [branchId, setBranchId] = useState("");
  const [saving, setSaving] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [usersRes, branchesRes] = await Promise.all([
        apiFetch<{ users: PanelUserDTO[] }>("/api/panel/users", {
          cache: "no-store",
        }),
        apiFetch<{ branches: BranchDetailDTO[] }>("/api/panel/branches", {
          cache: "no-store",
        }),
      ]);
      setUsers(usersRes.users);
      setBranches(branchesRes.branches);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Kullanıcılar yüklenemedi.",
      );
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) setModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen, saving]);

  if (!isAdmin) {
    return <UnauthorizedView />;
  }

  const openCreateModal = () => {
    setEditingUser(null);
    setName("");
    setEmail("");
    setPassword("");
    setRole("SYSTEM");
    setBranchId(branches[0]?.id ?? "");
    setModalOpen(true);
  };

  const openEditModal = (u: PanelUserDTO) => {
    setEditingUser(u);
    setName(u.name);
    setEmail(u.email);
    setPassword("");
    setRole(u.role);
    setBranchId(u.branchId ?? branches[0]?.id ?? "");
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (role === "SYSTEM" && !branchId) {
      setError("Şube (SYSTEM) kullanıcısı için şube seçilmelidir.");
      return;
    }
    if (!editingUser && password.length < 6) {
      setError("Şifre en az 6 karakter olmalıdır.");
      return;
    }
    if (editingUser && password.length > 0 && password.length < 6) {
      setError("Yeni şifre en az 6 karakter olmalıdır.");
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        const res = await apiFetch<{ user: PanelUserDTO }>("/api/panel/users", {
          method: "PATCH",
          body: JSON.stringify({
            id: editingUser.id,
            name: name.trim(),
            email: email.trim(),
            ...(password ? { password } : {}),
            role,
            branchId: role === "SYSTEM" ? branchId : null,
          }),
        });
        setUsers((prev) =>
          prev.map((u) => (u.id === res.user.id ? res.user : u)),
        );
        showToast(`"${res.user.name}" güncellendi.`);
      } else {
        const res = await apiFetch<{ user: PanelUserDTO }>("/api/panel/users", {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            password,
            role,
            branchId: role === "SYSTEM" ? branchId : null,
          }),
        });
        setUsers((prev) => [res.user, ...prev]);
        showToast(`"${res.user.name}" kullanıcısı oluşturuldu.`);
      }
      setModalOpen(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Kullanıcı kaydedilemedi.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-[#E5D7C8] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#24140E] sm:text-2xl">
            Panel Kullanıcıları
          </h1>
          <p className="mt-1 text-xs text-[#6E5549]">
            Yönetici (Admin) ve şube bazlı operasyon (System) hesaplarını
            yönetin.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#2C1810] px-4 py-2.5 text-xs font-bold text-[#FAF3EA] shadow-sm hover:bg-[#412418]"
        >
          <UserPlus className="h-4 w-4 text-[#D9A76A]" />
          <span>Yeni Kullanıcı Ekle</span>
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {toast && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-900">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Users Table */}
      {loading ? (
        <div className="h-56 animate-pulse rounded-2xl border border-[#E5D7C8] bg-white" />
      ) : users.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D6C4B2] bg-white p-12 text-center">
          <Users className="mx-auto h-10 w-10 text-[#B99D88]" />
          <h2 className="mt-3 text-base font-bold text-[#24140E]">
            Panel kullanıcısı bulunamadı
          </h2>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#E5D7C8] bg-white shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF6F0] text-[#5C3D2E]">
              <tr>
                <th className="px-5 py-3 font-bold">Ad Soyad</th>
                <th className="px-5 py-3 font-bold">E-posta</th>
                <th className="px-5 py-3 font-bold">Rol</th>
                <th className="px-5 py-3 font-bold">Atanmış Şube</th>
                <th className="px-5 py-3 font-bold">Oluşturulma</th>
                <th className="px-5 py-3 font-bold text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE5DA]">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-[#FCF9F5]">
                  <td className="px-5 py-3.5 font-bold text-[#24140E]">
                    {u.name}
                    {u.id === user?.id && (
                      <span className="ml-2 rounded-md bg-[#F5ECE2] px-1.5 py-0.5 text-[10px] font-bold text-[#8C6239]">
                        Siz
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-[#5C463B]">
                    {u.email}
                  </td>
                  <td className="px-5 py-3.5">
                    {u.role === "ADMIN" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-900">
                        <ShieldCheck className="h-3 w-3" />
                        Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-900">
                        <Store className="h-3 w-3" />
                        Şube Kullanıcısı
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-[#4A3429]">
                    {u.role === "ADMIN"
                      ? "Tüm Şubeler"
                      : u.branchName || "Atanmamış"}
                  </td>
                  <td className="px-5 py-3.5 text-[#6E5549]">
                    {formatDateTimeTR(u.createdAt)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => openEditModal(u)}
                      className="inline-flex items-center gap-1 rounded-xl border border-[#DAC8B8] bg-white px-3 py-1.5 text-xs font-semibold text-[#4A3429] hover:bg-[#FAF5EE]"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Düzenle</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit User Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (!saving) setModalOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[#E5D7C8] bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#EFE5DA] pb-3">
              <h2 className="text-lg font-bold text-[#24140E]">
                {editingUser ? "Kullanıcıyı Düzenle" : "Yeni Panel Kullanıcısı"}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-[#7A6256] hover:bg-[#FAF5EE]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#4A3429]">
                  Ad Soyad
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Örn: Beşiktaş Kasa"
                  className="mt-1.5 w-full rounded-xl border border-[#DAC8B8] px-3 py-2 text-sm focus:border-[#2C1810] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4A3429]">
                  E-posta Adresi
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sube@deathbychocolate.com"
                  className="mt-1.5 w-full rounded-xl border border-[#DAC8B8] px-3 py-2 text-sm focus:border-[#2C1810] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4A3429]">
                  Şifre{" "}
                  {editingUser && (
                    <span className="font-normal text-[#7A6256]">
                      (Değiştirmek istemiyorsanız boş bırakın)
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  minLength={editingUser ? undefined : 6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="En az 6 karakter"
                  className="mt-1.5 w-full rounded-xl border border-[#DAC8B8] px-3 py-2 text-sm focus:border-[#2C1810] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4A3429]">
                  Rol
                </label>
                <select
                  value={role}
                  onChange={(e) =>
                    setRole(e.target.value as "ADMIN" | "SYSTEM")
                  }
                  className="mt-1.5 w-full rounded-xl border border-[#DAC8B8] px-3 py-2 text-sm font-semibold focus:border-[#2C1810] focus:outline-none"
                >
                  <option value="SYSTEM">
                    Şube Kullanıcısı (SYSTEM — Tek Şube)
                  </option>
                  <option value="ADMIN">Yönetici (ADMIN — Tüm Yetkiler)</option>
                </select>
              </div>

              {role === "SYSTEM" && (
                <div>
                  <label className="block text-xs font-bold text-[#4A3429]">
                    Atanacak Şube
                  </label>
                  <select
                    required
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[#DAC8B8] px-3 py-2 text-sm font-semibold focus:border-[#2C1810] focus:outline-none"
                  >
                    <option value="" disabled>
                      Şube seçiniz...
                    </option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-[#DAC8B8] px-4 py-2 text-xs font-bold text-[#4A3429]"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#2C1810] px-4 py-2 text-xs font-bold text-[#FAF3EA] hover:bg-[#412418] disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5 text-[#D9A76A]" />
                  <span>{saving ? "Kaydediliyor..." : "Kaydet"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
