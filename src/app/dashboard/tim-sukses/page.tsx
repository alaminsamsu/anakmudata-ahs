'use client';

import React, { useEffect, useState, useMemo } from 'react';
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

interface FieldLo {
  id: string;
  full_name: string;
  nik: string | null;
  whatsapp_number: string;
  is_active: boolean;
  created_at: string;
}

interface Volunteer {
  id: string;
  village_id: string;
  tps_number: number;
  full_name: string;
  nik: string;
  whatsapp_number: string;
  status: 'pending' | 'approved' | 'rejected';
  lo_id: string | null;
  met_candidate: boolean | null;
  met_candidate_at: string | null;
  last_routine_verified_at: string | null;
  souvenir_received: boolean | null;
  last_souvenir_at: string | null;
  created_at: string;
}

interface DptSearchResult {
  id: string;
  district_id: string;
  village_id: string;
  tps_number: number;
  full_name: string;
  gender: string | null;
  age: number | null;
  rt: string | null;
  rw: string | null;
}

interface ExcelPreviewRow {
  rowNum: number;
  loName: string;
  loWa: string;
  timName: string;
  nik: string;
  timWa: string;
  districtName: string;
  villageName: string;
  villageId: string | null;
  tpsNumber: number;
  metCandidate: boolean;
  isValid: boolean;
  errorReason?: string;
}

function normalizeText(str: string): string {
  return String(str || '')
    .toUpperCase()
    .replace(/^KEC\.?\s*/i, '')
    .replace(/^KEL\.?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function TimSuksesPage() {
  const [activeTab, setActiveTab] = useState<'lo' | 'tim_tps'>('lo');
  const [districts, setDistricts] = useState<District[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [los, setLos] = useState<FieldLo[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filter
  const [filterDistrict, setFilterDistrict] = useState<string>('ALL');
  const [filterLo, setFilterLo] = useState<string>('ALL');
  const [filterMeeting, setFilterMeeting] = useState<'ALL' | 'MET' | 'WAITING'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal Tambah LO
  const [showLoModal, setShowLoModal] = useState<boolean>(false);
  const [loName, setLoName] = useState('');
  const [loNik, setLoNik] = useState('');
  const [loWa, setLoWa] = useState('');
  const [savingLo, setSavingLo] = useState(false);

  // Modal Tambah Tim TPS + Pencarian Langsung ke Database DPT
  const [showTpsModal, setShowTpsModal] = useState<boolean>(false);
  const [dptSearchInput, setDptSearchInput] = useState('');
  const [dptResults, setDptResults] = useState<DptSearchResult[]>([]);
  const [searchingDpt, setSearchingDpt] = useState(false);
  const [selectedDptBadge, setSelectedDptBadge] = useState<string>('');

  const [tpsNik, setTpsNik] = useState('');
  const [tpsName, setTpsName] = useState('');
  const [tpsWa, setTpsWa] = useState('');
  const [tpsDistrictId, setTpsDistrictId] = useState('');
  const [tpsVillageId, setTpsVillageId] = useState('');
  const [tpsNumber, setTpsNumber] = useState('1');
  const [tpsLoId, setTpsLoId] = useState('');
  const [tpsMetNow, setTpsMetNow] = useState<boolean>(false);
  const [savingTps, setSavingTps] = useState(false);

  // Modal Import Excel
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [excelRows, setExcelRows] = useState<ExcelPreviewRow[]>([]);
  const [importFileName, setImportFileName] = useState<string>('');
  const [importingExcel, setImportingExcel] = useState<boolean>(false);

  useEffect(() => {
    fetchAllData();
  }, []);

  async function fetchAllData() {
    setLoading(true);
    const [distRes, villRes, loRes, volRes] = await Promise.all([
      supabase.from('districts').select('id, name').order('name'),
      supabase.from('villages').select('id, district_id, name, total_tps').order('name'),
      supabase.from('field_los').select('*').order('full_name'),
      supabase.from('volunteers').select('*').order('created_at', { ascending: false }),
    ]);

    if (distRes.data) {
      setDistricts(distRes.data);
      if (distRes.data.length > 0 && !tpsDistrictId) {
        setTpsDistrictId(distRes.data[0].id);
      }
    }
    if (villRes.data) setVillages(villRes.data);
    if (loRes.data) setLos(loRes.data as FieldLo[]);
    if (volRes.data) setVolunteers(volRes.data as Volunteer[]);
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

  const loMap = useMemo(() => {
    const m: Record<string, FieldLo> = {};
    los.forEach((l) => (m[l.id] = l));
    return m;
  }, [los]);

  const isVerifiedThisMonth = (dateStr: string | null) => {
    if (!dateStr) return false;
    const diffDays = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 30;
  };

  const summary = useMemo(() => {
    const officialCount = volunteers.filter((v) => v.met_candidate).length;
    const waitingMeetingCount = volunteers.filter((v) => !v.met_candidate).length;
    return { officialCount, waitingMeetingCount };
  }, [volunteers]);

  const loStats = useMemo(() => {
    const stats: Record<
      string,
      {
        officialCount: number;
        waitingCount: number;
        districts: Set<string>;
        villages: Set<string>;
        verifiedCount: number;
        souvenirCount: number;
      }
    > = {};

    los.forEach((l) => {
      stats[l.id] = {
        officialCount: 0,
        waitingCount: 0,
        districts: new Set(),
        villages: new Set(),
        verifiedCount: 0,
        souvenirCount: 0,
      };
    });

    volunteers.forEach((v) => {
      if (v.lo_id && stats[v.lo_id]) {
        if (v.met_candidate) {
          stats[v.lo_id].officialCount += 1;
          if (isVerifiedThisMonth(v.last_routine_verified_at)) stats[v.lo_id].verifiedCount += 1;
          if (v.souvenir_received) stats[v.lo_id].souvenirCount += 1;

          const vill = villageMap[v.village_id];
          if (vill) {
            stats[v.lo_id].villages.add(vill.name);
            if (vill.district_id && districtMap[vill.district_id]) {
              stats[v.lo_id].districts.add(districtMap[vill.district_id]);
            }
          }
        } else {
          stats[v.lo_id].waitingCount += 1;
        }
      }
    });

    return stats;
  }, [los, volunteers, villageMap, districtMap]);

  // Pencarian Nama Pemilih ke Tabel DPT Makassar (Model A-KabKo)
  const handleSearchDptByName = async (queryText?: string) => {
    const q = (queryText !== undefined ? queryText : dptSearchInput).trim();
    if (q.length < 3) {
      setDptResults([]);
      return;
    }

    setSearchingDpt(true);
    let query = supabase
      .from('dpt')
      .select('id, district_id, village_id, tps_number, full_name, gender, age, rt, rw')
      .ilike('full_name', `%${q}%`)
      .limit(12);

    const { data, error } = await query;
    setSearchingDpt(false);

    if (!error && data) {
      setDptResults(data as DptSearchResult[]);
    }
  };

  // Saat Pemilih DPT Dipilih -> Isi Otomatis Nama, Kecamatan, Kelurahan & Nomor TPS
  const handleSelectDptPerson = (person: DptSearchResult) => {
    setTpsName(person.full_name);
    if (person.district_id) setTpsDistrictId(person.district_id);
    if (person.village_id) setTpsVillageId(person.village_id);
    if (person.tps_number) setTpsNumber(String(person.tps_number));

    const villName = villageMap[person.village_id]?.name || '';
    const distName = districtMap[person.district_id] || '';
    setSelectedDptBadge(
      `✓ Terverifikasi DPT: ${person.full_name} (${person.gender || '-'}, ${person.age || '-'} Thn) · KEL. ${villName}, KEC. ${distName} · TPS ${String(person.tps_number).padStart(3, '0')} (RT ${person.rt || '000'}/RW ${person.rw || '000'})`
    );
    setDptResults([]);
  };

  // Download Template Excel Standar
  const handleDownloadTemplate = () => {
    const sampleData = [
      {
        NAMA_LO: 'AHMAD SYARIF',
        WA_LO: '081234567890',
        NAMA_TIM_TPS: 'BUDI SANTOSO',
        NIK: '7371130101900001',
        WA_TIM_TPS: '085211223344',
        KECAMATAN: 'RAPPOCINI',
        KELURAHAN: 'MINASA UPA',
        NO_TPS: 1,
        SUDAH_BERTEMU_CALEG: 'YA',
      },
      {
        NAMA_LO: 'AHMAD SYARIF',
        WA_LO: '081234567890',
        NAMA_TIM_TPS: 'SITI AMINAH',
        NIK: '7371140505920002',
        WA_TIM_TPS: '082199887766',
        KECAMATAN: 'TAMALATE',
        KELURAHAN: 'PARANG TAMBUNG',
        NO_TPS: 4,
        SUDAH_BERTEMU_CALEG: 'TIDAK',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    worksheet['!cols'] = [
      { wch: 22 },
      { wch: 16 },
      { wch: 24 },
      { wch: 20 },
      { wch: 16 },
      { wch: 18 },
      { wch: 20 },
      { wch: 10 },
      { wch: 22 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template_Tim_Sukses');
    XLSX.writeFile(workbook, 'Template_Import_LO_TimTPS_ANAKMUDATA.xlsx');
  };

  // Baca & Validasi File Excel
  const handleExcelFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const binaryStr = evt.target?.result;
      const workbook = XLSX.read(binaryStr, { type: 'binary' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawJson: Record<string, any>[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

      const parsed: ExcelPreviewRow[] = rawJson.map((row, index) => {
        const loName = normalizeText(row.NAMA_LO || row['NAMA LO'] || row.LO || '');
        const loWa = String(row.WA_LO || row['WA LO'] || row['NO WA LO'] || '').trim();
        const timName = normalizeText(
          row.NAMA_TIM_TPS || row['NAMA TIM TPS'] || row.NAMA || row['NAMA LENGKAP'] || ''
        );
        const nik = String(row.NIK || '').replace(/\D/g, '').trim();
        const timWa = String(
          row.WA_TIM_TPS || row['WA TIM TPS'] || row.WA || row['NO WA'] || row.WHATSAPP || ''
        ).trim();
        const districtName = normalizeText(row.KECAMATAN || '');
        const villageName = normalizeText(row.KELURAHAN || '');
        const tpsNumber =
          parseInt(String(row.NO_TPS || row['NO TPS'] || row.TPS || '1').replace(/\D/g, ''), 10) || 1;
        const metRaw = normalizeText(
          row.SUDAH_BERTEMU_CALEG || row['SUDAH BERTEMU CALEG'] || row.PERTEMUAN || row.STATUS || ''
        );
        const metCandidate = ['YA', 'YES', 'SUDAH', 'RESMI', '1', 'TRUE'].includes(metRaw);

        let matchedVillage: Village | undefined;
        if (districtName) {
          const matchedDist = districts.find((d) => normalizeText(d.name) === districtName);
          if (matchedDist) {
            matchedVillage = villages.find(
              (v) => v.district_id === matchedDist.id && normalizeText(v.name) === villageName
            );
          }
        }
        if (!matchedVillage) {
          matchedVillage = villages.find((v) => normalizeText(v.name) === villageName);
        }

        let isValid = true;
        let errorReason = '';

        if (!loName) {
          isValid = false;
          errorReason = 'Nama LO kosong';
        } else if (!timName) {
          isValid = false;
          errorReason = 'Nama Tim TPS kosong';
        } else if (!matchedVillage) {
          isValid = false;
          errorReason = `Kelurahan "${villageName || '-'}" tidak ditemukan`;
        }

        // Jika NIK di Excel kosong, buatkan kode unik berbasis nama+TPS agar tidak gagal insert
        const safeNik =
          nik.length >= 10
            ? nik.slice(0, 16)
            : `DPT-${matchedVillage?.id.slice(0, 6) || 'MKS'}-${tpsNumber}-${index + 1}`.slice(0, 16);

        return {
          rowNum: index + 2,
          loName,
          loWa,
          timName,
          nik: safeNik,
          timWa,
          districtName,
          villageName,
          villageId: matchedVillage?.id || null,
          tpsNumber,
          metCandidate,
          isValid,
          errorReason,
        };
      });

      setExcelRows(parsed);
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmExcelImport = async () => {
    const validRows = excelRows.filter((r) => r.isValid && r.villageId);
    if (validRows.length === 0) {
      alert('Tidak ada baris data yang valid untuk disimpan.');
      return;
    }

    setImportingExcel(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const nowIso = new Date().toISOString();

      const existingLoMap: Record<string, string> = {};
      los.forEach((l) => {
        existingLoMap[normalizeText(l.full_name)] = l.id;
      });

      const uniqueNewLos = new Map<string, string>();
      validRows.forEach((r) => {
        if (!existingLoMap[r.loName] && !uniqueNewLos.has(r.loName)) {
          uniqueNewLos.set(r.loName, r.loWa || '-');
        }
      });

      if (uniqueNewLos.size > 0) {
        const newLoPayloads = Array.from(uniqueNewLos.entries()).map(([name, wa]) => ({
          full_name: name,
          whatsapp_number: wa,
          level: 'Lintas Wilayah',
          district_id: null,
          village_id: null,
        }));

        const { data: insertedLos, error: loInsertErr } = await supabase
          .from('field_los')
          .insert(newLoPayloads)
          .select('id, full_name');

        if (loInsertErr) throw loInsertErr;
        insertedLos?.forEach((l) => {
          existingLoMap[normalizeText(l.full_name)] = l.id;
        });
      }

      const existingNikMap: Record<string, string> = {};
      volunteers.forEach((v) => {
        if (v.nik) existingNikMap[v.nik] = v.id;
      });

      const toInsert: any[] = [];
      const toUpdate: { id: string; payload: any }[] = [];

      validRows.forEach((r) => {
        const loId = existingLoMap[r.loName] || null;
        const payload = {
          full_name: r.timName,
          nik: r.nik,
          whatsapp_number: r.timWa || '-',
          village_id: r.villageId,
          tps_number: r.tpsNumber,
          lo_id: loId,
          met_candidate: r.metCandidate,
          met_candidate_at: r.metCandidate ? nowIso : null,
          status: r.metCandidate ? 'approved' : 'pending',
          verified_by: r.metCandidate ? session?.user?.id || null : null,
          last_routine_verified_at: r.metCandidate ? nowIso : null,
        };

        if (existingNikMap[r.nik]) {
          toUpdate.push({ id: existingNikMap[r.nik], payload });
        } else {
          toInsert.push({ ...payload, souvenir_received: false });
          existingNikMap[r.nik] = 'QUEUED';
        }
      });

      if (toInsert.length > 0) {
        const { error: insErr } = await supabase.from('volunteers').insert(toInsert);
        if (insErr) throw insErr;
      }

      for (const item of toUpdate) {
        await supabase.from('volunteers').update(item.payload).eq('id', item.id);
      }

      alert(
        `Berhasil mengimpor ${toInsert.length} data baru dan memperbarui ${toUpdate.length} data lama!`
      );
      setShowImportModal(false);
      setExcelRows([]);
      setImportFileName('');
      fetchAllData();
    } catch (err: any) {
      alert('Terjadi kesalahan saat menyimpan data Excel: ' + (err?.message || err));
    } finally {
      setImportingExcel(false);
    }
  };

  const handleSaveLo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loName.trim() || !loWa.trim()) return;
    setSavingLo(true);

    const { error } = await supabase.from('field_los').insert({
      full_name: loName.trim().toUpperCase(),
      nik: loNik.trim() || null,
      whatsapp_number: loWa.trim(),
      level: 'Lintas Wilayah',
      district_id: null,
      village_id: null,
    });

    setSavingLo(false);
    if (error) {
      alert('Gagal menyimpan LO: ' + error.message);
    } else {
      setShowLoModal(false);
      setLoName('');
      setLoNik('');
      setLoWa('');
      setActiveTab('lo');
      fetchAllData();
    }
  };

  const handleSaveTimTps = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tpsName.trim() || !tpsVillageId || !tpsLoId) {
      alert('Pastikan Nama Lengkap, Kelurahan, dan LO Penanggung Jawab sudah diisi.');
      return;
    }
    setSavingTps(true);

    const { data: { session } } = await supabase.auth.getSession();
    const nowIso = new Date().toISOString();

    // Jika NIK tidak diisi manual (karena dari DPT KPU), buatkan ID unik
    const finalNik =
      tpsNik.trim().length >= 6
        ? tpsNik.trim().slice(0, 16)
        : `DPT-${Date.now().toString().slice(-10)}`.slice(0, 16);

    const { error } = await supabase.from('volunteers').insert({
      full_name: tpsName.trim().toUpperCase(),
      nik: finalNik,
      whatsapp_number: tpsWa.trim() || '-',
      village_id: tpsVillageId,
      tps_number: parseInt(tpsNumber, 10) || 1,
      lo_id: tpsLoId,
      met_candidate: tpsMetNow,
      met_candidate_at: tpsMetNow ? nowIso : null,
      status: tpsMetNow ? 'approved' : 'pending',
      verified_by: tpsMetNow ? session?.user?.id || null : null,
      last_routine_verified_at: tpsMetNow ? nowIso : null,
      souvenir_received: false,
    });

    setSavingTps(false);
    if (error) {
      alert('Gagal menyimpan Tim TPS: ' + error.message);
    } else {
      setShowTpsModal(false);
      setTpsNik('');
      setTpsName('');
      setTpsWa('');
      setTpsMetNow(false);
      setDptSearchInput('');
      setDptResults([]);
      setSelectedDptBadge('');
      setActiveTab('tim_tps');
      fetchAllData();
    }
  };

  const handleConfirmMeeting = async (vol: Volunteer) => {
    const nextMet = !vol.met_candidate;
    const nowIso = nextMet ? new Date().toISOString() : null;
    const { data: { session } } = await supabase.auth.getSession();

    const { error } = await supabase
      .from('volunteers')
      .update({
        met_candidate: nextMet,
        met_candidate_at: nowIso,
        status: nextMet ? 'approved' : 'pending',
        verified_by: nextMet ? session?.user?.id || null : null,
        last_routine_verified_at: nextMet ? nowIso : null,
      })
      .eq('id', vol.id);

    if (!error) {
      setVolunteers((prev) =>
        prev.map((item) =>
          item.id === vol.id
            ? {
                ...item,
                met_candidate: nextMet,
                met_candidate_at: nowIso,
                status: nextMet ? 'approved' : 'pending',
                last_routine_verified_at: nextMet ? nowIso : null,
              }
            : item
        )
      );
    }
  };

  const handleRoutineVerify = async (vol: Volunteer) => {
    if (!vol.met_candidate) {
      alert('Sahkan pertemuan dengan Caleg terlebih dahulu sebelum melakukan cek rutin.');
      return;
    }
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from('volunteers')
      .update({ last_routine_verified_at: nowIso })
      .eq('id', vol.id);

    if (!error) {
      setVolunteers((prev) =>
        prev.map((item) => (item.id === vol.id ? { ...item, last_routine_verified_at: nowIso } : item))
      );
    }
  };

  const handleToggleSouvenir = async (vol: Volunteer) => {
    if (!vol.met_candidate) {
      alert('Sahkan pertemuan dengan Caleg terlebih dahulu sebelum pembagian suvenir tim.');
      return;
    }
    const nextState = !vol.souvenir_received;
    const nowIso = nextState ? new Date().toISOString() : null;
    const { error } = await supabase
      .from('volunteers')
      .update({ souvenir_received: nextState, last_souvenir_at: nowIso })
      .eq('id', vol.id);

    if (!error) {
      setVolunteers((prev) =>
        prev.map((item) =>
          item.id === vol.id ? { ...item, souvenir_received: nextState, last_souvenir_at: nowIso } : item
        )
      );
    }
  };

  const filteredVolunteers = useMemo(() => {
    return volunteers.filter((v) => {
      const vill = villageMap[v.village_id];
      const matchDist = filterDistrict === 'ALL' || vill?.district_id === filterDistrict;
      const matchLo = filterLo === 'ALL' || v.lo_id === filterLo;
      const matchMeeting =
        filterMeeting === 'ALL' ||
        (filterMeeting === 'MET' && Boolean(v.met_candidate)) ||
        (filterMeeting === 'WAITING' && !v.met_candidate);

      const q = searchQuery.toLowerCase();
      const matchSearch =
        v.full_name.toLowerCase().includes(q) ||
        v.nik.includes(q) ||
        (vill?.name || '').toLowerCase().includes(q);
      return matchDist && matchLo && matchMeeting && matchSearch;
    });
  }, [volunteers, villageMap, filterDistrict, filterLo, filterMeeting, searchQuery]);

  const filteredLos = useMemo(() => {
    return los.filter((l) => {
      const q = searchQuery.toLowerCase();
      return l.full_name.toLowerCase().includes(q) || (l.whatsapp_number || '').includes(q);
    });
  }, [los, searchQuery]);

  const validExcelCount = excelRows.filter((r) => r.isValid).length;
  const invalidExcelCount = excelRows.filter((r) => !r.isValid).length;

  return (
    <div className="space-y-6">
      {/* Header & Tombol Input Admin */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">🤝 Tim Sukses — Struktur LO & Tim TPS</h1>
          <p className="text-sm text-slate-500 mt-1">
            Alur pengukuhan: <b>LO Merekrut</b> → <b>Pertemuan Langsung dengan Caleg</b> → <b>Resmi Masuk Tim TPS</b>.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => {
              setExcelRows([]);
              setImportFileName('');
              setShowImportModal(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-xs flex items-center gap-1.5"
          >
            📥 Import Excel
          </button>
          <button
            onClick={() => setShowLoModal(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 shadow-xs"
          >
            + Input LO Baru
          </button>
          <button
            onClick={() => {
              if (los.length === 0) {
                alert('Silakan input minimal 1 data LO terlebih dahulu sebelum menambahkan Tim TPS.');
                return;
              }
              const defaultVill = villages.find((v) => v.district_id === tpsDistrictId);
              if (defaultVill) setTpsVillageId(defaultVill.id);
              if (los.length > 0 && !tpsLoId) setTpsLoId(los[0].id);
              setDptSearchInput('');
              setDptResults([]);
              setSelectedDptBadge('');
              setShowTpsModal(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 via-pink-500 to-indigo-600 text-white text-xs font-bold hover:opacity-95 shadow-md shadow-rose-500/20"
          >
            + Input Tim TPS
          </button>
        </div>
      </div>

      {/* Ringkasan 3 Status Jaringan */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase">Total LO Aktif</span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{los.length} Orang</div>
          <p className="text-xs text-slate-500 mt-1">Koordinator Lapangan Lintas Wilayah</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-bold text-emerald-600 uppercase">Resmi Tim TPS (Sudah Bertemu Caleg)</span>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1">{summary.officialCount} Orang</div>
          <p className="text-xs text-slate-500 mt-1">Telah dikukuhkan tatap muka langsung</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-bold text-amber-600 uppercase">Antrean Pertemuan Caleg</span>
          <div className="text-2xl font-extrabold text-amber-600 mt-1">{summary.waitingMeetingCount} Orang</div>
          <p className="text-xs text-slate-500 mt-1">Sudah direkrut LO, menunggu jadwal bertemu</p>
        </div>
      </div>

      {/* Tab Navigasi Struktur + Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-bold self-start">
          <button
            onClick={() => setActiveTab('lo')}
            className={`px-4 py-2 rounded-lg transition ${
              activeTab === 'lo' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🧭 Daftar LO ({los.length})
          </button>
          <button
            onClick={() => setActiveTab('tim_tps')}
            className={`px-4 py-2 rounded-lg transition ${
              activeTab === 'tim_tps' ? 'bg-rose-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🗳️ Daftar Tim TPS ({volunteers.length})
          </button>
        </div>

        <div className="flex flex-wrap gap-2.5 flex-1 lg:justify-end">
          {activeTab === 'tim_tps' && (
            <>
              <select
                value={filterMeeting}
                onChange={(e) => setFilterMeeting(e.target.value as 'ALL' | 'MET' | 'WAITING')}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="ALL">Semua Status Pertemuan</option>
                <option value="MET">🤝 Resmi Tim (Sudah Bertemu)</option>
                <option value="WAITING">⏳ Menunggu Pertemuan Caleg</option>
              </select>

              <select
                value={filterDistrict}
                onChange={(e) => setFilterDistrict(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="ALL">Semua Kecamatan TPS</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    KEC. {d.name}
                  </option>
                ))}
              </select>

              <select
                value={filterLo}
                onChange={(e) => setFilterLo(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="ALL">Semua LO Perekrut</option>
                {los.map((l) => (
                  <option key={l.id} value={l.id}>
                    LO: {l.full_name}
                  </option>
                ))}
              </select>
            </>
          )}

          <input
            type="text"
            placeholder={activeTab === 'lo' ? 'Cari nama LO atau WA...' : 'Cari nama, NIK, atau kelurahan...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 w-full sm:w-56"
          />
        </div>
      </div>

      {/* TAB 1: TABEL DAFTAR LO */}
      {activeTab === 'lo' && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4">Nama LO</th>
                  <th className="py-3.5 px-4">Kontak WhatsApp</th>
                  <th className="py-3.5 px-4">Jangkauan Sebaran Tim</th>
                  <th className="py-3.5 px-4 text-center">Resmi Tim TPS</th>
                  <th className="py-3.5 px-4 text-center">Antrean Bertemu Caleg</th>
                  <th className="py-3.5 px-4 text-center">Cek Rutin / Suvenir</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Memuat data LO...
                    </td>
                  </tr>
                ) : filteredLos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      Belum ada data LO. Klik <b>📥 Import Excel</b> atau <b>+ Input LO Baru</b> di kanan atas.
                    </td>
                  </tr>
                ) : (
                  filteredLos.map((lo) => {
                    const st = loStats[lo.id] || {
                      officialCount: 0,
                      waitingCount: 0,
                      districts: new Set(),
                      villages: new Set(),
                      verifiedCount: 0,
                      souvenirCount: 0,
                    };
                    const distList = Array.from(st.districts);

                    return (
                      <tr key={lo.id} className="hover:bg-slate-50/80">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{lo.full_name}</div>
                          {lo.nik && <div className="font-mono text-[11px] text-slate-400">NIK: {lo.nik}</div>}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-emerald-600">{lo.whatsapp_number}</td>
                        <td className="py-3.5 px-4">
                          {distList.length > 0 ? (
                            <div>
                              <span className="font-bold text-slate-800">
                                {distList.length} Kecamatan · {st.villages.size} Kelurahan
                              </span>
                              <div className="text-[11px] text-slate-400 truncate max-w-xs">
                                {distList.join(', ')}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Belum ada tim resmi</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-extrabold">
                            🤝 {st.officialCount} Resmi
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-bold">
                            ⏳ {st.waitingCount} Antrean
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-600">
                          ✓ {st.verifiedCount}/{st.officialCount} · 🎁 {st.souvenirCount}/{st.officialCount}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => {
                              setFilterLo(lo.id);
                              setActiveTab('tim_tps');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] transition"
                          >
                            Lihat Tim TPS →
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: TABEL TIM TPS */}
      {activeTab === 'tim_tps' && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4">Anggota Tim TPS</th>
                  <th className="py-3.5 px-4">Lokasi TPS</th>
                  <th className="py-3.5 px-4">LO Perekrut</th>
                  <th className="py-3.5 px-4 text-center">Pertemuan Caleg (Pengukuhan)</th>
                  <th className="py-3.5 px-4 text-center">Verifikasi Rutin LO</th>
                  <th className="py-3.5 px-4 text-center">Suvenir Rutin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Memuat data Tim TPS...
                    </td>
                  </tr>
                ) : filteredVolunteers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      Belum ada anggota Tim TPS pada filter ini. Klik <b>📥 Import Excel</b> atau <b>+ Input Tim TPS</b>.
                    </td>
                  </tr>
                ) : (
                  filteredVolunteers.map((v) => {
                    const vill = villageMap[v.village_id];
                    const distName = vill ? districtMap[vill.district_id] : '-';
                    const lo = v.lo_id ? loMap[v.lo_id] : null;
                    const verifiedOk = isVerifiedThisMonth(v.last_routine_verified_at);
                    const isOfficial = Boolean(v.met_candidate);

                    return (
                      <tr key={v.id} className="hover:bg-slate-50/80">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{v.full_name}</div>
                          <div className="font-mono text-[11px] text-slate-400">
                            {v.nik} · <span className="text-emerald-600 font-sans">{v.whatsapp_number}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800">
                            KEL. {vill?.name || '-'}{' '}
                            <span className="ml-1 px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-extrabold">
                              TPS {String(v.tps_number).padStart(3, '0')}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400">KEC. {distName}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          {lo ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold">
                              🧭 {lo.full_name}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => handleConfirmMeeting(v)}
                            className={`px-3 py-1 rounded-full text-[11px] font-bold transition ${
                              isOfficial
                                ? 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700'
                                : 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200'
                            }`}
                          >
                            {isOfficial ? '🤝 Resmi Tim (Sudah Bertemu)' : '⏳ Belum Bertemu Caleg'}
                          </button>
                          {isOfficial && v.met_candidate_at && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {new Date(v.met_candidate_at).toLocaleDateString('id-ID')}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {isOfficial ? (
                            <button
                              onClick={() => handleRoutineVerify(v)}
                              className={`px-3 py-1 rounded-full text-[11px] font-bold transition ${
                                verifiedOk
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                              }`}
                            >
                              {verifiedOk ? '✓ Tercek Aktif' : '⏳ Klik Konfirmasi Cek'}
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-300 italic">Menunggu Pengukuhan</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {isOfficial ? (
                            <button
                              onClick={() => handleToggleSouvenir(v)}
                              className={`px-3 py-1 rounded-full text-[11px] font-bold transition ${
                                v.souvenir_received
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {v.souvenir_received ? '🎁 Sudah Terima' : 'Belum Terima'}
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-300 italic">-</span>
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
      )}

      {/* MODAL IMPORT EXCEL MASAL */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 md:p-8 space-y-5 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">📥 Import Excel Data LO & Tim TPS</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Unggah file Excel (.xlsx / .xls / .csv). Sistem otomatis membuatkan LO baru & mencocokkan kelurahan Makassar.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="px-4 py-2 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold self-start sm:self-auto"
              >
                📄 Download Template Excel
              </button>
            </div>

            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-5 bg-slate-50/70 text-center">
              <input
                id="excelFileInput"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleExcelFileUpload}
                className="hidden"
              />
              <label
                htmlFor="excelFileInput"
                className="cursor-pointer inline-flex flex-col items-center gap-1.5"
              >
                <span className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800">
                  Pilih File Excel dari Komputer
                </span>
                <span className="text-xs text-slate-500">
                  {importFileName ? `File dipilih: ${importFileName}` : 'Format didukung: .xlsx, .xls, atau .csv'}
                </span>
              </label>
            </div>

            {excelRows.length > 0 && (
              <div className="flex-1 overflow-hidden flex flex-col space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700">
                      ✓ {validExcelCount} Baris Valid Siap Masuk
                    </span>
                    {invalidExcelCount > 0 && (
                      <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-700">
                        ✕ {invalidExcelCount} Baris Perlu Perbaikan
                      </span>
                    )}
                  </div>
                  <span className="text-slate-400">Total terbaca: {excelRows.length} baris</span>
                </div>

                <div className="overflow-auto border border-slate-200 rounded-2xl flex-1">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                      <tr>
                        <th className="py-2.5 px-3">Baris</th>
                        <th className="py-2.5 px-3">LO Perekrut</th>
                        <th className="py-2.5 px-3">Nama Tim TPS</th>
                        <th className="py-2.5 px-3">NIK / ID</th>
                        <th className="py-2.5 px-3">Kelurahan / TPS</th>
                        <th className="py-2.5 px-3">Bertemu Caleg</th>
                        <th className="py-2.5 px-3">Status Validasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {excelRows.map((r) => (
                        <tr key={r.rowNum} className={r.isValid ? 'bg-white' : 'bg-rose-50/60'}>
                          <td className="py-2 px-3 font-mono text-slate-400">{r.rowNum}</td>
                          <td className="py-2 px-3 font-bold text-indigo-700">{r.loName || '-'}</td>
                          <td className="py-2 px-3 font-bold text-slate-900">{r.timName || '-'}</td>
                          <td className="py-2 px-3 font-mono text-slate-600">{r.nik || '-'}</td>
                          <td className="py-2 px-3">
                            {r.villageName} (TPS {r.tpsNumber})
                          </td>
                          <td className="py-2 px-3">
                            {r.metCandidate ? (
                              <span className="text-emerald-700 font-bold">🤝 YA</span>
                            ) : (
                              <span className="text-amber-700 font-semibold">⏳ TIDAK</span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {r.isValid ? (
                              <span className="text-emerald-600 font-bold">✓ Valid</span>
                            ) : (
                              <span className="text-rose-600 font-bold">{r.errorReason}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
              >
                Tutup
              </button>
              <button
                type="button"
                disabled={importingExcel || validExcelCount === 0}
                onClick={handleConfirmExcelImport}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
              >
                {importingExcel
                  ? 'Mengimpor ke Database...'
                  : `Simpan ${validExcelCount} Data Valid ke Database`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INPUT LO BARU */}
      {showLoModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSaveLo} className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-extrabold text-slate-900">+ Input LO Baru</h3>
            <p className="text-xs text-slate-500">
              LO bergerak lintas kelurahan dan kecamatan se-Kota Makassar untuk merekrut & membina Tim TPS.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap LO *</label>
                <input
                  required
                  value={loName}
                  onChange={(e) => setLoName(e.target.value)}
                  placeholder="Nama lengkap sesuai KTP"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">No. WhatsApp *</label>
                <input
                  required
                  value={loWa}
                  onChange={(e) => setLoWa(e.target.value)}
                  placeholder="0812xxxxxxxx"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">NIK (Opsional)</label>
                <input
                  maxLength={16}
                  value={loNik}
                  onChange={(e) => setLoNik(e.target.value.replace(/\D/g, ''))}
                  placeholder="16 digit NIK"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setShowLoModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={savingLo}
                className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
              >
                {savingLo ? 'Menyimpan...' : 'Simpan Data LO'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL INPUT TIM TPS BARU (TERHUBUNG LANGSUNG KE DATABASE DPT MAKASSAR) */}
      {showTpsModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleSaveTimTps}
            className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl max-h-[92vh] overflow-y-auto"
          >
            <h3 className="text-lg font-extrabold text-slate-900">+ Input Calon / Anggota Tim TPS</h3>

            <div className="space-y-3.5">
              {/* KOTAK PENCARIAN OTOMATIS KE DATABASE DPT MAKASSAR */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-2">
                <label className="block text-xs font-extrabold text-indigo-900">
                  🔍 Cari & Ambil Data dari Database DPT Makassar
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={dptSearchInput}
                    onChange={(e) => {
                      setDptSearchInput(e.target.value);
                      handleSearchDptByName(e.target.value);
                    }}
                    placeholder="Ketik nama warga sesuai DPT (min. 3 huruf)..."
                    className="flex-1 px-3.5 py-2 border border-indigo-200 rounded-xl text-xs bg-white font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => handleSearchDptByName()}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold whitespace-nowrap"
                  >
                    {searchingDpt ? 'Mencari...' : 'Cari DPT'}
                  </button>
                </div>

                {/* Daftar Hasil Pencarian DPT */}
                {dptResults.length > 0 && (
                  <div className="bg-white border border-indigo-200 rounded-xl max-h-44 overflow-y-auto divide-y divide-slate-100 shadow-sm">
                    {dptResults.map((person) => {
                      const vName = villageMap[person.village_id]?.name || '-';
                      const dName = districtMap[person.district_id] || '-';
                      return (
                        <button
                          key={person.id}
                          type="button"
                          onClick={() => handleSelectDptPerson(person)}
                          className="w-full px-3 py-2 text-left hover:bg-indigo-50 flex items-center justify-between gap-2 transition"
                        >
                          <div>
                            <div className="text-xs font-extrabold text-slate-900">
                              {person.full_name}{' '}
                              <span className="text-[10px] font-semibold text-slate-500">
                                ({person.gender || '-'}, {person.age || '-'} Thn)
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500">
                              KEL. {vName}, KEC. {dName} · RT {person.rt || '000'}/RW {person.rw || '000'}
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-extrabold text-[10px] shrink-0">
                            TPS {String(person.tps_number).padStart(3, '0')} →
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedDptBadge && (
                  <div className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl">
                    {selectedDptBadge}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap *</label>
                  <input
                    required
                    value={tpsName}
                    onChange={(e) => setTpsName(e.target.value)}
                    placeholder="Otomatis dari DPT atau ketik manual"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">No. WhatsApp *</label>
                  <input
                    required
                    value={tpsWa}
                    onChange={(e) => setTpsWa(e.target.value)}
                    placeholder="0812xxxxxxxx"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  NIK (Opsional — isi jika ada KTP)
                </label>
                <input
                  maxLength={16}
                  value={tpsNik}
                  onChange={(e) => setTpsNik(e.target.value.replace(/\D/g, ''))}
                  placeholder="7371xxxxxxxxxxxx (boleh dikosongkan)"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">LO Perekrut / Penanggung Jawab *</label>
                <select
                  required
                  value={tpsLoId}
                  onChange={(e) => setTpsLoId(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white font-semibold text-indigo-900"
                >
                  {los.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.full_name} ({l.whatsapp_number})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kecamatan TPS *</label>
                  <select
                    value={tpsDistrictId}
                    onChange={(e) => {
                      setTpsDistrictId(e.target.value);
                      const firstVill = villages.find((v) => v.district_id === e.target.value);
                      if (firstVill) setTpsVillageId(firstVill.id);
                    }}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white"
                  >
                    {districts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kelurahan TPS *</label>
                  <select
                    value={tpsVillageId}
                    onChange={(e) => setTpsVillageId(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white"
                  >
                    {villages
                      .filter((v) => v.district_id === tpsDistrictId)
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nomor TPS *</label>
                  <input
                    required
                    type="number"
                    min={1}
                    value={tpsNumber}
                    onChange={(e) => setTpsNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-start gap-3">
                <input
                  id="metCandidateCheck"
                  type="checkbox"
                  checked={tpsMetNow}
                  onChange={(e) => setTpsMetNow(e.target.checked)}
                  className="mt-1 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="metCandidateCheck" className="text-xs text-slate-700 cursor-pointer">
                  <span className="font-bold text-emerald-900 block">
                    Sudah Bertemu Langsung dengan Caleg (Langsung Resmi Masuk Tim)
                  </span>
                  <span className="text-slate-500">
                    Biarkan tidak dicentang jika orang ini baru didaftarkan LO dan masih menunggu jadwal pertemuan tatap muka.
                  </span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setShowTpsModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={savingTps}
                className="px-5 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700"
              >
                {savingTps ? 'Menyimpan...' : 'Simpan Data'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}