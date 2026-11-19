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
  total_tps: number;
}

interface FieldLo {
  id: string;
  full_name: string;
  whatsapp_number: string;
  level: string;
  district_id: string | null;
  village_id: string | null;
  is_active: boolean;
}

interface Volunteer {
  id: string;
  village_id: string;
  tps_number: number;
  full_name: string;
  status: string;
  lo_id: string | null;
  last_routine_verified_at: string | null;
  souvenir_received: boolean | null;
}

export default function DashboardOverviewPage() {
  const [districts, setDistricts] = useState<District[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [los, setLos] = useState<FieldLo[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    const [distRes, villRes, loRes, volRes] = await Promise.all([
      supabase.from('districts').select('id, name').order('name'),
      supabase.from('villages').select('id, district_id, name, total_tps').order('name'),
      supabase.from('field_los').select('*').order('full_name'),
      supabase
        .from('volunteers')
        .select('id, village_id, tps_number, full_name, status, lo_id, last_routine_verified_at, souvenir_received'),
    ]);

    if (distRes.data) setDistricts(distRes.data);
    if (villRes.data) setVillages(villRes.data);
    if (loRes.data) setLos(loRes.data as FieldLo[]);
    if (volRes.data) setVolunteers(volRes.data as Volunteer[]);
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

  // Cek apakah verifikasi rutin dilakukan dalam 30 hari terakhir
  const isVerifiedThisMonth = (dateStr: string | null) => {
    if (!dateStr) return false;
    const diffDays = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 30;
  };

  // Statistik KPI Fokus LO, Tim TPS, Verifikasi Rutin & Suvenir
  const kpi = useMemo(() => {
    const totalTps = villages.reduce((sum, v) => sum + (v.total_tps || 0), 0);
    const activeTimTps = volunteers.filter((v) => v.status === 'approved');
    const routineVerified = activeTimTps.filter((v) => isVerifiedThisMonth(v.last_routine_verified_at)).length;
    const souvenirDistributed = activeTimTps.filter((v) => v.souvenir_received).length;

    const activeDistrictIds = new Set<string>();
    los.forEach((l) => {
      if (l.district_id) activeDistrictIds.add(l.district_id);
    });
    activeTimTps.forEach((v) => {
      const vill = villageMap[v.village_id];
      if (vill?.district_id) activeDistrictIds.add(vill.district_id);
    });

    const tpsCoveragePct = totalTps > 0 ? Math.round((activeTimTps.length / totalTps) * 100) : 0;
    const routineHealthPct =
      activeTimTps.length > 0 ? Math.round((routineVerified / activeTimTps.length) * 100) : 0;
    const souvenirPct =
      activeTimTps.length > 0 ? Math.round((souvenirDistributed / activeTimTps.length) * 100) : 0;

    return {
      totalTps,
      loCount: los.length,
      activeDistrictCount: activeDistrictIds.size,
      timTpsCount: activeTimTps.length,
      tpsCoveragePct,
      routineVerified,
      routineHealthPct,
      souvenirDistributed,
      souvenirPct,
    };
  }, [villages, volunteers, los, villageMap]);

  // Rekap per Kecamatan untuk Peta & Tabel Sebaran
  const districtRecap = useMemo(() => {
    return districts.map((d) => {
      const distVillages = villages.filter((v) => v.district_id === d.id);
      const villageIds = new Set(distVillages.map((v) => v.id));

      const totalTps = distVillages.reduce((s, v) => s + (v.total_tps || 0), 0);
      const loCount = los.filter((l) => l.district_id === d.id).length;
      const distTim = volunteers.filter((vol) => villageIds.has(vol.village_id) && vol.status === 'approved');
      const routineVerifiedCount = distTim.filter((v) => isVerifiedThisMonth(v.last_routine_verified_at)).length;
      const souvenirCount = distTim.filter((v) => v.souvenir_received).length;
      const pct = totalTps > 0 ? Math.min(100, Math.round((distTim.length / totalTps) * 100)) : 0;

      return {
        id: d.id,
        name: d.name,
        kelurahanCount: distVillages.length,
        loCount,
        totalTps,
        timTpsCount: distTim.length,
        routineVerifiedCount,
        souvenirCount,
        pct,
      };
    });
  }, [districts, villages, los, volunteers]);

  // Rapor Kinerja Masing-masing LO
  const loScorecard = useMemo(() => {
    return los
      .map((lo) => {
        const binaan = volunteers.filter((v) => v.lo_id === lo.id && v.status === 'approved');
        const verifiedCount = binaan.filter((v) => isVerifiedThisMonth(v.last_routine_verified_at)).length;
        const souvenirCount = binaan.filter((v) => v.souvenir_received).length;

        return {
          ...lo,
          binaanCount: binaan.length,
          verifiedCount,
          souvenirCount,
        };
      })
      .sort((a, b) => b.binaanCount - a.binaanCount);
  }, [los, volunteers]);

  return (
    <div className="space-y-8">
      {/* Header Utama */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            Command Center Makassar
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-rose-100 text-rose-600">
              Struktur LO → Tim TPS
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Pemantauan kekuatan jaringan LO, sebaran Tim TPS, verifikasi rutin bulanan, dan distribusi suvenir.
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
            href="/dashboard/tim-sukses"
            className="px-4 py-2.5 bg-gradient-to-r from-rose-500 via-pink-500 to-indigo-600 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-500/20 hover:opacity-95 transition"
          >
            + Input LO & Tim TPS
          </Link>
        </div>
      </div>

      {/* 4 Kartu KPI Utama */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* KPI 1: Total LO */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">
              🧭
            </div>
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
              {kpi.activeDistrictCount} / {districts.length} Kec
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total LO Aktif</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{kpi.loCount} Orang</h3>
            <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Koordinator Wilayah Lapangan
            </p>
          </div>
        </div>

        {/* KPI 2: Total Tim TPS */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-xl">
              🗳️
            </div>
            <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-100">
              {kpi.tpsCoveragePct}% TPS
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tim TPS Terdaftar</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1">
              {kpi.timTpsCount.toLocaleString('id-ID')}{' '}
              <span className="text-sm font-normal text-slate-400">/ {kpi.totalTps.toLocaleString('id-ID')}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Ujung Tombak Pengawal TPS
            </p>
          </div>
        </div>

        {/* KPI 3: Kesehatan Jaringan (Verifikasi Rutin) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">
              ✅
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              {kpi.routineHealthPct}% Terawat
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Verifikasi Rutin (30 Hari)</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1">
              {kpi.routineVerified}{' '}
              <span className="text-sm font-normal text-slate-400">/ {kpi.timTpsCount} Tim</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Sudah dicek ulang oleh LO
            </p>
          </div>
        </div>

        {/* KPI 4: Distribusi Suvenir Rutin */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-xl">
              🎁
            </div>
            <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
              {kpi.souvenirPct}% Tersalur
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Distribusi Suvenir Rutin</p>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-1">
              {kpi.souvenirDistributed}{' '}
              <span className="text-sm font-normal text-slate-400">/ {kpi.timTpsCount} Paket</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" /> Diterima Tim TPS via LO
            </p>
          </div>
        </div>
      </section>

      {/* Peta Sebaran LO & Tim TPS Kota Makassar */}
      <MakassarMap districts={districtRecap} />

      {/* Rapor Kinerja LO (Leaderboard & Kontrol Perawatan Tim) */}
      <section className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              🧭 Rapor Kinerja LO & Perawatan Tim TPS
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Pantau jumlah Tim TPS binaan tiap LO, kepatuhan verifikasi rutin, dan serapan suvenir lapangan.
            </p>
          </div>
          <Link
            href="/dashboard/tim-sukses"
            className="text-xs font-bold text-rose-600 hover:underline self-start md:self-auto"
          >
            Update Cek Rutin & Suvenir →
          </Link>
        </div>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-4">Nama LO</th>
                <th className="py-3.5 px-4">Wilayah Koordinasi</th>
                <th className="py-3.5 px-4 text-center">Tim TPS Binaan</th>
                <th className="py-3.5 px-4 text-center">Verifikasi Rutin</th>
                <th className="py-3.5 px-4 text-center">Suvenir Tersalurkan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Memuat rapor LO...
                  </td>
                </tr>
              ) : loScorecard.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Belum ada data LO terdaftar. Silakan tambahkan melalui menu <b>Tim Sukses</b>.
                  </td>
                </tr>
              ) : (
                loScorecard.map((lo) => {
                  const distName = lo.district_id ? districtMap[lo.district_id] : '-';
                  const villName = lo.village_id ? villageMap[lo.village_id]?.name : null;

                  return (
                    <tr key={lo.id} className="hover:bg-slate-50/80">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{lo.full_name}</div>
                        <div className="text-[11px] text-slate-400">
                          LO {lo.level} · WA: {lo.whatsapp_number}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-800">KEC. {distName}</span>
                        {villName && <span className="text-slate-400"> / KEL. {villName}</span>}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-extrabold">
                          {lo.binaanCount} Tim TPS
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full font-bold ${
                            lo.binaanCount > 0 && lo.verifiedCount === lo.binaanCount
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {lo.verifiedCount} / {lo.binaanCount} Tercek
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 font-bold">
                          🎁 {lo.souvenirCount} / {lo.binaanCount} Paket
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Tabel Rekapitulasi Sebaran 15 Kecamatan */}
      <section className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-sm">
        <div className="pb-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">📊 Rekapitulasi Sebaran per Kecamatan</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Perbandingan jumlah LO, total TPS, dan keterisian Tim TPS di seluruh kecamatan Kota Makassar.
          </p>
        </div>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-4">Kecamatan</th>
                <th className="py-3.5 px-4 text-center">Kelurahan</th>
                <th className="py-3.5 px-4 text-center">LO Aktif</th>
                <th className="py-3.5 px-4 text-center">Total TPS</th>
                <th className="py-3.5 px-4 text-center">Tim TPS Terisi</th>
                <th className="py-3.5 px-4 text-center">Cek Rutin</th>
                <th className="py-3.5 px-4 w-44">Keterisian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {districtRecap.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/80">
                  <td className="py-3.5 px-4 font-bold text-slate-900">KEC. {d.name}</td>
                  <td className="py-3.5 px-4 text-center text-slate-500">{d.kelurahanCount}</td>
                  <td className="py-3.5 px-4 text-center font-bold text-indigo-600">{d.loCount}</td>
                  <td className="py-3.5 px-4 text-center font-semibold text-slate-800">{d.totalTps}</td>
                  <td className="py-3.5 px-4 text-center font-bold text-rose-600">{d.timTpsCount}</td>
                  <td className="py-3.5 px-4 text-center font-bold text-emerald-600">
                    {d.routineVerifiedCount}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-rose-500 to-indigo-600 h-full rounded-full"
                          style={{ width: `${d.pct}%` }}
                        />
                      </div>
                      <span className="font-bold text-slate-700 w-9 text-right">{d.pct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}