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

  // Filter antrean verifikasi
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

  // Modal pratinjau KTP & penolakan
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

  // Statistik KPI Global Makassar
  const kpi = useMemo(() => {
    const totalTps = villages.reduce((sum, v) => sum + (v.total_tps || 0), 0);
    const totalDpt = villages.reduce((sum, v) => sum + (v.total_dpt || 0), 0);
    const totalTarget = villages.reduce((sum, v) => sum + (v.target_votes || 0), 0);

    const approved = volunteers.filter((v) => v.status === 'approved').length;
    const pending = volunteers.filter((v) => v.status === 'pending').length;
    const rejected = volunteers.filter((v) => v.status === 'rejected').length;

    const tpsCoveragePct = totalTps > 0 ? Math.round((approved / totalTps) * 100) : 0;

    return {
      totalTps,
      totalDpt,
      totalTarget,
      approved,
      pending,
      rejected,
      tpsCoveragePct,
    };
  }, [villages, volunteers]);

  // Rekap per Kecamatan
  const districtRecap = useMemo(() => {
    return districts.map((d) => {
      const distVillages = villages.filter((v) => v.district_id === d.id);
      const villageIds = new Set(distVillages.map((v) => v.id));

      const totalTps = distVillages.reduce((s, v) => s + (v.total_tps || 0), 0);
      const targetVotes = distVillages.reduce((s, v) => s + (v.target_votes || 0), 0);
      const approved = volunteers.filter((vol) => villageIds.has(vol.village_id) && vol.status === 'approved').length;
      const pending = volunteers.filter((vol) => villageIds.has(vol.village_id) && vol.status === 'pending').length;
      const pct = totalTps > 0 ? Math.min(100, Math.round((approved / totalTps) * 100)) : 0;

      return {
        id: d.id,
        name: d.name,
        kelurahanCount: distVillages.length,
        totalTps,
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

  // Pratinjau Foto KTP dari Supabase Storage
  const handlePreviewKtp = async (vol: Volunteer) => {
    setPreviewVolunteer(vol);
    if (!vol.ktp_storage_path) {
      setPreviewUrl(null);
      return;
    }
    const { data } = supabase.storage.from('ktp-photos').getPublicUrl(vol.ktp_storage_path);
    setPreviewUrl(data?.publicUrl || null);
  };

  // Approve Relawan
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

  // Reject Relawan
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
    <div className="space-y-6">
      {/* Header Command Center */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Command Center — Kota Makassar</h1>
          <p className="text-sm text-slate-500 mt-1">
            Ringkasan kekuatan wilayah, keterisian TPS, dan verifikasi relawan lapangan secara real-time.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/wilayah"
            className="px-4 py-2 rounded-xl bg-orange-600 text-xs font-semibold text-white hover:bg-orange-700 shadow-sm"
          >
            🔗 Bagikan Link Kelurahan
          </Link>
        </div>
      </div>

      {/* 4 Kartu KPI Utama */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Relawan TPS Aktif</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
              {kpi.tpsCoveragePct}% TPS
            </span>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">
            {kpi.approved.toLocaleString('id-ID')}{' '}
            <span className="text-sm font-normal text-slate-400">/ {kpi.totalTps.toLocaleString('id-ID')}</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, kpi.tpsCoveragePct)}%` }}
            />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Menunggu Verifikasi</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              Pending
            </span>
          </div>
          <div className="text-2xl font-extrabold text-amber-600 mt-2">
            {kpi.pending.toLocaleString('id-ID')}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Ditolak: <span className="font-semibold text-red-500">{kpi.rejected}</span> pendaftar
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Target Suara Makassar</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
              Target
            </span>
          </div>
          <div className="text-2xl font-extrabold text-orange-600 mt-2">
            {kpi.totalTarget.toLocaleString('id-ID')}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            DPT Terdata: <span className="font-semibold text-slate-700">{kpi.totalDpt.toLocaleString('id-ID')}</span>
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Koordinator Aktif</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              Struktur
            </span>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">
            {coordinatorCount.toLocaleString('id-ID')}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Mencakup <span className="font-semibold text-slate-700">{districts.length}</span> Kecamatan
          </p>
        </div>
      </div>

      {/* Peta Sebaran 15 Kecamatan Kota Makassar */}
      <MakassarMap districts={districtRecap} />

      {/* Antrean Verifikasi Relawan TPS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">🛡️ Antrean Verifikasi Relawan TPS</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Periksa kelengkapan NIK dan foto KTP sebelum mengesahkan relawan TPS.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { key: 'pending', label: `Pending (${kpi.pending})` },
                { key: 'approved', label: `Approved (${kpi.approved})` },
                { key: 'rejected', label: `Rejected (${kpi.rejected})` },
                { key: 'all', label: `Semua (${volunteers.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  statusFilter === tab.key
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                <th className="py-3 px-4">Nama & NIK</th>
                <th className="py-3 px-4">Wilayah / TPS</th>
                <th className="py-3 px-4">WhatsApp</th>
                <th className="py-3 px-4 text-center">Dokumen</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Memuat data pendaftar...
                  </td>
                </tr>
              ) : filteredVolunteers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Tidak ada data relawan pada kategori ini.
                  </td>
                </tr>
              ) : (
                filteredVolunteers.slice(0, 25).map((vol) => {
                  const vill = villageMap[vol.village_id];
                  const distName = vill ? districtMap[vill.district_id] : '';

                  return (
                    <tr key={vol.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{vol.full_name}</div>
                        <div className="font-mono text-xs text-slate-500">{vol.nik}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">
                          KEL. {vill?.name || '-'}{' '}
                          <span className="ml-1 px-2 py-0.5 rounded bg-orange-50 text-orange-700 font-bold text-xs">
                            TPS {String(vol.tps_number).padStart(3, '0')}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400">KEC. {distName}</div>
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-slate-700">
                        <a
                          href={`https://wa.me/${vol.whatsapp_number.replace(/^0/, '62')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-600 hover:underline"
                        >
                          {vol.whatsapp_number}
                        </a>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handlePreviewKtp(vol)}
                          className="px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          🪪 Cek KTP
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {vol.status === 'approved' && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                            Approved
                          </span>
                        )}
                        {vol.status === 'pending' && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                            Pending
                          </span>
                        )}
                        {vol.status === 'rejected' && (
                          <div>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                              Rejected
                            </span>
                            {vol.rejection_reason && (
                              <div className="text-[11px] text-red-500 mt-0.5">{vol.rejection_reason}</div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {vol.status !== 'approved' && (
                          <button
                            disabled={processingId === vol.id}
                            onClick={() => handleApprove(vol)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
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
                            className="px-2.5 py-1.5 rounded-lg bg-red-50 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
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
      </div>

      {/* Tabel Rekap Kekuatan per Kecamatan */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">📊 Rekapitulasi Kekuatan per Kecamatan</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Perbandingan jumlah TPS dengan relawan terverifikasi di setiap kecamatan Kota Makassar.
            </p>
          </div>
          <Link href="/dashboard/wilayah" className="text-xs font-semibold text-orange-600 hover:underline">
            Lihat Detail Kelurahan →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                <th className="py-3 px-4">Kecamatan</th>
                <th className="py-3 px-4 text-center">Kelurahan</th>
                <th className="py-3 px-4 text-center">Total TPS</th>
                <th className="py-3 px-4 text-center">Relawan Aktif</th>
                <th className="py-3 px-4 text-center">Pending</th>
                <th className="py-3 px-4 text-right">Target Suara</th>
                <th className="py-3 px-4 w-44">Keterisian TPS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {districtRecap.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/80">
                  <td className="py-3 px-4 font-semibold text-slate-900">KEC. {d.name}</td>
                  <td className="py-3 px-4 text-center text-slate-600">{d.kelurahanCount}</td>
                  <td className="py-3 px-4 text-center font-medium text-slate-800">{d.totalTps}</td>
                  <td className="py-3 px-4 text-center font-bold text-emerald-600">{d.approved}</td>
                  <td className="py-3 px-4 text-center text-amber-600 font-medium">{d.pending}</td>
                  <td className="py-3 px-4 text-right font-semibold text-orange-600">
                    {d.targetVotes.toLocaleString('id-ID')}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            d.pct >= 100 ? 'bg-emerald-500' : d.pct > 0 ? 'bg-orange-500' : 'bg-slate-300'
                          }`}
                          style={{ width: `${d.pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-700 w-9 text-right">{d.pct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
                Alasan Penolakan (akan tampil sebagai catatan)
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
                className="px-4 py-2 rounded-lg bg-red-600 text-xs font-semibold text-white hover:bg-red-700"
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