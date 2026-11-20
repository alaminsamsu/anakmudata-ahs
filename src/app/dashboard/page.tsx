'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import MakassarMap, { DistrictStat, VillageMapItem, VolunteerMapItem } from '@/components/MakassarMap';

interface DistrictRow {
  id: string;
  name: string;
}

interface VillageRow {
  id: string;
  district_id: string;
  name: string;
  total_tps: number;
  lat?: number | null;
  lng?: number | null;
}

interface FieldLoRow {
  id: string;
  full_name: string;
  whatsapp_number: string;
  is_active: boolean;
}

interface VolunteerRow {
  id: string;
  village_id: string;
  tps_number: number;
  full_name: string;
  nik: string;
  whatsapp_number: string;
  status: string;
  lo_id: string | null;
  met_candidate: boolean | null;
  last_routine_verified_at: string | null;
}

interface LoRecapItem {
  id: string;
  full_name: string;
  whatsapp_number: string;
  officialCount: number;
  waitingCount: number;
  totalRecruited: number;
  verifiedCount: number;
  districtCount: number;
  villageCount: number;
  districtNames: string[];
}

function calculateCountdownToApril2029() {
  const now = new Date();
  const target = new Date(2029, 3, 18, 7, 0, 0);

  if (now >= target) {
    return { years: 0, months: 0, days: 0, totalDays: 0 };
  }

  let years = target.getFullYear() - now.getFullYear();
  let months = target.getMonth() - now.getMonth();
  let days = target.getDate() - now.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonthDays = new Date(target.getFullYear(), target.getMonth(), 0).getDate();
    days += prevMonthDays;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const totalDays = Math.max(0, Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  return { years, months, days, totalDays };
}

function buildWaLink(rawPhone: string | null | undefined, message?: string): string | null {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  if (!digits || digits.length < 8) return null;

  let normalized = digits;
  if (normalized.startsWith('0')) {
    normalized = '62' + normalized.slice(1);
  } else if (!normalized.startsWith('62')) {
    normalized = '62' + normalized;
  }

  const baseUrl = `https://wa.me/${normalized}`;
  return message ? `${baseUrl}?text=${encodeURIComponent(message)}` : baseUrl;
}

export default function DashboardPage() {
  const [districts, setDistricts] = useState<DistrictRow[]>([]);
  const [villages, setVillages] = useState<VillageRow[]>([]);
  const [los, setLos] = useState<FieldLoRow[]>([]);
  const [volunteers, setVolunteers] = useState<VolunteerRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filter & Pencarian Rekapan LO di Dashboard
  const [loFilterMode, setLoFilterMode] = useState<'ALL' | 'HAS_QUEUE' | 'NEEDS_CHECK'>('ALL');
  const [loSearch, setLoSearch] = useState<string>('');

  const countdown = useMemo(() => calculateCountdownToApril2029(), []);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    const [distRes, villRes, loRes, volRes] = await Promise.all([
      supabase.from('districts').select('id, name').order('name'),
      supabase.from('villages').select('id, district_id, name, total_tps, lat, lng').order('name'),
      supabase.from('field_los').select('id, full_name, whatsapp_number, is_active'),
      supabase
        .from('volunteers')
        .select('id, village_id, tps_number, full_name, nik, whatsapp_number, status, lo_id, met_candidate, last_routine_verified_at'),
    ]);

    if (distRes.data) setDistricts(distRes.data);
    if (villRes.data) setVillages(villRes.data);
    if (loRes.data) setLos(loRes.data);
    if (volRes.data) setVolunteers(volRes.data as VolunteerRow[]);
    setLoading(false);
  }

  const isVerifiedThisMonth = (dateStr: string | null) => {
    if (!dateStr) return false;
    const diffDays = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 30;
  };

  const { districtStats, totals, mapVolunteers, loLeaderboard } = useMemo(() => {
    const districtNameMap: Record<string, string> = {};
    districts.forEach((d) => {
      districtNameMap[d.id] = d.name;
    });

    const villageMap: Record<string, VillageRow> = {};
    const tpsPerDistrict: Record<string, number> = {};
    const kelPerDistrict: Record<string, number> = {};

    villages.forEach((v) => {
      villageMap[v.id] = v;
      tpsPerDistrict[v.district_id] = (tpsPerDistrict[v.district_id] || 0) + (v.total_tps || 0);
      kelPerDistrict[v.district_id] = (kelPerDistrict[v.district_id] || 0) + 1;
    });

    const loNameMap: Record<string, string> = {};
    const loAccumulator: Record<
      string,
      {
        officialCount: number;
        waitingCount: number;
        verifiedCount: number;
        districtSet: Set<string>;
        villageSet: Set<string>;
      }
    > = {};

    los.forEach((l) => {
      loNameMap[l.id] = l.full_name;
      loAccumulator[l.id] = {
        officialCount: 0,
        waitingCount: 0,
        verifiedCount: 0,
        districtSet: new Set(),
        villageSet: new Set(),
      };
    });

    const loSetPerDistrict: Record<string, Set<string>> = {};
    const officialTpsPerDistrict: Record<string, number> = {};
    const verifiedPerDistrict: Record<string, number> = {};

    let totalOfficialTimTps = 0;
    let totalWaitingMeeting = 0;
    let totalRoutineVerified = 0;

    volunteers.forEach((vol) => {
      const vill = villageMap[vol.village_id];
      const distId = vill?.district_id;
      const verifiedOk = isVerifiedThisMonth(vol.last_routine_verified_at);

      if (vol.lo_id && loAccumulator[vol.lo_id]) {
        if (vol.met_candidate) {
          loAccumulator[vol.lo_id].officialCount += 1;
          if (verifiedOk) loAccumulator[vol.lo_id].verifiedCount += 1;
          if (vill) {
            loAccumulator[vol.lo_id].villageSet.add(vill.id);
            if (distId && districtNameMap[distId]) {
              loAccumulator[vol.lo_id].districtSet.add(districtNameMap[distId]);
            }
          }
        } else {
          loAccumulator[vol.lo_id].waitingCount += 1;
        }
      }

      if (vol.met_candidate) {
        totalOfficialTimTps += 1;
        if (distId) {
          officialTpsPerDistrict[distId] = (officialTpsPerDistrict[distId] || 0) + 1;
          if (vol.lo_id) {
            if (!loSetPerDistrict[distId]) loSetPerDistrict[distId] = new Set();
            loSetPerDistrict[distId].add(vol.lo_id);
          }
        }
        if (verifiedOk) {
          totalRoutineVerified += 1;
          if (distId) verifiedPerDistrict[distId] = (verifiedPerDistrict[distId] || 0) + 1;
        }
      } else {
        totalWaitingMeeting += 1;
      }
    });

    const stats: DistrictStat[] = districts.map((d) => {
      const totalTps = tpsPerDistrict[d.id] || 0;
      const officialCount = officialTpsPerDistrict[d.id] || 0;
      const pct = totalTps > 0 ? Math.min(100, Math.round((officialCount / totalTps) * 100)) : 0;

      return {
        id: d.id,
        name: d.name,
        kelurahanCount: kelPerDistrict[d.id] || 0,
        loCount: loSetPerDistrict[d.id]?.size || 0,
        totalTps,
        timTpsCount: officialCount,
        routineVerifiedCount: verifiedPerDistrict[d.id] || 0,
        souvenirCount: 0,
        pct,
      };
    });

    stats.sort((a, b) => b.pct - a.pct || b.timTpsCount - a.timTpsCount || a.name.localeCompare(b.name));

    const leaderboard: LoRecapItem[] = los
      .map((l) => {
        const acc = loAccumulator[l.id] || {
          officialCount: 0,
          waitingCount: 0,
          verifiedCount: 0,
          districtSet: new Set<string>(),
          villageSet: new Set<string>(),
        };
        return {
          id: l.id,
          full_name: l.full_name,
          whatsapp_number: l.whatsapp_number,
          officialCount: acc.officialCount,
          waitingCount: acc.waitingCount,
          totalRecruited: acc.officialCount + acc.waitingCount,
          verifiedCount: acc.verifiedCount,
          districtCount: acc.districtSet.size,
          villageCount: acc.villageSet.size,
          districtNames: Array.from(acc.districtSet),
        };
      })
      .sort(
        (a, b) =>
          b.officialCount - a.officialCount ||
          b.waitingCount - a.waitingCount ||
          a.full_name.localeCompare(b.full_name)
      );

    const totalAllTps = Object.values(tpsPerDistrict).reduce((acc, v) => acc + v, 0);
    const overallPct = totalAllTps > 0 ? Math.round((totalOfficialTimTps / totalAllTps) * 100) : 0;

    const mappedVols: VolunteerMapItem[] = volunteers.map((v) => ({
      id: v.id,
      village_id: v.village_id,
      tps_number: v.tps_number,
      full_name: v.full_name,
      met_candidate: v.met_candidate,
      lo_name: v.lo_id ? loNameMap[v.lo_id] : undefined,
    }));

    return {
      districtStats: stats,
      mapVolunteers: mappedVols,
      loLeaderboard: leaderboard,
      totals: {
        loCount: los.length,
        officialTimTpsCount: totalOfficialTimTps,
        waitingMeetingCount: totalWaitingMeeting,
        allTps: totalAllTps,
        routineVerified: totalRoutineVerified,
        overallPct,
      },
    };
  }, [districts, villages, los, volunteers]);

  const filteredLoLeaderboard = useMemo(() => {
    return loLeaderboard.filter((item) => {
      const matchMode =
        loFilterMode === 'ALL' ||
        (loFilterMode === 'HAS_QUEUE' && item.waitingCount > 0) ||
        (loFilterMode === 'NEEDS_CHECK' && item.officialCount > item.verifiedCount);

      const q = loSearch.trim().toLowerCase();
      const matchSearch =
        !q ||
        item.full_name.toLowerCase().includes(q) ||
        (item.whatsapp_number || '').includes(q);

      return matchMode && matchSearch;
    });
  }, [loLeaderboard, loFilterMode, loSearch]);

  const top10Lo = filteredLoLeaderboard.slice(0, 10);

  return (
    <div className="space-y-8">
      {/* Header Internal Command Center */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-600 text-[11px] font-extrabold uppercase tracking-wider mb-2">
            Internal Command Center · AHS Makassar
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Peta Kekuatan Tim Sukses & Kesiapan TPS
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Pemantauan jaringan <b>LO (Lintas Wilayah)</b> → <b>Pertemuan Langsung Caleg</b> → <b>Tim TPS Resmi</b> se-Kota Makassar.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Link
            href="/dashboard/tim-sukses"
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 via-pink-500 to-indigo-600 text-white text-xs font-bold shadow-md shadow-rose-500/20 hover:opacity-95 transition"
          >
            + Kelola LO & Tim TPS
          </Link>
        </div>
      </div>

      {/* 4 Kartu KPI Strategis */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total LO Aktif</span>
            <span className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-base">
              🧭
            </span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900">
            {loading ? '...' : `${totals.loCount} Orang`}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Bergerak Lintas Wilayah Makassar
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Resmi Tim TPS (Bertemu Caleg)</span>
            <span className="w-9 h-9 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-base">
              🤝
            </span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900">
            {loading ? '...' : totals.officialTimTpsCount.toLocaleString('id-ID')}{' '}
            <span className="text-sm font-semibold text-slate-400">
              / {totals.allTps.toLocaleString('id-ID')}
            </span>
          </div>
          <p className="text-xs text-amber-600 font-semibold mt-2">
            ⏳ Antrean Pertemuan: {totals.waitingMeetingCount} Orang
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Verifikasi Rutin (30 Hari)</span>
            <span className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-base">
              ✅
            </span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900">
            {loading ? '...' : totals.routineVerified}{' '}
            <span className="text-sm font-semibold text-slate-400">
              / {totals.officialTimTpsCount} Tim
            </span>
          </div>
          <p className="text-xs text-emerald-600 font-semibold mt-2">
            ✓ Sudah dicek ulang oleh LO
          </p>
        </div>

        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 border border-indigo-900/50 shadow-sm text-white">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-rose-300 uppercase tracking-wider">
              Menuju April 2029
            </span>
            <span className="w-9 h-9 rounded-2xl bg-white/10 text-rose-300 flex items-center justify-center font-bold text-base">
              ⏳
            </span>
          </div>
          <div className="text-2xl font-extrabold text-white tracking-tight">
            {countdown.years} Thn {countdown.months} Bln {countdown.days} Hr
          </div>
          <p className="text-xs text-indigo-200 font-semibold mt-2">
            🗓️ Tersisa {countdown.totalDays.toLocaleString('id-ID')} hari menuju Pemilu 2029
          </p>
        </div>
      </div>

      {/* Peta Interaktif Full-Width (3 Level: Kecamatan -> Kelurahan -> TPS) */}
      <MakassarMap
        districts={districtStats}
        villages={villages as VillageMapItem[]}
        volunteers={mapVolunteers}
      />

      {/* PANEL REKAPAN & PERINGKAT PERFORMA LO (TOP 10) */}
      <section className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-extrabold text-slate-900">🏆 Rekapan & Peringkat Performa LO</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-extrabold">
                Top {top10Lo.length} dari {filteredLoLeaderboard.length} LO
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Diurutkan otomatis berdasarkan jumlah <b>Tim TPS Resmi (Sudah Bertemu Caleg)</b> terbanyak.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex p-1 bg-slate-100 rounded-xl text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setLoFilterMode('ALL')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  loFilterMode === 'ALL' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua LO
              </button>
              <button
                type="button"
                onClick={() => setLoFilterMode('HAS_QUEUE')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  loFilterMode === 'HAS_QUEUE' ? 'bg-amber-500 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ⏳ Punya Antrean
              </button>
              <button
                type="button"
                onClick={() => setLoFilterMode('NEEDS_CHECK')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  loFilterMode === 'NEEDS_CHECK' ? 'bg-rose-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ⚠️ Perlu Cek Rutin
              </button>
            </div>

            <input
              type="text"
              placeholder="Cari nama / WA LO..."
              value={loSearch}
              onChange={(e) => setLoSearch(e.target.value)}
              className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 w-44 sm:w-52"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-4 w-16 text-center">Rank</th>
                <th className="py-3.5 px-4">Nama LO & WhatsApp</th>
                <th className="py-3.5 px-4">Sebaran Wilayah</th>
                <th className="py-3.5 px-4 text-center">Resmi Tim TPS</th>
                <th className="py-3.5 px-4 text-center">Antrean Bertemu</th>
                <th className="py-3.5 px-4 text-center">Disiplin Cek Rutin</th>
                <th className="py-3.5 px-4 text-right">Direct WA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Memuat rekapan performa LO...
                  </td>
                </tr>
              ) : top10Lo.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Tidak ada data LO yang sesuai filter ini.
                  </td>
                </tr>
              ) : (
                top10Lo.map((lo, idx) => {
                  const rank = idx + 1;
                  const waHref = buildWaLink(
                    lo.whatsapp_number,
                    `Halo LO ${lo.full_name}, update rekapan Command Center ANAKMUDATA: ${lo.officialCount} Tim TPS Resmi & ${lo.waitingCount} Antrean Pertemuan.`
                  );
                  const checkPct =
                    lo.officialCount > 0 ? Math.round((lo.verifiedCount / lo.officialCount) * 100) : 0;

                  return (
                    <tr key={lo.id} className="hover:bg-slate-50/80">
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-extrabold ${
                            rank === 1
                              ? 'bg-amber-400 text-slate-950'
                              : rank === 2
                              ? 'bg-slate-200 text-slate-800'
                              : rank === 3
                              ? 'bg-orange-200 text-orange-900'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          #{rank}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{lo.full_name}</div>
                        <div className="text-[11px] font-semibold text-emerald-600">{lo.whatsapp_number}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        {lo.districtCount > 0 ? (
                          <div>
                            <span className="font-bold text-slate-800">
                              {lo.districtCount} Kec · {lo.villageCount} Kel
                            </span>
                            <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                              {lo.districtNames.join(', ')}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Belum ada wilayah</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-extrabold">
                          🤝 {lo.officialCount} Orang
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {lo.waitingCount > 0 ? (
                          <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-extrabold">
                            ⏳ {lo.waitingCount} Antrean
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {lo.officialCount > 0 ? (
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              checkPct === 100
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            ✓ {lo.verifiedCount}/{lo.officialCount} ({checkPct}%)
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {waHref ? (
                          <a
                            href={waHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition"
                          >
                            💬 Chat WA
                          </a>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs">
          <span className="text-slate-400">
            Menampilkan maksimal 10 LO teratas pada ringkasan dashboard.
          </span>
          <Link
            href="/dashboard/tim-sukses"
            className="font-extrabold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
          >
            Lihat Semua & Kelola Detail di Menu Tim Sukses →
          </Link>
        </div>
      </section>
    </div>
  );
}