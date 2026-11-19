'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

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

interface Volunteer {
  id: string;
  village_id: string;
  tps_number: number;
  met_candidate: boolean | null;
  last_routine_verified_at: string | null;
  souvenir_received: boolean | null;
}

export default function DataWilayahPage() {
  const [districts, setDistricts] = useState<District[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'tps_desc' | 'kel_desc' | 'pct_desc' | 'name_asc'>('tps_desc');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal Edit Jumlah TPS Kelurahan
  const [editingVillage, setEditingVillage] = useState<Village | null>(null);
  const [editTpsValue, setEditTpsValue] = useState<string>('0');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  useEffect(() => {
    fetchWilayahData();
  }, []);

  async function fetchWilayahData() {
    setLoading(true);
    const [distRes, villRes, volRes] = await Promise.all([
      supabase.from('districts').select('id, name').order('name'),
      supabase.from('villages').select('id, district_id, name, total_tps').order('name'),
      supabase
        .from('volunteers')
        .select('id, village_id, tps_number, met_candidate, last_routine_verified_at, souvenir_received'),
    ]);

    if (distRes.data) setDistricts(distRes.data);
    if (villRes.data) setVillages(villRes.data);
    if (volRes.data) setVolunteers(volRes.data as Volunteer[]);
    setLoading(false);
  }

  // Hitung statistik tiap kelurahan
  const villageStats = useMemo(() => {
    const map: Record<string, { official: number; waiting: number; souvenir: number }> = {};
    volunteers.forEach((v) => {
      if (!map[v.village_id]) map[v.village_id] = { official: 0, waiting: 0, souvenir: 0 };
      if (v.met_candidate) {
        map[v.village_id].official += 1;
        if (v.souvenir_received) map[v.village_id].souvenir += 1;
      } else {
        map[v.village_id].waiting += 1;
      }
    });
    return map;
  }, [volunteers]);

  // Agregasi per Kecamatan (Dikelompokkan & Diurutkan)
  const districtGroups = useMemo(() => {
    const groups = districts.map((d) => {
      const distVillages = villages
        .filter((v) => v.district_id === d.id)
        .sort((a, b) => (b.total_tps || 0) - (a.total_tps || 0));

      const totalTps = distVillages.reduce((sum, v) => sum + (v.total_tps || 0), 0);
      let officialCount = 0;
      let waitingCount = 0;
      let filledVillages = 0;

      distVillages.forEach((v) => {
        const st = villageStats[v.id] || { official: 0, waiting: 0, souvenir: 0 };
        officialCount += st.official;
        waitingCount += st.waiting;
        if (st.official > 0) filledVillages += 1;
      });

      const emptyTps = Math.max(0, totalTps - officialCount);
      const pct = totalTps > 0 ? Math.min(100, Math.round((officialCount / totalTps) * 100)) : 0;

      return {
        id: d.id,
        name: d.name,
        villages: distVillages,
        kelurahanCount: distVillages.length,
        filledVillages,
        totalTps,
        officialCount,
        waitingCount,
        emptyTps,
        pct,
      };
    });

    return groups.sort((a, b) => {
      if (sortBy === 'tps_desc') return b.totalTps - a.totalTps;
      if (sortBy === 'kel_desc') return b.kelurahanCount - a.kelurahanCount;
      if (sortBy === 'pct_desc') return b.pct - a.pct;
      return a.name.localeCompare(b.name);
    });
  }, [districts, villages, villageStats, sortBy]);

  // Ringkasan Total Kota Makassar
  const cityTotals = useMemo(() => {
    const totalKel = villages.length;
    const totalTps = villages.reduce((s, v) => s + (v.total_tps || 0), 0);
    const topTpsDistrict = [...districtGroups].sort((a, b) => b.totalTps - a.totalTps)[0];
    const topKelDistrict = [...districtGroups].sort((a, b) => b.kelurahanCount - a.kelurahanCount)[0];
    return { totalKel, totalTps, topTpsDistrict, topKelDistrict };
  }, [villages, districtGroups]);

  // Filter kelompok kecamatan & kelurahan untuk tampilan rincian
  const visibleDistrictGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return districtGroups
      .filter((g) => selectedDistrictId === 'ALL' || g.id === selectedDistrictId)
      .map((g) => {
        if (!q) return g;
        const matchDistrictName = g.name.toLowerCase().includes(q);
        const filteredVills = matchDistrictName
          ? g.villages
          : g.villages.filter((v) => v.name.toLowerCase().includes(q));
        return { ...g, villages: filteredVills };
      })
      .filter((g) => g.villages.length > 0);
  }, [districtGroups, selectedDistrictId, searchQuery]);

  const handleSaveTpsEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVillage) return;
    setSavingEdit(true);

    const parsedTps = Math.max(0, parseInt(editTpsValue, 10) || 0);
    const { error } = await supabase
      .from('villages')
      .update({ total_tps: parsedTps })
      .eq('id', editingVillage.id);

    setSavingEdit(false);
    if (error) {
      alert('Gagal memperbarui jumlah TPS: ' + error.message);
    } else {
      setVillages((prev) =>
        prev.map((v) => (v.id === editingVillage.id ? { ...v, total_tps: parsedTps } : v))
      );
      setEditingVillage(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            📍 Data Wilayah & Pemetaan TPS per Kecamatan
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Pemantauan struktur wilayah Kota Makassar ({districts.length} Kecamatan · {cityTotals.totalKel} Kelurahan ·{' '}
            {cityTotals.totalTps.toLocaleString('id-ID')} TPS).
          </p>
        </div>

        <Link
          href="/dashboard/tim-sukses"
          className="px-4 py-2.5 bg-gradient-to-r from-rose-500 via-pink-500 to-indigo-600 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-500/20 hover:opacity-95 self-start sm:self-auto"
        >
          + Input Tim TPS
        </Link>
      </div>

      {/* 4 Kartu Highlight Wilayah Terbesar */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-slate-400">Total Wilayah Makassar</span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">
            {districts.length} Kec · {cityTotals.totalKel} Kel
          </div>
          <p className="text-xs text-slate-500 mt-1">Seluruh kelurahan terdata aktif</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-slate-400">Total TPS Se-Makassar</span>
          <div className="text-2xl font-extrabold text-rose-600 mt-1">
            {cityTotals.totalTps.toLocaleString('id-ID')} TPS
          </div>
          <p className="text-xs text-slate-500 mt-1">Akumulasi seluruh titik pemungutan</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-indigo-600">TPS Terbanyak</span>
          <div className="text-xl font-extrabold text-slate-900 mt-1 truncate">
            {cityTotals.topTpsDistrict ? `KEC. ${cityTotals.topTpsDistrict.name}` : '-'}
          </div>
          <p className="text-xs text-indigo-600 font-semibold mt-1">
            {cityTotals.topTpsDistrict ? `${cityTotals.topTpsDistrict.totalTps.toLocaleString('id-ID')} TPS` : '-'}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-emerald-600">Kelurahan Terbanyak</span>
          <div className="text-xl font-extrabold text-slate-900 mt-1 truncate">
            {cityTotals.topKelDistrict ? `KEC. ${cityTotals.topKelDistrict.name}` : '-'}
          </div>
          <p className="text-xs text-emerald-600 font-semibold mt-1">
            {cityTotals.topKelDistrict ? `${cityTotals.topKelDistrict.kelurahanCount} Kelurahan` : '-'}
          </p>
        </div>
      </section>

      {/* BAGIAN 1: TABEL PERINGKAT & PERBANDINGAN 15 KECAMATAN */}
      <section className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">🏆 Peringkat Beban Wilayah per Kecamatan</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Klik baris kecamatan untuk memfokuskan daftar kelurahannya di bawah.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Urutkan:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50"
            >
              <option value="tps_desc">TPS Terbanyak</option>
              <option value="kel_desc">Kelurahan Terbanyak</option>
              <option value="pct_desc">Persentase Terisi Tertinggi</option>
              <option value="name_asc">Abjad (A - Z)</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">Kecamatan</th>
                <th className="py-3 px-4 text-center">Jumlah Kelurahan</th>
                <th className="py-3 px-4 text-center">Total TPS</th>
                <th className="py-3 px-4 text-center">Tim Resmi</th>
                <th className="py-3 px-4 text-center">TPS Kosong</th>
                <th className="py-3 px-4 w-44">Capaian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Memuat peringkat kecamatan...
                  </td>
                </tr>
              ) : (
                districtGroups.map((g, idx) => {
                  const isSelected = selectedDistrictId === g.id;
                  return (
                    <tr
                      key={g.id}
                      onClick={() => setSelectedDistrictId(isSelected ? 'ALL' : g.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-rose-50/70' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-3.5 px-4 text-center font-extrabold text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-extrabold text-slate-900">KEC. {g.name}</span>
                        {isSelected && (
                          <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-600 text-white">
                            Terpilih
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold">
                          {g.kelurahanCount} Kel
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-extrabold text-slate-900">
                        {g.totalTps.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-emerald-600">
                        {g.officialCount}
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold text-slate-400">
                        {g.emptyTps.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-rose-500 to-indigo-600 h-full rounded-full"
                              style={{ width: `${g.pct}%` }}
                            />
                          </div>
                          <span className="font-bold text-slate-700 w-9 text-right">{g.pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* BAGIAN 2: RINCIAN KELURAHAN TERKELOMPOK PER KECAMATAN */}
      <section className="space-y-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedDistrictId}
              onChange={(e) => setSelectedDistrictId(e.target.value)}
              className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
            >
              <option value="ALL">Tampilkan Semua 15 Kecamatan</option>
              {districtGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  KEC. {g.name} ({g.kelurahanCount} Kel · {g.totalTps} TPS)
                </option>
              ))}
            </select>

            {selectedDistrictId !== 'ALL' && (
              <button
                onClick={() => setSelectedDistrictId('ALL')}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
              >
                Reset Filter
              </button>
            )}
          </div>

          <input
            type="text"
            placeholder="Cari nama kelurahan atau kecamatan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 w-full sm:w-64"
          />
        </div>

        {/* Kartu Kelompok per Kecamatan */}
        {visibleDistrictGroups.map((group) => (
          <div
            key={group.id}
            className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden"
          >
            {/* Header Kelompok Kecamatan */}
            <div className="bg-slate-900 text-white px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-lg bg-rose-500 text-white font-extrabold text-xs">
                  KEC. {group.name}
                </span>
                <span className="text-xs text-slate-300 font-semibold">
                  {group.kelurahanCount} Kelurahan · {group.totalTps.toLocaleString('id-ID')} Total TPS
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="text-emerald-400 font-bold">
                  🤝 {group.officialCount} Resmi ({group.pct}%)
                </span>
                <span className="text-slate-400">|</span>
                <span className="text-amber-300 font-semibold">
                  ⏳ {group.waitingCount} Antrean
                </span>
              </div>
            </div>

            {/* Tabel Kelurahan di dalam Kecamatan ini */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-6">Nama Kelurahan</th>
                    <th className="py-3 px-4 text-center">Jumlah TPS</th>
                    <th className="py-3 px-4 text-center">Tim Resmi</th>
                    <th className="py-3 px-4 text-center">Antrean Bertemu</th>
                    <th className="py-3 px-4 text-center">TPS Kosong</th>
                    <th className="py-3 px-4 w-40">Progres</th>
                    <th className="py-3 px-6 text-right">Pengaturan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                  {group.villages.map((v) => {
                    const st = villageStats[v.id] || { official: 0, waiting: 0, souvenir: 0 };
                    const vEmpty = Math.max(0, (v.total_tps || 0) - st.official);
                    const vPct =
                      v.total_tps > 0 ? Math.min(100, Math.round((st.official / v.total_tps) * 100)) : 0;

                    return (
                      <tr key={v.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-6 font-bold text-slate-900">KEL. {v.name}</td>
                        <td className="py-3 px-4 text-center font-extrabold text-slate-800">{v.total_tps}</td>
                        <td className="py-3 px-4 text-center font-bold text-emerald-600">{st.official}</td>
                        <td className="py-3 px-4 text-center font-semibold text-amber-600">{st.waiting}</td>
                        <td className="py-3 px-4 text-center text-slate-400">{vEmpty}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-emerald-500 h-full rounded-full"
                                style={{ width: `${vPct}%` }}
                              />
                            </div>
                            <span className="font-bold text-slate-600 w-8 text-right">{vPct}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-6 text-right">
                          <button
                            onClick={() => {
                              setEditingVillage(v);
                              setEditTpsValue(String(v.total_tps || 0));
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px]"
                          >
                            ✎ Edit TPS
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>

      {/* Modal Edit Jumlah TPS Kelurahan */}
      {editingVillage && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSaveTpsEdit} className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-extrabold text-slate-900">
              Edit Jumlah TPS — KEL. {editingVillage.name}
            </h3>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Total TPS Resmi KPU</label>
              <input
                type="number"
                min={0}
                required
                value={editTpsValue}
                onChange={(e) => setEditTpsValue(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingVillage(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
              >
                {savingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}