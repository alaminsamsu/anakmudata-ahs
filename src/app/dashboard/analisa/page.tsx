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

interface SegmentCacheRow {
  scope: 'CITY' | 'DISTRICT' | 'VILLAGE';
  region_id: string;
  district_id: string | null;
  total_count: number;
  gen_z_count: number;
  millennial_count: number;
  emak_count: number;
  combined_target_count: number;
}

interface VolunteerLite {
  village_id: string;
  met_candidate: boolean | null;
}

export default function AnalisaSegmenPage() {
  const [districts, setDistricts] = useState<District[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [volunteers, setVolunteers] = useState<VolunteerLite[]>([]);
  const [segmentCache, setSegmentCache] = useState<SegmentCacheRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string>('');

  // Filter Eksplorasi Wilayah & Fokus Segmen
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'COMBINED' | 'EMAK' | 'GEN_Z' | 'MILLENNIAL' | 'GAP'>('COMBINED');
  const [dnaFilter, setDnaFilter] = useState<'ALL' | 'EMAK_BASE' | 'YOUTH_BASE'>('ALL');
  const [searchRegion, setSearchRegion] = useState<string>('');

  useEffect(() => {
    fetchAnalysisData();
  }, []);

  async function fetchAnalysisData() {
    setLoading(true);
    setFetchError('');

    const [distRes, villRes, volRes, segRes] = await Promise.all([
      supabase.from('districts').select('id, name').order('name'),
      supabase.from('villages').select('id, district_id, name, total_tps').order('name'),
      supabase.from('volunteers').select('village_id, met_candidate'),
      supabase.from('dpt_segment_cache').select('*').limit(500),
    ]);

    if (segRes.error) {
      setFetchError(`Gagal membaca dpt_segment_cache: ${segRes.error.message}`);
    }

    if (distRes.data) setDistricts(distRes.data);
    if (villRes.data) setVillages(villRes.data);
    if (volRes.data) setVolunteers(volRes.data as VolunteerLite[]);
    if (segRes.data) {
      setSegmentCache(
        segRes.data.map((r: any) => ({
          scope: String(r.scope).trim() as 'CITY' | 'DISTRICT' | 'VILLAGE',
          region_id: String(r.region_id || '').trim(),
          district_id: r.district_id ? String(r.district_id).trim() : null,
          total_count: Number(r.total_count) || 0,
          gen_z_count: Number(r.gen_z_count) || 0,
          millennial_count: Number(r.millennial_count) || 0,
          emak_count: Number(r.emak_count) || 0,
          combined_target_count: Number(r.combined_target_count) || 0,
        }))
      );
    }
    setLoading(false);
  }

  const districtMap = useMemo(() => {
    const m: Record<string, string> = {};
    districts.forEach((d) => (m[String(d.id)] = d.name));
    return m;
  }, [districts]);

  const villageMap = useMemo(() => {
    const m: Record<string, Village> = {};
    villages.forEach((v) => (m[String(v.id)] = v));
    return m;
  }, [villages]);

  // Statistik 4 Kartu Utama (Mengikuti Scope Kota atau Kecamatan Terpilih)
  const scopeSummary = useMemo(() => {
    let row: SegmentCacheRow | undefined;
    let label = 'Seluruh Kota Makassar (15 Kecamatan)';

    if (selectedDistrictId !== 'ALL') {
      row = segmentCache.find(
        (s) => s.scope === 'DISTRICT' && String(s.region_id) === String(selectedDistrictId)
      );
      label = `KEC. ${districtMap[String(selectedDistrictId)] || '-'}`;
    } else {
      row = segmentCache.find((s) => s.scope === 'CITY' && s.region_id === 'ALL');
    }

    return {
      label,
      total: row?.total_count || 0,
      genZ: row?.gen_z_count || 0,
      millennial: row?.millennial_count || 0,
      emak: row?.emak_count || 0,
      combined: row?.combined_target_count || 0,
    };
  }, [segmentCache, selectedDistrictId, districtMap]);

  // Olah Baris Analisa Per Kecamatan (jika ALL) atau Per Kelurahan (jika Kecamatan dipilih)
  const analysisRows = useMemo(() => {
    const officialByVillage: Record<string, number> = {};
    const officialByDistrict: Record<string, number> = {};

    volunteers.forEach((vol) => {
      if (vol.met_candidate) {
        const vId = String(vol.village_id);
        officialByVillage[vId] = (officialByVillage[vId] || 0) + 1;
        const distId = villageMap[vId]?.district_id;
        if (distId) {
          const dId = String(distId);
          officialByDistrict[dId] = (officialByDistrict[dId] || 0) + 1;
        }
      }
    });

    const tpsByDistrict: Record<string, number> = {};
    villages.forEach((v) => {
      const dId = String(v.district_id);
      tpsByDistrict[dId] = (tpsByDistrict[dId] || 0) + (v.total_tps || 0);
    });

    const rawItems =
      selectedDistrictId === 'ALL'
        ? districts.map((d) => {
            const dId = String(d.id);
            const seg = segmentCache.find((s) => s.scope === 'DISTRICT' && String(s.region_id) === dId);
            return {
              id: dId,
              isDistrict: true,
              name: `KEC. ${d.name}`,
              subLabel: `${villages.filter((v) => String(v.district_id) === dId).length} Kelurahan`,
              total: seg?.total_count || 0,
              genZ: seg?.gen_z_count || 0,
              millennial: seg?.millennial_count || 0,
              emak: seg?.emak_count || 0,
              combined: seg?.combined_target_count || 0,
              officialTim: officialByDistrict[dId] || 0,
              totalTps: tpsByDistrict[dId] || 0,
            };
          })
        : villages
            .filter((v) => String(v.district_id) === String(selectedDistrictId))
            .map((v) => {
              const vId = String(v.id);
              const seg = segmentCache.find((s) => s.scope === 'VILLAGE' && String(s.region_id) === vId);
              return {
                id: vId,
                isDistrict: false,
                name: `KEL. ${v.name}`,
                subLabel: `KEC. ${districtMap[String(v.district_id)] || '-'}`,
                total: seg?.total_count || 0,
                genZ: seg?.gen_z_count || 0,
                millennial: seg?.millennial_count || 0,
                emak: seg?.emak_count || 0,
                combined: seg?.combined_target_count || 0,
                officialTim: officialByVillage[vId] || 0,
                totalTps: v.total_tps || 0,
              };
            });

    const enriched = rawItems.map((item) => {
      const emakPct = item.total > 0 ? Math.round((item.emak / item.total) * 100) : 0;
      const genZPct = item.total > 0 ? Math.round((item.genZ / item.total) * 100) : 0;
      const millennialPct = item.total > 0 ? Math.round((item.millennial / item.total) * 100) : 0;
      const youthPct = genZPct + millennialPct;
      const targetPct = item.total > 0 ? Math.round((item.combined / item.total) * 100) : 0;
      const timPct = item.totalTps > 0 ? Math.round((item.officialTim / item.totalTps) * 100) : 0;

      const gapScore = Math.round(item.combined * (1 - Math.min(1, timPct / 100)));

      let dnaType: 'EMAK_BASE' | 'YOUTH_BASE' | 'BALANCED' = 'BALANCED';
      let dnaLabel = '⚖️ Medan Kombinasi';
      let dnaBadgeClass = 'bg-slate-100 text-slate-700';
      let strategyTip = 'Gabungkan kegiatan komunitas pemuda & silaturahmi ibu-ibu RT.';

      if (emakPct >= 23 && emakPct >= youthPct - 24) {
        dnaType = 'EMAK_BASE';
        dnaLabel = '👩‍👧 Basis Kuat Emak-Emak';
        dnaBadgeClass = 'bg-purple-50 text-purple-700 border border-purple-200';
        strategyTip = 'Prioritaskan program ibu rumah tangga, majelis taklim & rekrut Tim TPS perempuan.';
      } else if (youthPct >= 50) {
        dnaType = 'YOUTH_BASE';
        dnaLabel = '⚡ Kantong Gen-Z & Milenial';
        dnaBadgeClass = 'bg-rose-50 text-rose-700 border border-rose-200';
        strategyTip = 'Fokus konten lokal, komunitas olahraga/e-sport & nongkrong bareng Caleg.';
      }

      return {
        ...item,
        emakPct,
        genZPct,
        millennialPct,
        targetPct,
        timPct,
        gapScore,
        dnaType,
        dnaLabel,
        dnaBadgeClass,
        strategyTip,
      };
    });

    const filtered = enriched.filter((row) => {
      const matchDna = dnaFilter === 'ALL' || row.dnaType === dnaFilter;
      const q = searchRegion.trim().toLowerCase();
      const matchSearch = !q || row.name.toLowerCase().includes(q);
      return matchDna && matchSearch;
    });

    filtered.sort((a, b) => {
      if (sortBy === 'EMAK') return b.emak - a.emak;
      if (sortBy === 'GEN_Z') return b.genZ - a.genZ;
      if (sortBy === 'MILLENNIAL') return b.millennial - a.millennial;
      if (sortBy === 'GAP') return b.gapScore - a.gapScore;
      return b.combined - a.combined;
    });

    return filtered;
  }, [selectedDistrictId, districts, villages, segmentCache, volunteers, villageMap, districtMap, dnaFilter, searchRegion, sortBy]);

  const topInsights = useMemo(() => {
    if (analysisRows.length === 0) return null;
    const topEmak = [...analysisRows].sort((a, b) => b.emak - a.emak)[0];
    const topYouth = [...analysisRows].sort((a, b) => b.genZ + b.millennial - (a.genZ + a.millennial))[0];
    const topGap = [...analysisRows].sort((a, b) => b.gapScore - a.gapScore)[0];
    return { topEmak, topYouth, topGap };
  }, [analysisRows]);

  const targetSharePct =
    scopeSummary.total > 0 ? Math.round((scopeSummary.combined / scopeSummary.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header Halaman Intelijen Segmen */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-[11px] font-extrabold uppercase tracking-wider mb-1.5">
            Intelijen Pemilih 2029 · Gen-Z · Milenial · Emak-Emak
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">
            🎯 Analisa Segmen & Lumbung Suara
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Pemetaan potensi suara <b>Gen-Z</b>, <b>Milenial</b>, dan <b>Emak-Emak</b> pada <b>{scopeSummary.label}</b> untuk menentukan prioritas gerakan Caleg & LO.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {selectedDistrictId !== 'ALL' && (
            <button
              type="button"
              onClick={() => setSelectedDistrictId('ALL')}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition"
            >
              ← Kembali ke 15 Kecamatan
            </button>
          )}
          <button
            type="button"
            onClick={fetchAnalysisData}
            className="px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition"
          >
            🔄 Muat Ulang Data
          </button>
          <Link
            href="/dashboard/dpt"
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition"
          >
            🗂️ Buka Arsip DPT
          </Link>
        </div>
      </div>

      {fetchError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
          ⚠️ {fetchError}
        </div>
      )}

      {/* 4 Kartu Ringkasan Segmen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-600 uppercase">⚡ Segmen Gen-Z</span>
            <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-extrabold">
              22–29 Thn (2029)
            </span>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">
            {loading ? '...' : `${scopeSummary.genZ.toLocaleString('id-ID')} Jiwa`}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {scopeSummary.total > 0
              ? `${Math.round((scopeSummary.genZ / scopeSummary.total) * 100)}% dari DPT · Pemilih pemula & mahasiswa`
              : 'Memuat data...'}
          </p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-600 uppercase">💼 Segmen Milenial</span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-extrabold">
              30–44 Thn (2029)
            </span>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">
            {loading ? '...' : `${scopeSummary.millennial.toLocaleString('id-ID')} Jiwa`}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {scopeSummary.total > 0
              ? `${Math.round((scopeSummary.millennial / scopeSummary.total) * 100)}% dari DPT · Keluarga muda & pekerja`
              : 'Memuat data...'}
          </p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-600 uppercase">👩‍👧 Segmen Emak-Emak</span>
            <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-extrabold">
              Perempuan 35–60 Thn
            </span>
          </div>
          <div className="text-2xl font-extrabold text-purple-700 mt-2">
            {loading ? '...' : `${scopeSummary.emak.toLocaleString('id-ID')} Jiwa`}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {scopeSummary.total > 0
              ? `${Math.round((scopeSummary.emak / scopeSummary.total) * 100)}% dari DPT · Penentu suara keluarga`
              : 'Memuat data...'}
          </p>
        </div>

        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-5 rounded-3xl border border-indigo-900/50 shadow-sm text-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-300 uppercase">🎯 Total Basis Target</span>
            <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-200 text-[11px] font-extrabold">
              {targetSharePct}% DPT
            </span>
          </div>
          <div className="text-2xl font-extrabold text-white mt-2">
            {loading ? '...' : `${scopeSummary.combined.toLocaleString('id-ID')} Jiwa`}
          </div>
          <p className="text-xs text-indigo-200 mt-1">
            Dari {scopeSummary.total.toLocaleString('id-ID')} total pemilih wilayah ini
          </p>
        </div>
      </div>

      {/* 3 Kartu Rekomendasi Taktis Otomatis untuk Caleg */}
      {topInsights && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-purple-50/70 border border-purple-200/80 rounded-2xl p-4 space-y-1">
            <span className="text-[10px] font-extrabold uppercase text-purple-700">
              👩‍👧 Lumbung Emak-Emak Terbesar
            </span>
            <div className="text-sm font-extrabold text-slate-900">{topInsights.topEmak.name}</div>
            <p className="text-xs text-slate-600">
              <b>{topInsights.topEmak.emak.toLocaleString('id-ID')} pemilih Emak-Emak</b> ({topInsights.topEmak.emakPct}%). Cocok untuk program ibu rumah tangga & kader penggerak perempuan.
            </p>
          </div>

          <div className="bg-rose-50/70 border border-rose-200/80 rounded-2xl p-4 space-y-1">
            <span className="text-[10px] font-extrabold uppercase text-rose-700">
              ⚡ Kantong Gen-Z & Milenial Terbesar
            </span>
            <div className="text-sm font-extrabold text-slate-900">{topInsights.topYouth.name}</div>
            <p className="text-xs text-slate-600">
              <b>{(topInsights.topYouth.genZ + topInsights.topYouth.millennial).toLocaleString('id-ID')} pemilih muda</b>. Prioritaskan pendekatan komunitas, olahraga & kampanye kreatif.
            </p>
          </div>

          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 space-y-1">
            <span className="text-[10px] font-extrabold uppercase text-amber-800">
              🚨 Prioritas Rekrutmen Tim (Celah Terbesar)
            </span>
            <div className="text-sm font-extrabold text-slate-900">{topInsights.topGap.name}</div>
            <p className="text-xs text-slate-600">
              Potensi <b>{topInsights.topGap.combined.toLocaleString('id-ID')} suara target</b>, namun Tim TPS baru terisi <b>{topInsights.topGap.officialTim}/{topInsights.topGap.totalTps} TPS</b> ({topInsights.topGap.timPct}%).
            </p>
          </div>
        </div>
      )}

      {/* Filter & Kontrol Peringkat Wilayah */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedDistrictId}
            onChange={(e) => setSelectedDistrictId(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-extrabold text-slate-800 bg-white"
          >
            <option value="ALL">🗺️ Semua Kecamatan (15)</option>
            {districts.map((d) => (
              <option key={d.id} value={String(d.id)}>
                KEC. {d.name}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-indigo-700 bg-indigo-50/50"
          >
            <option value="COMBINED">Urutkan: Total Gabungan Target</option>
            <option value="EMAK">Urutkan: Emak-Emak Terbanyak</option>
            <option value="GEN_Z">Urutkan: Gen-Z Terbanyak</option>
            <option value="MILLENNIAL">Urutkan: Milenial Terbanyak</option>
            <option value="GAP">Urutkan: Celah Rekrutmen Tim Terbesar</option>
          </select>

          <select
            value={dnaFilter}
            onChange={(e) => setDnaFilter(e.target.value as any)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white"
          >
            <option value="ALL">Semua Karakter Medan (DNA)</option>
            <option value="EMAK_BASE">👩‍👧 Basis Kuat Emak-Emak</option>
            <option value="YOUTH_BASE">⚡ Kantong Gen-Z & Milenial</option>
          </select>
        </div>

        <input
          type="text"
          placeholder={selectedDistrictId === 'ALL' ? 'Cari kecamatan...' : 'Cari kelurahan...'}
          value={searchRegion}
          onChange={(e) => setSearchRegion(e.target.value)}
          className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 w-full lg:w-56"
        />
      </div>

      {/* Tabel Analisa Komposisi Segmen & Rekomendasi Lapangan */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-4">Wilayah</th>
                <th className="py-3.5 px-4 text-right">⚡ Gen-Z</th>
                <th className="py-3.5 px-4 text-right">💼 Milenial</th>
                <th className="py-3.5 px-4 text-right">👩‍👧 Emak-Emak</th>
                <th className="py-3.5 px-4 text-right">🎯 Gabungan Target</th>
                <th className="py-3.5 px-4">DNA Medan & Rekomendasi Gerakan</th>
                <th className="py-3.5 px-4 text-center">Kesiapan Tim TPS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    Memuat analisa segmen DPT...
                  </td>
                </tr>
              ) : analysisRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    Tidak ada wilayah yang sesuai dengan filter ini.
                  </td>
                </tr>
              ) : (
                analysisRows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => {
                      if (row.isDistrict) setSelectedDistrictId(row.id);
                    }}
                    className={`hover:bg-slate-50/90 transition ${row.isDistrict ? 'cursor-pointer' : ''}`}
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                        {row.name}
                        {row.isDistrict && <span className="text-indigo-500 text-[11px]">→</span>}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {row.subLabel} · Total DPT: {row.total.toLocaleString('id-ID')}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="font-bold text-rose-600">{row.genZ.toLocaleString('id-ID')}</div>
                      <div className="text-[10px] text-slate-400">{row.genZPct}%</div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="font-bold text-indigo-600">{row.millennial.toLocaleString('id-ID')}</div>
                      <div className="text-[10px] text-slate-400">{row.millennialPct}%</div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="font-extrabold text-purple-700">{row.emak.toLocaleString('id-ID')}</div>
                      <div className="text-[10px] text-purple-500 font-semibold">{row.emakPct}%</div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="font-extrabold text-slate-900">{row.combined.toLocaleString('id-ID')}</div>
                      <div className="text-[10px] font-bold text-emerald-600">{row.targetPct}% DPT</div>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${row.dnaBadgeClass}`}>
                        {row.dnaLabel}
                      </span>
                      <p className="text-[11px] text-slate-500 mt-1 leading-snug">{row.strategyTip}</p>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                          row.timPct >= 50
                            ? 'bg-emerald-50 text-emerald-700'
                            : row.officialTim > 0
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {row.officialTim}/{row.totalTps} TPS ({row.timPct}%)
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}