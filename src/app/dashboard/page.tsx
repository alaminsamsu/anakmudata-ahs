'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import MakassarMap from '@/components/MakassarMap';

interface District {
  id: string;
  name: string;
}

interface Village {
  id: string;
  district_id: string;
  name: string;
  slug: string;
  total_tps: number;
  total_dpt: number;
  target_votes: number;
}

interface Volunteer {
  id: string;
  village_id: string;
  tps_number: number;
  full_name: string;
  nik: string;
  whatsapp_number: string;
  ktp_storage_path: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
}

export default function DashboardOverviewPage() {
  const [districts, setDistricts] = useState<District[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [coordinatorCount, setCoordinatorCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewVolunteer, setPreviewVolunteer] = useState<Volunteer | null>(null);
  const [rejectingVolunteer, setRejectingVolunteer] = useState<Volunteer | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    const [distRes, villRes, volRes, coordRes] = await Promise.all([
      supabase.from('districts').select('id, name').order('name'),
      supabase.from('villages').select('id, district_id, name, slug, total_tps, total_dpt, target_votes').order('name'),
      supabase.from('volunteers').select('*').order('created_at', { ascending: false }),
      supabase.from('coordinators').select('id', { count: 'exact', head: true }),
    ]);

    if (distRes.data) setDistricts(distRes.data);
    if (villRes.data) setVillages(villRes.data);
    if (volRes.data) setVolunteers(volRes.data as Volunteer[]);
    if (typeof coordRes.count === 'number') setCoordinatorCount(coordRes.count);
    setLoading(false);
  }

  const districtMap = useMemo(() => {
    const map: Record<string, string> = {};
    districts.forEach((d) => (map[d.id] = d.name));
    return map;
  }, [districts]);

  const villageMap = useMemo(() => {
    const map: Record<string, Village> = {};
    villages.forEach((v) => (map[v.id] = v));
    return map;
  }, [villages]);

  const kpi = useMemo(() => {
    const totalTps = villages.reduce((sum, v) => sum + (v.total_tps || 0), 0);
    const totalDpt = villages.reduce((sum, v) => sum + (v.total_dpt || 0), 0);
    const totalTarget = villages.reduce((sum, v) => sum + (v.target_votes || 0), 0);

    const approved = volunteers.filter((v) => v.status === 'approved').length;
    const pending = volunteers.filter((v) => v.status === 'pending').length;
    const rejected = volunteers.filter((v) => v.status === 'rejected').length;
    const tpsCoveragePct = totalTps > 0 ? Math.round((approved / totalTps) * 100) : 0;

    return { totalTps, totalDpt, totalTarget, approved, pending, rejected, tpsCoveragePct };
  }, [villages, volunteers]);

  const districtRecap = useMemo(() => {
    return districts.map((d) => {
      const distVillages = villages.filter((v) => v.district_id === d.id);
      const villageIds = new Set(distVillages.map((v) => v.id));

      const totalTps = distVillages.reduce((s, v) => s + (v.total_tps || 0), 0);
      const totalDpt = distVillages.reduce((s, v) => s + (v.total_dpt || 0), 0);
      const targetVotes = distVillages.reduce((s, v) => s + (v.target_votes || 0), 0);
      const approved = volunteers.filter((vol) => villageIds.has(vol.village_id) && vol.status === 'approved').length;
      const pending = volunteers.filter((vol) => villageIds.has(vol.village_id) && vol.status === 'pending').length;
      const pct = totalTps > 0 ? Math.min(100, Math.round((approved / totalTps) * 100)) : 0;

      return {
        id: d.id,
        name: d.name,
        kelurahanCount: distVillages.length,
        totalTps,
        totalDpt,
        targetVotes,
        approved,
        pending,
        pct,
      };
    });
  }, [districts, villages, volunteers]);

  const filteredVolunteers = useMemo(() => {
    if (statusFilter === 'all') return volunteers;
    return volunteers.filter((v) => v.status === statusFilter);
  }, [volunteers, statusFilter]);

  const handlePreviewKtp = (vol: Volunteer) => {
    setPreviewVolunteer(vol);
    if (!vol.ktp_storage_path) {
      setPreviewUrl(null);
      return;
    }
    const { data } = supabase.storage.from('ktp-photos').getPublicUrl(vol.ktp_storage_path);
    setPreviewUrl(data?.publicUrl || null);
  };

  const handleApprove = async (vol: Volunteer) => {
    setProcessingId(vol.id);
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase
      .from('volunteers')
      .update({
        status: 'approved',
        rejection_reason: null,
        verified_by: session?.user?.id || null,
      })
      .eq('id', vol.id);

    setProcessingId(null);
    if (!error) {
      setVolunteers((prev) =>
        prev.map((item) => (item.id === vol.id ? { ...item, status: 'approved', rejection_reason: null } : item))
      );
    } else {
      alert('Gagal memverifikasi: ' + error.message);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingVolunteer) return;
    setProcessingId(rejectingVolunteer.id);
    const { data: { session } } = await supabase.auth.getSession();
    const reason = rejectReason.trim() || 'Data / foto KTP tidak jelas';

    const { error } = await supabase
      .from('volunteers')
      .update({
        status: 'rejected',
        rejection_reason: reason,
        verified_by: session?.user?.id || null,
      })
      .eq('id', rejectingVolunteer.id);

    setProcessingId(null);
    if (!error) {
      setVolunteers((prev) =>
        prev.map((item) =>
          item.id === rejectingVolunteer.id ? { ...item, status: 'rejected', rejection_reason: reason } : item
        )
      );
      setRejectingVolunteer(null);
      setRejectReason('');
    } else {
      alert('Gagal menolak data: ' + error.message);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Title & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            Command Center Makassar
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-rose-100 text-rose-600">
              Real-Time
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitoring capaian relawan TPS, data DPT, dan persebaran kekuatan di {districts.length} kecamatan.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 shadow-xs transition"
          >
            ↻ Refresh Data
          </button>
          <Link
            href="/dashboard/wilayah"
            className="px-4 py-2.5 bg-gradient-to-r from-rose-500 via-pink-500 to-indigo-600 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-500/20 hover:opacity-95 transition"
          >
            + Bagikan Link Kelurahan
          </Link>
        </div>
      </div>

      {/* 4 Metric Overview KPI Cards (Gaya Stitch) */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* KPI 1 */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-xl font-bold">
              🗂️
            </div>
            <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-100">
              DPT Induk
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total DPT Terdata</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1">
              {kpi.totalDpt.toLocaleString('id-ID')}
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Target Suara: {kpi.totalTarget.toLocaleString('id-ID')}
            </p>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl font-bold">
              🛡️
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
              {kpi.tpsCoveragePct}% TPS
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Relawan Terverifikasi</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1">
              {kpi.approved.toLocaleString('id-ID')}
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Validasi KTP Lapangan
            </p>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-xl font-bold">
              ⏳
            </div>
            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
              Antrean
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Menunggu Verifikasi</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1">
              {kpi.pending.toLocaleString('id-ID')}
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" /> Ditolak: {kpi.rejected} pendaftar
            </p>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl font-bold">
              📍
            </div>
            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full">
              {coordinatorCount} Korcam/Admin
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total TPS Makassar</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1">
              {kpi.totalTps.toLocaleString('id-ID')}
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Tersebar di {villages.length} Kelurahan
            </p>
          </div>
        </div>
      </section>

      {/* Peta Interaktif Poligon Kota Makassar */}
      <MakassarMap districts={districtRecap} />

      {/* Tabel Verifikasi Relawan TPS (Gaya Stitch) */}
      <section className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              Verifikasi Data Relawan & Berkas KTP
              <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-bold border border-emerald-200">
                {kpi.approved} Disetujui
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Validasi sinkronisasi data relawan lapangan, NIK, dan lampiran foto KTP.
            </p>
          </div>

          <div className="flex flex-wrap items-center p-1 bg-slate-100 rounded-xl text-xs font-semibold">
            {(
              [
                { key: 'all', label: `Semua (${volunteers.length})` },
                { key: 'approved', label: `Approved (${kpi.approved})` },
                { key: 'pending', label: `Pending (${kpi.pending})` },
                { key: 'rejected', label: `Rejected (${kpi.rejected})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3.5 py-1.5 rounded-lg transition ${
                  statusFilter === tab.key
                    ? 'bg-rose-500 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-4">Nama Relawan</th>
                <th className="py-3.5 px-4">NIK</th>
                <th className="py-3.5 px-4">Wilayah & Kelurahan</th>
                <th className="py-3.5 px-4">TPS</th>
                <th className="py-3.5 px-4">Dokumen KTP</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Memuat data relawan...
                  </td>
                </tr>
              ) : filteredVolunteers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Belum ada data relawan pada filter ini.
                  </td>
                </tr>
              ) : (
                filteredVolunteers.slice(0, 25).map((vol) => {
                  const vill = villageMap[vol.village_id];
                  const distName = vill ? districtMap[vill.district_id] : '-';
                  const initials = vol.full_name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  return (
                    <tr key={vol.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0">
                            {initials}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{vol.full_name}</p>
                            <a
                              href={`https://wa.me/${vol.whatsapp_number.replace(/^0/, '62')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-emerald-600 hover:underline"
                            >
                              WA: {vol.whatsapp_number}
                            </a>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">{vol.nik}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {distName} <span className="text-slate-400 font-normal">/ {vill?.name || '-'}</span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        TPS {String(vol.tps_number).padStart(2, '0')}
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handlePreviewKtp(vol)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition"
                        >
                          🪪 Lihat Foto
                        </button>
                      </td>
                      <td className="py-3.5 px-4">
                        {vol.status === 'approved' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Approved
                          </span>
                        )}
                        {vol.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Pending
                          </span>
                        )}
                        {vol.status === 'rejected' && (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Rejected
                            </span>
                            {vol.rejection_reason && (
                              <p className="text-[10px] text-rose-500 mt-0.5">{vol.rejection_reason}</p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {vol.status !== 'approved' && (
                          <button
                            disabled={processingId === vol.id}
                            onClick={() => handleApprove(vol)}
                            className="px-2.5 py-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-bold rounded-lg"
                          >
                            ✓ Terima
                          </button>
                        )}
                        {vol.status !== 'rejected' && (
                          <button
                            disabled={processingId === vol.id}
                            onClick={() => {
                              setRejectingVolunteer(vol);
                              setRejectReason(vol.rejection_reason || '');
                            }}
                            className="px-2.5 py-1 text-rose-600 bg-rose-50 hover:bg-rose-100 font-bold rounded-lg"
                          >
                            ✕ Tolak
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal Pratinjau Foto KTP */}
      {previewVolunteer && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Foto KTP — {previewVolunteer.full_name}
              </h3>
              <button
                onClick={() => setPreviewVolunteer(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-xl">
              <div>NIK: <b>{previewVolunteer.nik}</b></div>
              <div>WhatsApp: <b>{previewVolunteer.whatsapp_number}</b></div>
              <div>TPS: <b>TPS {String(previewVolunteer.tps_number).padStart(3, '0')}</b></div>
            </div>

            {previewUrl ? (
              <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center max-h-80">
                <img src={previewUrl} alt="Foto KTP" className="object-contain max-h-80 w-full" />
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                Tidak ada lampiran foto KTP untuk pendaftar ini.
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPreviewVolunteer(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
              >
                Tutup
              </button>
              {previewVolunteer.status !== 'approved' && (
                <button
                  onClick={() => {
                    handleApprove(previewVolunteer);
                    setPreviewVolunteer(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  ✓ Sahkan Relawan
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Alasan Penolakan */}
      {rejectingVolunteer && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">
              Tolak Pendaftaran — {rejectingVolunteer.full_name}
            </h3>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Alasan Penolakan
              </label>
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Misal: Foto KTP buram / NIK tidak terbaca"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectingVolunteer(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-4 py-2 rounded-lg bg-rose-600 text-xs font-semibold text-white hover:bg-rose-700"
              >
                Konfirmasi Tolak
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}