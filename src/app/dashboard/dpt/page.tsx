'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
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

interface DptRecord {
  id: string;
  district_id: string;
  village_id: string;
  tps_number: number;
  no_urut: number | null;
  full_name: string;
  gender: string | null;
  age: number | null;
  rt: string | null;
  rw: string | null;
  keterangan: string | null;
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

interface ParsedDptRow {
  district_id: string;
  village_id: string;
  tps_number: number;
  no_urut: number | null;
  full_name: string;
  gender: string | null;
  age: number | null;
  rt: string | null;
  rw: string | null;
  keterangan: string | null;
}

type SegmentFilterType = 'ALL' | 'EMAK' | 'GEN_Z' | 'MILLENNIAL';

function normalizeName(str: string): string {
  return String(str || '')
    .toUpperCase()
    .replace(/^KEC\.?\s*/i, '')
    .replace(/^KEL\.?\s*/i, '')
    .replace(/^DESA\/KELURAHAN\s*:?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function DatabaseDptPage() {
  const [districts, setDistricts] = useState<District[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [volunteers, setVolunteers] = useState<VolunteerLite[]>([]);
  const [segmentCache, setSegmentCache] = useState<SegmentCacheRow[]>([]);
  const [dptList, setDptList] = useState<DptRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statsLoading, setStatsLoading] = useState<boolean>(true);

  // Filter Pencarian & Segmen
  const [filterDistrict, setFilterDistrict] = useState<string>('ALL');
  const [filterVillage, setFilterVillage] = useState<string>('ALL');
  const [filterTps, setFilterTps] = useState<string>('');
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilterType>('ALL');
  const [searchName, setSearchName] = useState<string>('');
  const [showDnaTable, setShowDnaTable] = useState<boolean>(true);
  const fetchSeqRef = useRef<number>(0);

  // Modal Import DPT (Excel & PDF KPU)
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [parsedRows, setParsedRows] = useState<ParsedDptRow[]>([]);
  const [parseStatusText, setParseStatusText] = useState<string>('');
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [replaceVillageData, setReplaceVillageData] = useState<boolean>(true);

  useEffect(() => {
    initPage();
  }, []);

  useEffect(() => {
    if (districts.length === 0) return;

    const timer = setTimeout(() => {
      fetchFilteredDpt();
    }, 350);

    return () => clearTimeout(timer);
  }, [filterDistrict, filterVillage, filterTps, segmentFilter, searchName, districts]);

  async function initPage() {
    setLoading(true);
    setStatsLoading(true);

    const [distRes, villRes, volRes, segRes] = await Promise.all([
      supabase.from('districts').select('id, name').order('name'),
      supabase.from('villages').select('id, district_id, name, total_tps').order('name'),
      supabase.from('volunteers').select('village_id, met_candidate'),
      supabase.from('dpt_segment_cache').select('*'),
    ]);

    if (distRes.data) setDistricts(distRes.data);
    if (villRes.data) setVillages(villRes.data);
    if (volRes.data) setVolunteers(volRes.data as VolunteerLite[]);
    if (segRes.data) {
      setSegmentCache(
        segRes.data.map((r: any) => ({
          ...r,
          total_count: Number(r.total_count) || 0,
          gen_z_count: Number(r.gen_z_count) || 0,
          millennial_count: Number(r.millennial_count) || 0,
          emak_count: Number(r.emak_count) || 0,
          combined_target_count: Number(r.combined_target_count) || 0,
        }))
      );
    }
    setStatsLoading(false);
  }

  async function refreshSegmentCache() {
    setStatsLoading(true);
    const { data } = await supabase.from('dpt_segment_cache').select('*');
    if (data) {
      setSegmentCache(
        data.map((r: any) => ({
          ...r,
          total_count: Number(r.total_count) || 0,
          gen_z_count: Number(r.gen_z_count) || 0,
          millennial_count: Number(r.millennial_count) || 0,
          emak_count: Number(r.emak_count) || 0,
          combined_target_count: Number(r.combined_target_count) || 0,
        }))
      );
    }
    setStatsLoading(false);
  }

  async function fetchFilteredDpt() {
    const seqId = ++fetchSeqRef.current;
    setLoading(true);

    let query = supabase
      .from('dpt')
      .select('id, district_id, village_id, tps_number, no_urut, full_name, gender, age, rt, rw, keterangan')
      .limit(60);

    if (!searchName.trim()) {
      query = query.order('tps_number', { ascending: true }).order('no_urut', { ascending: true });
    }

    if (filterDistrict !== 'ALL') query = query.eq('district_id', filterDistrict);
    if (filterVillage !== 'ALL') query = query.eq('village_id', filterVillage);
    if (filterTps.trim()) {
      const parsedTps = parseInt(filterTps.trim(), 10);
      if (!isNaN(parsedTps)) query = query.eq('tps_number', parsedTps);
    }

    // Filter Segmen Target (Gen-Z, Milenial, Emak-Emak)
    if (segmentFilter === 'EMAK') {
      query = query.eq('gender', 'P').gte('age', 35).lte('age', 60);
    } else if (segmentFilter === 'GEN_Z') {
      query = query.gte('age', 17).lte('age', 24);
    } else if (segmentFilter === 'MILLENNIAL') {
      query = query.gte('age', 25).lte('age', 39);
    }

    if (searchName.trim()) {
      query = query.ilike('full_name', `%${searchName.trim().toUpperCase()}%`);
    }

    const { data } = await query;

    if (seqId !== fetchSeqRef.current) return;
    if (data) setDptList(data as DptRecord[]);
    setLoading(false);
  }

  const districtMap = useMemo(() => {
    const m: Record<string, string> = {};
    districts.forEach((d) => (m[d.id] = d.name));
    return m;
  }, [districts]);

  const villageMap = useMemo(() => {
    const m: Record<string, Village> = {};
    villages.forEach((v) => (m[v.id] = v));
    return m;
  }, [villages]);

  // Statistik 4 Kartu Segmen Aktif (Otomatis menyesuaikan Kota / Kecamatan / Kelurahan yang dipilih)
  const activeScopeStats = useMemo(() => {
    let found: SegmentCacheRow | undefined;
    let scopeLabel = 'Seluruh Kota Makassar (15 Kecamatan)';

    if (filterVillage !== 'ALL') {
      found = segmentCache.find((s) => s.scope === 'VILLAGE' && s.region_id === filterVillage);
      scopeLabel = `KEL. ${villageMap[filterVillage]?.name || '-'}`;
    } else if (filterDistrict !== 'ALL') {
      found = segmentCache.find((s) => s.scope === 'DISTRICT' && s.region_id === filterDistrict);
      scopeLabel = `KEC. ${districtMap[filterDistrict] || '-'}`;
    } else {
      found = segmentCache.find((s) => s.scope === 'CITY' && s.region_id === 'ALL');
    }

    return {
      scopeLabel,
      total: found?.total_count || 0,
      genZ: found?.gen_z_count || 0,
      millennial: found?.millennial_count || 0,
      emak: found?.emak_count || 0,
      combined: found?.combined_target_count || 0,
    };
  }, [segmentCache, filterDistrict, filterVillage, districtMap, villageMap]);

  // Tabel DNA Wilayah & Kesenjangan Tim TPS (Per Kecamatan jika filter ALL, Per Kelurahan jika filter Kecamatan)
  const regionalDnaRows = useMemo(() => {
    const officialByVillage: Record<string, number> = {};
    const officialByDistrict: Record<string, number> = {};

    volunteers.forEach((vol) => {
      if (vol.met_candidate) {
        officialByVillage[vol.village_id] = (officialByVillage[vol.village_id] || 0) + 1;
        const distId = villageMap[vol.village_id]?.district_id;
        if (distId) {
          officialByDistrict[distId] = (officialByDistrict[distId] || 0) + 1;
        }
      }
    });

    if (filterDistrict === 'ALL') {
      const tpsByDistrict: Record<string, number> = {};
      villages.forEach((v) => {
        tpsByDistrict[v.district_id] = (tpsByDistrict[v.district_id] || 0) + (v.total_tps || 0);
      });

      return districts
        .map((d) => {
          const seg = segmentCache.find((s) => s.scope === 'DISTRICT' && s.region_id === d.id);
          const total = seg?.total_count || 0;
          const genZ = seg?.gen_z_count || 0;
          const millennial = seg?.millennial_count || 0;
          const emak = seg?.emak_count || 0;
          const combined = seg?.combined_target_count || 0;

          const emakPct = total > 0 ? Math.round((emak / total) * 100) : 0;
          const youthPct = total > 0 ? Math.round(((genZ + millennial) / total) * 100) : 0;
          const targetPct = total > 0 ? Math.round((combined / total) * 100) : 0;

          let dnaBadge = '⚖️ Medan Seimbang';
          let dnaColor = 'bg-slate-100 text-slate-700';
          if (emakPct >= 23 && emakPct >= youthPct - 24) {
            dnaBadge = '👩‍👧 Basis Kuat Emak-Emak';
            dnaColor = 'bg-purple-50 text-purple-700 border border-purple-200';
          } else if (youthPct >= 50) {
            dnaBadge = '⚡ Kantong Gen-Z & Milenial';
            dnaColor = 'bg-rose-50 text-rose-700 border border-rose-200';
          }

          return {
            id: d.id,
            isDistrict: true,
            name: `KEC. ${d.name}`,
            total,
            genZ,
            millennial,
            emak,
            combined,
            targetPct,
            dnaBadge,
            dnaColor,
            officialTim: officialByDistrict[d.id] || 0,
            totalTps: tpsByDistrict[d.id] || 0,
          };
        })
        .sort((a, b) => b.combined - a.combined);
    } else {
      const distVillages = villages.filter((v) => v.district_id === filterDistrict);
      return distVillages
        .map((v) => {
          const seg = segmentCache.find((s) => s.scope === 'VILLAGE' && s.region_id === v.id);
          const total = seg?.total_count || 0;
          const genZ = seg?.gen_z_count || 0;
          const millennial = seg?.millennial_count || 0;
          const emak = seg?.emak_count || 0;
          const combined = seg?.combined_target_count || 0;

          const emakPct = total > 0 ? Math.round((emak / total) * 100) : 0;
          const youthPct = total > 0 ? Math.round(((genZ + millennial) / total) * 100) : 0;
          const targetPct = total > 0 ? Math.round((combined / total) * 100) : 0;

          let dnaBadge = '⚖️ Medan Seimbang';
          let dnaColor = 'bg-slate-100 text-slate-700';
          if (emakPct >= 23 && emakPct >= youthPct - 24) {
            dnaBadge = '👩‍👧 Basis Kuat Emak-Emak';
            dnaColor = 'bg-purple-50 text-purple-700 border border-purple-200';
          } else if (youthPct >= 50) {
            dnaBadge = '⚡ Kantong Gen-Z & Milenial';
            dnaColor = 'bg-rose-50 text-rose-700 border border-rose-200';
          }

          return {
            id: v.id,
            isDistrict: false,
            name: `KEL. ${v.name}`,
            total,
            genZ,
            millennial,
            emak,
            combined,
            targetPct,
            dnaBadge,
            dnaColor,
            officialTim: officialByVillage[v.id] || 0,
            totalTps: v.total_tps || 0,
          };
        })
        .sort((a, b) => b.combined - a.combined);
    }
  }, [filterDistrict, districts, villages, segmentCache, volunteers, villageMap]);

  function resolveVillage(rawDistrict: string, rawVillage: string): Village | undefined {
    const cleanVill = normalizeName(rawVillage);
    if (!cleanVill) return undefined;

    if (rawDistrict) {
      const cleanDist = normalizeName(rawDistrict);
      const dist = districts.find((d) => normalizeName(d.name) === cleanDist);
      if (dist) {
        const exact = villages.find(
          (v) => v.district_id === dist.id && normalizeName(v.name) === cleanVill
        );
        if (exact) return exact;
      }
    }

    return (
      villages.find((v) => normalizeName(v.name) === cleanVill) ||
      villages.find(
        (v) => normalizeName(v.name).replace(/[^A-Z]/g, '') === cleanVill.replace(/[^A-Z]/g, '')
      )
    );
  }

  function parseKpuExcelBuffer(buffer: ArrayBuffer, fileName: string): ParsedDptRow[] {
    const wb = XLSX.read(buffer, { type: 'array' });
    const extracted: ParsedDptRow[] = [];
    const fileStem = normalizeName(fileName.replace(/\.[^/.]+$/, '').replace(/^\d+[\.\-\s]*/, ''));

    wb.SheetNames.forEach((sheetName) => {
      const sheet = wb.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      let currentDistrict = '';
      let currentVillage = '';
      let currentTps = 1;

      for (let i = 0; i < rows.length; i++) {
        const cells = rows[i].map((c) => String(c || '').trim());
        const joined = cells.filter(Boolean).join(' ');
        if (!joined) continue;

        const upperJoined = joined.toUpperCase();

        const kecMatch = upperJoined.match(/KECAMATAN\s*[:\-]?\s*([A-Z\s']+?)(?=\s+(?:DESA|KELURAHAN|TPS|KABUPATEN|KOTA|$))/);
        if (kecMatch && kecMatch[1]) currentDistrict = normalizeName(kecMatch[1]);

        const kelMatch = upperJoined.match(/(?:DESA\/KELURAHAN|KELURAHAN)\s*[:\-]?\s*([A-Z\s'\-]+?)(?=\s+(?:TPS|KECAMATAN|$))/);
        if (kelMatch && kelMatch[1]) currentVillage = normalizeName(kelMatch[1]);

        const tpsMatch = upperJoined.match(/\bTPS\s*[:\-]?\s*0*(\d+)\b/);
        if (tpsMatch && tpsMatch[1]) currentTps = parseInt(tpsMatch[1], 10) || 1;

        const nonEmpty = cells.filter((c) => c !== '');
        if (nonEmpty.length < 4) continue;

        const firstNum = parseInt(nonEmpty[0], 10);
        if (isNaN(firstNum) || firstNum <= 0) continue;

        const genderIdx = nonEmpty.findIndex((val, idx) => idx >= 2 && (val === 'L' || val === 'P'));
        if (genderIdx === -1) continue;

        const fullName = nonEmpty.slice(1, genderIdx).join(' ').toUpperCase().trim();
        if (!fullName || fullName === 'NAMA' || fullName.includes('JENIS KELAMIN')) continue;

        const gender = nonEmpty[genderIdx];
        const age = parseInt(nonEmpty[genderIdx + 1], 10) || null;
        const rowVillageRaw = nonEmpty[genderIdx + 2] || currentVillage || fileStem;
        const rt = nonEmpty[genderIdx + 3] ? String(nonEmpty[genderIdx + 3]).padStart(3, '0') : null;
        const rw = nonEmpty[genderIdx + 4] ? String(nonEmpty[genderIdx + 4]).padStart(3, '0') : null;
        const ket = nonEmpty[genderIdx + 5] || null;

        const matchedVill = resolveVillage(currentDistrict, rowVillageRaw) || resolveVillage(currentDistrict, currentVillage);
        if (!matchedVill) continue;

        extracted.push({
          district_id: matchedVill.district_id,
          village_id: matchedVill.id,
          tps_number: currentTps,
          no_urut: firstNum,
          full_name: fullName,
          gender,
          age,
          rt,
          rw,
          keterangan: ket,
        });
      }
    });

    return extracted;
  }

  async function parseKpuPdfBuffer(buffer: ArrayBuffer, fileName: string): Promise<ParsedDptRow[]> {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const extracted: ParsedDptRow[] = [];
    const fileStem = normalizeName(fileName.replace(/\.pdf$/i, '').replace(/^\d+[\.\-\s]*/, ''));

    let currentDistrict = '';
    let currentVillage = fileStem;
    let currentTps = 1;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      const lineMap = new Map<number, { x: number; str: string }[]>();
      for (const item of textContent.items as any[]) {
        if (!item.str || !item.str.trim()) continue;
        const y = Math.round(item.transform[5] / 4) * 4;
        const x = item.transform[4];
        if (!lineMap.has(y)) lineMap.set(y, []);
        lineMap.get(y)!.push({ x, str: item.str.trim() });
      }

      const sortedLines = Array.from(lineMap.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([, items]) => items.sort((a, b) => a.x - b.x).map((i) => i.str));

      for (const tokens of sortedLines) {
        const lineStr = tokens.join(' ').toUpperCase();

        const kecMatch = lineStr.match(/KECAMATAN\s*[:\-]?\s*([A-Z\s']+?)(?=\s+(?:DESA|KELURAHAN|TPS|KABUPATEN|$))/);
        if (kecMatch && kecMatch[1]) currentDistrict = normalizeName(kecMatch[1]);

        const kelMatch = lineStr.match(/(?:DESA\/KELURAHAN|KELURAHAN)\s*[:\-]?\s*([A-Z\s'\-]+?)(?=\s+(?:TPS|KECAMATAN|$))/);
        if (kelMatch && kelMatch[1]) currentVillage = normalizeName(kelMatch[1]);

        const tpsMatch = lineStr.match(/\bTPS\s*[:\-]?\s*0*(\d+)\b/);
        if (tpsMatch && tpsMatch[1]) currentTps = parseInt(tpsMatch[1], 10) || 1;

        const rowMatch = lineStr.match(/^(\d+)\s+(.+?)\s+(L|P)\s+(\d{2,3})\s+(.+?)\s+(\d{1,3})\s+(\d{1,3})(?:\s+(.*))?$/);
        if (rowMatch) {
          const noUrut = parseInt(rowMatch[1], 10);
          const fullName = rowMatch[2].trim();
          const gender = rowMatch[3];
          const age = parseInt(rowMatch[4], 10);
          const villRaw = rowMatch[5].trim();
          const rt = rowMatch[6].padStart(3, '0');
          const rw = rowMatch[7].padStart(3, '0');
          const ket = rowMatch[8]?.trim() || null;

          const matchedVill = resolveVillage(currentDistrict, villRaw) || resolveVillage(currentDistrict, currentVillage);
          if (matchedVill) {
            extracted.push({
              district_id: matchedVill.district_id,
              village_id: matchedVill.id,
              tps_number: currentTps,
              no_urut: noUrut,
              full_name: fullName,
              gender,
              age,
              rt,
              rw,
              keterangan: ket,
            });
          }
        }
      }
    }

    return extracted;
  }

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsParsing(true);
    setParsedRows([]);
    let allParsed: ParsedDptRow[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setParseStatusText(`Membaca file (${i + 1}/${files.length}): ${f.name}...`);
      const buffer = await f.arrayBuffer();

      if (f.name.toLowerCase().endsWith('.pdf')) {
        const rows = await parseKpuPdfBuffer(buffer, f.name);
        allParsed = allParsed.concat(rows);
      } else {
        const rows = parseKpuExcelBuffer(buffer, f.name);
        allParsed = allParsed.concat(rows);
      }
    }

    setParsedRows(allParsed);
    setIsParsing(false);
    setParseStatusText(
      `Selesai membaca ${files.length} file: ditemukan ${allParsed.length.toLocaleString('id-ID')} data pemilih valid.`
    );
  };

  const handleSaveParsedDpt = async () => {
    if (parsedRows.length === 0) return;
    setIsUploading(true);
    setUploadProgress(5);

    try {
      if (replaceVillageData) {
        const uniqueVillageIds = Array.from(new Set(parsedRows.map((r) => r.village_id)));
        for (const vId of uniqueVillageIds) {
          await supabase.from('dpt').delete().eq('village_id', vId);
        }
      }

      const batchSize = 500;
      const totalBatches = Math.ceil(parsedRows.length / batchSize);

      for (let b = 0; b < totalBatches; b++) {
        const chunk = parsedRows.slice(b * batchSize, (b + 1) * batchSize);
        const { error } = await supabase.from('dpt').insert(chunk);
        if (error) throw error;
        setUploadProgress(Math.round(((b + 1) / totalBatches) * 100));
      }

      alert(`Berhasil menyimpan ${parsedRows.length.toLocaleString('id-ID')} data pemilih DPT ke database!`);
      setShowImportModal(false);
      setParsedRows([]);
      setParseStatusText('');
      await refreshSegmentCache();
      await fetchFilteredDpt();
    } catch (err: any) {
      alert('Gagal mengunggah data DPT: ' + (err?.message || err));
    } finally {
      setIsUploading(false);
    }
  };

  const targetSharePct =
    activeScopeStats.total > 0
      ? Math.round((activeScopeStats.combined / activeScopeStats.total) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-600 text-[11px] font-extrabold uppercase tracking-wider mb-1.5">
            Fokus Strategi: Gen-Z · Milenial · Emak-Emak
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900">🗂️ Database & Analisa Segmen DPT Makassar</h1>
          <p className="text-sm text-slate-500 mt-1">
            Pemetaan kantong suara <b>Gen-Z</b>, <b>Milenial</b>, dan <b>Emak-Emak</b> se-Kota Makassar ({activeScopeStats.scopeLabel}).
          </p>
        </div>

        <button
          onClick={() => {
            setParsedRows([]);
            setParseStatusText('');
            setUploadProgress(0);
            setShowImportModal(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 via-pink-500 to-indigo-600 text-white text-xs font-bold shadow-md shadow-rose-500/20 hover:opacity-95 self-start md:self-auto"
        >
          📥 Upload DPT (Excel / PDF KPU)
        </button>
      </div>

      {/* 4 KARTU INTELIJEN SEGMEN TARGET (GEN-Z, MILENIAL, EMAK-EMAK & GABUNGAN) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-600 uppercase">⚡ Segmen Gen-Z</span>
            <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-extrabold">
              17–24 Thn
            </span>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1.5">
            {statsLoading ? '...' : `${activeScopeStats.genZ.toLocaleString('id-ID')} Jiwa`}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {activeScopeStats.total > 0
              ? `${Math.round((activeScopeStats.genZ / activeScopeStats.total) * 100)}% dari DPT · Usia 22–29 thn di 2029`
              : 'Pemilih pemula & mahasiswa'}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-600 uppercase">💼 Segmen Milenial</span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-extrabold">
              25–39 Thn
            </span>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1.5">
            {statsLoading ? '...' : `${activeScopeStats.millennial.toLocaleString('id-ID')} Jiwa`}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {activeScopeStats.total > 0
              ? `${Math.round((activeScopeStats.millennial / activeScopeStats.total) * 100)}% dari DPT · Keluarga muda & pekerja`
              : 'Usia produktif 30–44 thn di 2029'}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-600 uppercase">👩‍👧 Segmen Emak-Emak</span>
            <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-extrabold">
              P · 35–60 Thn
            </span>
          </div>
          <div className="text-2xl font-extrabold text-purple-700 mt-1.5">
            {statsLoading ? '...' : `${activeScopeStats.emak.toLocaleString('id-ID')} Jiwa`}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {activeScopeStats.total > 0
              ? `${Math.round((activeScopeStats.emak / activeScopeStats.total) * 100)}% dari DPT · Penentu pilihan keluarga`
              : 'Ibu rumah tangga & penggerak majelis'}
          </p>
        </div>

        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-5 rounded-2xl border border-indigo-900/50 shadow-sm text-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-300 uppercase">🎯 Total Basis Target</span>
            <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-200 text-[11px] font-extrabold">
              {targetSharePct}% DPT
            </span>
          </div>
          <div className="text-2xl font-extrabold text-white mt-1.5">
            {statsLoading ? '...' : `${activeScopeStats.combined.toLocaleString('id-ID')} Jiwa`}
          </div>
          <p className="text-xs text-indigo-200 mt-1">
            Dari total {activeScopeStats.total.toLocaleString('id-ID')} pemilih wilayah ini
          </p>
        </div>
      </div>

      {/* PAPAN ANALISA DNA WILAYAH & KESENJANGAN TIM TPS (RECRUITMENT GAP) */}
      <section className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              📊 Peta DNA Wilayah & Kesenjangan Tim TPS ({filterDistrict === 'ALL' ? '15 Kecamatan Makassar' : `Kelurahan di KEC. ${districtMap[filterDistrict]}`})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Klik baris kecamatan/kelurahan untuk melihat detail pemilih dan menyesuaikan strategi pendekatan lapangan.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDnaTable((prev) => !prev)}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 self-start sm:self-auto"
          >
            {showDnaTable ? 'Sembunyikan Tabel Analisa ▲' : 'Tampilkan Tabel Analisa ▼'}
          </button>
        </div>

        {showDnaTable && (
          <div className="overflow-x-auto border border-slate-100 rounded-2xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Wilayah</th>
                  <th className="py-3 px-4 text-right">⚡ Gen-Z</th>
                  <th className="py-3 px-4 text-right">💼 Milenial</th>
                  <th className="py-3 px-4 text-right">👩‍👧 Emak-Emak</th>
                  <th className="py-3 px-4 text-right">🎯 Gabungan Target</th>
                  <th className="py-3 px-4 text-center">Karakter Medan (DNA)</th>
                  <th className="py-3 px-4 text-center">Kesiapan Tim TPS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {regionalDnaRows.map((row) => {
                  const timPct = row.totalTps > 0 ? Math.round((row.officialTim / row.totalTps) * 100) : 0;
                  return (
                    <tr
                      key={row.id}
                      onClick={() => {
                        if (row.isDistrict) {
                          setFilterDistrict(row.id);
                          setFilterVillage('ALL');
                        } else {
                          setFilterVillage(row.id);
                        }
                      }}
                      className="hover:bg-indigo-50/50 cursor-pointer transition"
                    >
                      <td className="py-3 px-4 font-extrabold text-slate-900">
                        {row.name}
                        <span className="block text-[10px] font-normal text-slate-400">
                          Total DPT: {row.total.toLocaleString('id-ID')} jiwa
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-rose-600">
                        {row.genZ.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-indigo-600">
                        {row.millennial.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4 text-right font-extrabold text-purple-700">
                        {row.emak.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-extrabold text-slate-900">
                          {row.combined.toLocaleString('id-ID')}
                        </span>{' '}
                        <span className="text-[10px] font-bold text-emerald-600">({row.targetPct}%)</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${row.dnaColor}`}>
                          {row.dnaBadge}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                            timPct >= 50
                              ? 'bg-emerald-50 text-emerald-700'
                              : row.officialTim > 0
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {row.officialTim}/{row.totalTps} TPS ({timPct}%)
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* FILTER PENCARIAN PEMILIH & TOMBOL SEGMEN CEPAT */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">Filter Segmen:</span>
          <button
            type="button"
            onClick={() => setSegmentFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              segmentFilter === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua Pemilih
          </button>
          <button
            type="button"
            onClick={() => setSegmentFilter('EMAK')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              segmentFilter === 'EMAK'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'
            }`}
          >
            👩‍👧 Emak-Emak (P · 35–60 Thn)
          </button>
          <button
            type="button"
            onClick={() => setSegmentFilter('GEN_Z')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              segmentFilter === 'GEN_Z'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
            }`}
          >
            ⚡ Gen-Z (17–24 Thn)
          </button>
          <button
            type="button"
            onClick={() => setSegmentFilter('MILLENNIAL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              segmentFilter === 'MILLENNIAL'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
            }`}
          >
            💼 Milenial (25–39 Thn)
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <select
            value={filterDistrict}
            onChange={(e) => {
              setFilterDistrict(e.target.value);
              setFilterVillage('ALL');
            }}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white"
          >
            <option value="ALL">Semua Kecamatan (15)</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                KEC. {d.name}
              </option>
            ))}
          </select>

          <select
            value={filterVillage}
            onChange={(e) => setFilterVillage(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white"
          >
            <option value="ALL">Semua Kelurahan</option>
            {villages
              .filter((v) => filterDistrict === 'ALL' || v.district_id === filterDistrict)
              .map((v) => (
                <option key={v.id} value={v.id}>
                  KEL. {v.name}
                </option>
              ))}
          </select>

          <input
            type="number"
            min={1}
            placeholder="No. TPS"
            value={filterTps}
            onChange={(e) => setFilterTps(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 w-24"
          />

          <input
            type="text"
            placeholder="Cari nama pemilih..."
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 flex-1 min-w-[200px]"
          />
        </div>
      </div>

      {/* TABEL DAFTAR PEMILIH DPT DENGAN LENCANA SEGMEN */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-4 w-16 text-center">No</th>
                <th className="py-3.5 px-4">Nama Pemilih & Segmen</th>
                <th className="py-3.5 px-4 text-center">L/P</th>
                <th className="py-3.5 px-4 text-center">Usia</th>
                <th className="py-3.5 px-4">Kelurahan & Kecamatan</th>
                <th className="py-3.5 px-4 text-center">TPS</th>
                <th className="py-3.5 px-4 text-center">RT / RW</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    Memuat data pemilih DPT...
                  </td>
                </tr>
              ) : dptList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    Belum ada data pemilih ditemukan pada filter ini.
                  </td>
                </tr>
              ) : (
                dptList.map((row) => {
                  const vill = villageMap[row.village_id];
                  const distName = districtMap[row.district_id] || '-';
                  const age = row.age || 0;
                  const isGenZ = age >= 17 && age <= 24;
                  const isMillennial = age >= 25 && age <= 39;
                  const isEmak = row.gender === 'P' && age >= 35 && age <= 60;

                  return (
                    <tr key={row.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 text-center font-mono text-slate-400">
                        {row.no_urut || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900">{row.full_name}</span>
                        <div className="inline-flex flex-wrap gap-1 ml-2">
                          {isEmak && (
                            <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-extrabold">
                              👩‍👧 Emak-Emak
                            </span>
                          )}
                          {isGenZ && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[10px] font-extrabold">
                              ⚡ Gen-Z
                            </span>
                          )}
                          {isMillennial && (
                            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-extrabold">
                              💼 Milenial
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-bold">{row.gender || '-'}</td>
                      <td className="py-3 px-4 text-center font-semibold">
                        {row.age ? `${row.age} Thn` : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">KEL. {vill?.name || '-'}</div>
                        <div className="text-[11px] text-slate-400">KEC. {distName}</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-extrabold">
                          TPS {String(row.tps_number).padStart(3, '0')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-600">
                        {row.rt || '000'} / {row.rw || '000'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {dptList.length === 60 && (
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 text-center">
            Menampilkan 60 baris pertama sesuai filter. Gunakan filter Kelurahan, No. TPS, Segmen, atau Nama untuk hasil lebih spesifik.
          </div>
        )}
      </div>

      {/* MODAL UPLOAD DPT (EXCEL & PDF FORMAT KPU) */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 md:p-8 space-y-5 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="pb-4 border-b border-slate-100">
              <h3 className="text-lg font-extrabold text-slate-900">📥 Upload Arsip DPT KPU Kota Makassar</h3>
              <p className="text-xs text-slate-500 mt-1">
                Mendukung langsung file <b>Excel (.xlsx / .xls)</b> maupun <b>PDF asli KPU (.pdf)</b> format Model A-KabKo. Anda bisa memilih beberapa file kelurahan sekaligus.
              </p>
            </div>

            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 bg-slate-50/70 text-center space-y-2">
              <input
                id="dptFilesInput"
                type="file"
                multiple
                accept=".xlsx,.xls,.csv,.pdf"
                onChange={handleFilesSelected}
                disabled={isParsing || isUploading}
                className="hidden"
              />
              <label
                htmlFor="dptFilesInput"
                className="cursor-pointer inline-flex flex-col items-center gap-2"
              >
                <span className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800">
                  {isParsing ? '⏳ Sedang Membaca Dokumen...' : 'Pilih File Excel / PDF DPT KPU'}
                </span>
                <span className="text-xs text-slate-500">
                  Bisa blok dan pilih banyak file kelurahan sekaligus
                </span>
              </label>
              {parseStatusText && (
                <p className="text-xs font-bold text-indigo-600 pt-2">{parseStatusText}</p>
              )}
            </div>

            {parsedRows.length > 0 && (
              <div className="space-y-3 overflow-hidden flex flex-col flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-2xl text-xs">
                  <div>
                    <span className="font-extrabold text-emerald-800">
                      ✓ Siap diimpor: {parsedRows.length.toLocaleString('id-ID')} Pemilih
                    </span>
                    <span className="text-emerald-700 ml-2">
                      ({new Set(parsedRows.map((r) => r.village_id)).size} Kelurahan terdeteksi)
                    </span>
                  </div>

                  <label className="inline-flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={replaceVillageData}
                      onChange={(e) => setReplaceVillageData(e.target.checked)}
                      className="rounded text-rose-600"
                    />
                    Timpa data lama pada kelurahan yang sama (anti-duplikat)
                  </label>
                </div>

                <div className="overflow-auto border border-slate-200 rounded-2xl max-h-56">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                      <tr>
                        <th className="py-2 px-3">No</th>
                        <th className="py-2 px-3">Nama Pemilih</th>
                        <th className="py-2 px-3">L/P</th>
                        <th className="py-2 px-3">Usia</th>
                        <th className="py-2 px-3">Kelurahan</th>
                        <th className="py-2 px-3">TPS</th>
                        <th className="py-2 px-3">RT/RW</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedRows.slice(0, 15).map((r, i) => (
                        <tr key={i}>
                          <td className="py-1.5 px-3 font-mono text-slate-400">{r.no_urut}</td>
                          <td className="py-1.5 px-3 font-bold text-slate-900">{r.full_name}</td>
                          <td className="py-1.5 px-3">{r.gender}</td>
                          <td className="py-1.5 px-3">{r.age}</td>
                          <td className="py-1.5 px-3">{villageMap[r.village_id]?.name}</td>
                          <td className="py-1.5 px-3 font-bold text-indigo-600">TPS {r.tps_number}</td>
                          <td className="py-1.5 px-3 font-mono">
                            {r.rt}/{r.rw}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {isUploading && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-bold text-indigo-700">
                      <span>Menyimpan ke Database Supabase...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-rose-500 to-indigo-600 h-full transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isUploading}
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
              >
                Tutup
              </button>
              <button
                type="button"
                disabled={isUploading || parsedRows.length === 0}
                onClick={handleSaveParsedDpt}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
              >
                {isUploading
                  ? `Mengunggah (${uploadProgress}%)...`
                  : `Simpan ${parsedRows.length.toLocaleString('id-ID')} Data DPT`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}