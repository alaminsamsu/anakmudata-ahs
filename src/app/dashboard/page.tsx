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

function calculateCountdownToApril2029() {
  const now = new Date();
  const target = new Date(2029, 3, 18, 7, 0, 0); // Target Pemilu Legislatif April 2029

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

export default function DashboardPage() {
  const [districts, setDistricts] = useState<DistrictRow[]>([]);
  const [villages, setVillages] = useState<VillageRow[]>([]);
  const [los, setLos] = useState<FieldLoRow[]>([]);
  const [volunteers, setVolunteers] = useState<VolunteerRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

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

  const { districtStats, totals, mapVolunteers } = useMemo(() => {
    const villageToDistrict: Record<string, string> = {};
    const tpsPerDistrict: Record<string, number> = {};
    const kelPerDistrict: Record<string, number> = {};

    villages.forEach((v) => {
      villageToDistrict[v.id] = v.district_id;
      tpsPerDistrict[v.district_id] = (tpsPerDistrict[v.district_id] || 0) + (v.total_tps || 0);
      kelPerDistrict[v.district_id] = (kelPerDistrict[v.district_id] || 0) + 1;
    });

    const loNameMap: Record<string, string> = {};
    los.forEach((l) => {
      loNameMap[l.id] = l.full_name;
    });

    const loSetPerDistrict: Record<string, Set<string>> = {};
    const officialTpsPerDistrict: Record<string, number> = {};
    const verifiedPerDistrict: Record<string, number> = {};

    let totalOfficialTimTps = 0;
    let totalWaitingMeeting = 0;
    let totalRoutineVerified = 0;

    volunteers.forEach((vol) => {
      const distId = villageToDistrict[vol.village_id];

      if (vol.met_candidate) {
        totalOfficialTimTps += 1;
        if (distId) {
          officialTpsPerDistrict[distId] = (officialTpsPerDistrict[distId] || 0) + 1;
          if (vol.lo_id) {
            if (!loSetPerDistrict[distId]) loSetPerDistrict[distId] = new Set();
            loSetPerDistrict[distId].add(vol.lo_id);
          }
        }
        if (isVerifiedThisMonth(vol.last_routine_verified_at)) {
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

        {/* Kartu Hitung Mundur Pemilu April 2029 */}
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
    </div>
  );
}