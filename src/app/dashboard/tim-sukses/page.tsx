'use client';

import React, { useEffect, useState, useMemo } from 'react';
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

export default function TimSuksesPage() {
  const [activeTab, setActiveTab] = useState<'tim_tps' | 'lo'>('tim_tps');
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

  // Modal Tambah Tim TPS
  const [showTpsModal, setShowTpsModal] = useState<boolean>(false);
  const [tpsNik, setTpsNik] = useState('');
  const [tpsName, setTpsName] = useState('');
  const [tpsWa, setTpsWa] = useState('');
  const [tpsDistrictId, setTpsDistrictId] = useState('');
  const [tpsVillageId, setTpsVillageId] = useState('');
  const [tpsNumber, setTpsNumber] = useState('1');
  const [tpsLoId, setTpsLoId] = useState('');
  const [tpsMetNow, setTpsMetNow] = useState<boolean>(false);
  const [dptLookupMsg, setDptLookupMsg] = useState<string>('');
  const [savingTps, setSavingTps] = useState(false);

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

  // Ringkasan Kandidat vs Resmi Tim (Sudah Bertemu Caleg)
  const summary = useMemo(() => {
    const officialCount = volunteers.filter((v) => v.met_candidate).length;
    const waitingMeetingCount = volunteers.filter((v) => !v.met_candidate).length;
    return { officialCount, waitingMeetingCount };
  }, [volunteers]);

  // Statistik per LO
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

  // Auto-Lookup NIK ke tabel DPT
  const handleLookupDpt = async () => {
    const cleanNik = tpsNik.trim();
    if (cleanNik.length < 6) {
      setDptLookupMsg('Masukkan minimal 6 digit NIK untuk mencari di DPT.');
      return;
    }
    setDptLookupMsg('Mencari di database DPT Makassar...');
    const { data, error } = await supabase
      .from('dpt')
      .select('full_name, district_id, village_id, tps_number')
      .eq('nik', cleanNik)
      .maybeSingle();

    if (error) {
      setDptLookupMsg('Gagal mengecek DPT: ' + error.message);
      return;
    }

    if (data) {
      setTpsName(data.full_name);
      if (data.district_id) setTpsDistrictId(data.district_id);
      if (data.village_id) setTpsVillageId(data.village_id);
      if (data.tps_number) setTpsNumber(String(data.tps_number));
      setDptLookupMsg('✓ Ditemukan di DPT! Nama, Kelurahan & TPS otomatis terisi.');
    } else {
      setDptLookupMsg('NIK belum ada di DPT — silakan lengkapi data secara manual.');
    }
  };

  // Simpan LO Baru
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
      fetchAllData();
    }
  };

  // Simpan Calon / Anggota Tim TPS Baru
  const handleSaveTimTps = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tpsName.trim() || !tpsNik.trim() || !tpsVillageId || !tpsLoId) {
      alert('Pastikan Nama, NIK, Kelurahan, dan LO Penanggung Jawab sudah dipilih.');
      return;
    }
    setSavingTps(true);

    const { data: { session } } = await supabase.auth.getSession();
    const nowIso = new Date().toISOString();

    const { error } = await supabase.from('volunteers').insert({
      full_name: tpsName.trim().toUpperCase(),
      nik: tpsNik.trim().slice(0, 16),
      whatsapp_number: tpsWa.trim(),
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
      setDptLookupMsg('');
      fetchAllData();
    }
  };

  // Pengukuhan Pertemuan Tatap Muka dengan Caleg
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

  // Konfirmasi Verifikasi Rutin Bulan Ini
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

  // Toggle Status Penerimaan Suvenir Rutin
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
              setDptLookupMsg('');
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
            onClick={() => setActiveTab('tim_tps')}
            className={`px-4 py-2 rounded-lg transition ${
              activeTab === 'tim_tps' ? 'bg-rose-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🗳️ Daftar Tim TPS ({volunteers.length})
          </button>
          <button
            onClick={() => setActiveTab('lo')}
            className={`px-4 py-2 rounded-lg transition ${
              activeTab === 'lo' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🧭 Daftar LO ({los.length})
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
            placeholder="Cari nama, NIK, atau kelurahan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 w-full sm:w-56"
          />
        </div>
      </div>

      {/* TAB 1: TABEL TIM TPS */}
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
                      Belum ada data Tim TPS. Klik tombol <b>+ Input Tim TPS</b> di kanan atas untuk menambahkan.
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
                            title="Klik untuk mengukuhkan atau mengubah status pertemuan langsung dengan Caleg"
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

      {/* TAB 2: TABEL DAFTAR LO */}
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {filteredLos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      Belum ada data LO. Klik tombol <b>+ Input LO Baru</b> di kanan atas untuk mendaftarkan LO.
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
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
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

      {/* MODAL INPUT TIM TPS BARU */}
      {showTpsModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSaveTimTps} className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-extrabold text-slate-900">+ Input Calon / Anggota Tim TPS</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">NIK (16 Digit) *</label>
                <div className="flex gap-2">
                  <input
                    required
                    maxLength={16}
                    value={tpsNik}
                    onChange={(e) => setTpsNik(e.target.value.replace(/\D/g, ''))}
                    placeholder="7371xxxxxxxxxxxx"
                    className="flex-1 px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleLookupDpt}
                    className="px-3.5 py-2.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold whitespace-nowrap"
                  >
                    🔍 Cek DPT
                  </button>
                </div>
                {dptLookupMsg && (
                  <p className="text-[11px] font-semibold text-indigo-600 mt-1">{dptLookupMsg}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap *</label>
                  <input
                    required
                    value={tpsName}
                    onChange={(e) => setTpsName(e.target.value)}
                    placeholder="Nama sesuai KTP"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm"
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

              {/* Checkbox Status Pertemuan Langsung dengan Caleg */}
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