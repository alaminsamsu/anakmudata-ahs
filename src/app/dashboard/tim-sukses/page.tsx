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
  level: string;
  district_id: string | null;
  village_id: string | null;
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
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal Tambah LO
  const [showLoModal, setShowLoModal] = useState<boolean>(false);
  const [loName, setLoName] = useState('');
  const [loNik, setLoNik] = useState('');
  const [loWa, setLoWa] = useState('');
  const [loLevel, setLoLevel] = useState<'Kelurahan' | 'Kecamatan'>('Kelurahan');
  const [loDistrictId, setLoDistrictId] = useState('');
  const [loVillageId, setLoVillageId] = useState('');
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
  const [tpsStatus, setTpsStatus] = useState<'approved' | 'pending'>('approved');
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
      if (distRes.data.length > 0) {
        setLoDistrictId(distRes.data[0].id);
        setTpsDistrictId(distRes.data[0].id);
      }
    }
    if (villRes.data) {
      setVillages(villRes.data);
    }
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

  // Hitung jumlah Tim TPS di bawah masing-masing LO
  const tpsCountByLo = useMemo(() => {
    const counts: Record<string, number> = {};
    volunteers.forEach((v) => {
      if (v.lo_id && v.status === 'approved') {
        counts[v.lo_id] = (counts[v.lo_id] || 0) + 1;
      }
    });
    return counts;
  }, [volunteers]);

  // Auto-Lookup NIK ke tabel DPT saat input Tim TPS
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
      setDptLookupMsg('✓ Data ditemukan di DPT! Nama, Kelurahan & TPS otomatis terisi.');
    } else {
      setDptLookupMsg('NIK belum ada di tabel DPT — silakan isi data secara manual.');
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
      level: loLevel,
      district_id: loDistrictId || null,
      village_id: loLevel === 'Kelurahan' ? loVillageId || null : null,
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

  // Simpan Anggota Tim TPS Baru
  const handleSaveTimTps = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tpsName.trim() || !tpsNik.trim() || !tpsVillageId || !tpsLoId) {
      alert('Pastikan Nama, NIK, Kelurahan, dan LO Penanggung Jawab sudah dipilih.');
      return;
    }
    setSavingTps(true);

    const { data: { session } } = await supabase.auth.getSession();

    const { error } = await supabase.from('volunteers').insert({
      full_name: tpsName.trim().toUpperCase(),
      nik: tpsNik.trim().slice(0, 16),
      whatsapp_number: tpsWa.trim(),
      village_id: tpsVillageId,
      tps_number: parseInt(tpsNumber, 10) || 1,
      lo_id: tpsLoId,
      status: tpsStatus,
      verified_by: tpsStatus === 'approved' ? session?.user?.id || null : null,
    });

    setSavingTps(false);
    if (error) {
      alert('Gagal menyimpan Tim TPS: ' + error.message);
    } else {
      setShowTpsModal(false);
      setTpsNik('');
      setTpsName('');
      setTpsWa('');
      setDptLookupMsg('');
      fetchAllData();
    }
  };

  // Filter daftar Tim TPS
  const filteredVolunteers = useMemo(() => {
    return volunteers.filter((v) => {
      const vill = villageMap[v.village_id];
      const matchDist = filterDistrict === 'ALL' || vill?.district_id === filterDistrict;
      const matchLo = filterLo === 'ALL' || v.lo_id === filterLo;
      const q = searchQuery.toLowerCase();
      const matchSearch =
        v.full_name.toLowerCase().includes(q) ||
        v.nik.includes(q) ||
        (vill?.name || '').toLowerCase().includes(q);
      return matchDist && matchLo && matchSearch;
    });
  }, [volunteers, villageMap, filterDistrict, filterLo, searchQuery]);

  // Filter daftar LO
  const filteredLos = useMemo(() => {
    return los.filter((l) => {
      const matchDist = filterDistrict === 'ALL' || l.district_id === filterDistrict;
      const q = searchQuery.toLowerCase();
      const matchSearch =
        l.full_name.toLowerCase().includes(q) ||
        (l.whatsapp_number || '').includes(q);
      return matchDist && matchSearch;
    });
  }, [los, filterDistrict, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header & Tombol Input Admin */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">🤝 Tim Sukses — Struktur LO & Tim TPS</h1>
          <p className="text-sm text-slate-500 mt-1">
            Pengelolaan internal hierarki lapangan Kota Makassar: <b>LO (Koordinator Wilayah)</b> membawahi <b>Tim TPS</b>.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => {
              const defaultVill = villages.find((v) => v.district_id === loDistrictId);
              if (defaultVill) setLoVillageId(defaultVill.id);
              setShowLoModal(true);
            }}
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

      {/* Ringkasan Struktur */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase">Total LO Aktif</span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{los.length} Orang</div>
          <p className="text-xs text-slate-500 mt-1">Koordinator Wilayah Kecamatan / Kelurahan</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase">Total Tim TPS Terdaftar</span>
          <div className="text-2xl font-extrabold text-rose-600 mt-1">{volunteers.length} Orang</div>
          <p className="text-xs text-slate-500 mt-1">Ujung tombak pengawal suara di TPS</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase">Rata-rata Binaan per LO</span>
          <div className="text-2xl font-extrabold text-indigo-600 mt-1">
            {los.length > 0 ? (volunteers.length / los.length).toFixed(1) : '0'} Tim TPS
          </div>
          <p className="text-xs text-slate-500 mt-1">Rasio distribusi tim lapangan</p>
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
            🧭 Daftar LO Wilayah ({los.length})
          </button>
        </div>

        <div className="flex flex-wrap gap-2.5 flex-1 lg:justify-end">
          <select
            value={filterDistrict}
            onChange={(e) => setFilterDistrict(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
          >
            <option value="ALL">Semua Kecamatan</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                KEC. {d.name}
              </option>
            ))}
          </select>

          {activeTab === 'tim_tps' && (
            <select
              value={filterLo}
              onChange={(e) => setFilterLo(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
            >
              <option value="ALL">Semua LO Penanggung Jawab</option>
              {los.map((l) => (
                <option key={l.id} value={l.id}>
                  LO: {l.full_name}
                </option>
              ))}
            </select>
          )}

          <input
            type="text"
            placeholder="Cari nama, NIK, atau kelurahan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 w-full sm:w-64"
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
                  <th className="py-3.5 px-4">NIK</th>
                  <th className="py-3.5 px-4">Wilayah Tugas</th>
                  <th className="py-3.5 px-4 text-center">No. TPS</th>
                  <th className="py-3.5 px-4">LO Penanggung Jawab</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
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
                      Belum ada anggota Tim TPS. Klik tombol <b>+ Input Tim TPS</b> di kanan atas untuk menambahkan.
                    </td>
                  </tr>
                ) : (
                  filteredVolunteers.map((v) => {
                    const vill = villageMap[v.village_id];
                    const distName = vill ? districtMap[vill.district_id] : '-';
                    const lo = v.lo_id ? loMap[v.lo_id] : null;

                    return (
                      <tr key={v.id} className="hover:bg-slate-50/80">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{v.full_name}</div>
                          <div className="text-[11px] text-emerald-600">WA: {v.whatsapp_number}</div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">{v.nik}</td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-800">KEL. {vill?.name || '-'}</div>
                          <div className="text-[11px] text-slate-400">KEC. {distName}</div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 font-extrabold">
                            TPS {String(v.tps_number).padStart(3, '0')}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {lo ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold">
                              🧭 {lo.full_name}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Belum terhubung LO</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              v.status === 'approved'
                                ? 'bg-emerald-50 text-emerald-700'
                                : v.status === 'pending'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {v.status.toUpperCase()}
                          </span>
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
                  <th className="py-3.5 px-4">Tingkat</th>
                  <th className="py-3.5 px-4">Wilayah Koordinasi</th>
                  <th className="py-3.5 px-4">Kontak WhatsApp</th>
                  <th className="py-3.5 px-4 text-center">Jumlah Tim TPS Binaan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {filteredLos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400">
                      Belum ada data LO. Klik tombol <b>+ Input LO Baru</b> untuk mendaftarkan koordinator lapangan.
                    </td>
                  </tr>
                ) : (
                  filteredLos.map((lo) => {
                    const distName = lo.district_id ? districtMap[lo.district_id] : '-';
                    const villName = lo.village_id ? villageMap[lo.village_id]?.name : null;
                    const binaanCount = tpsCountByLo[lo.id] || 0;

                    return (
                      <tr key={lo.id} className="hover:bg-slate-50/80">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{lo.full_name}</div>
                          {lo.nik && <div className="font-mono text-[11px] text-slate-400">NIK: {lo.nik}</div>}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold">
                            LO {lo.level}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-800">KEC. {distName}</div>
                          {villName && <div className="text-[11px] text-slate-500">KEL. {villName}</div>}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-emerald-600">{lo.whatsapp_number}</td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-extrabold">
                            {binaanCount} Tim TPS
                          </span>
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
            <h3 className="text-lg font-extrabold text-slate-900">+ Input LO (Koordinator Wilayah)</h3>
            <p className="text-xs text-slate-500">
              LO bertindak sebagai penanggung jawab lapangan yang membawahi Tim TPS.
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

              <div className="grid grid-cols-2 gap-3">
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
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tingkat Tugas *</label>
                  <select
                    value={loLevel}
                    onChange={(e) => setLoLevel(e.target.value as 'Kelurahan' | 'Kecamatan')}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white"
                  >
                    <option value="Kelurahan">LO Kelurahan</option>
                    <option value="Kecamatan">LO Kecamatan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kecamatan *</label>
                  <select
                    value={loDistrictId}
                    onChange={(e) => {
                      setLoDistrictId(e.target.value);
                      const firstVill = villages.find((v) => v.district_id === e.target.value);
                      if (firstVill) setLoVillageId(firstVill.id);
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
              </div>

              {loLevel === 'Kelurahan' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kelurahan Tugas *</label>
                  <select
                    value={loVillageId}
                    onChange={(e) => setLoVillageId(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white"
                  >
                    {villages
                      .filter((v) => v.district_id === loDistrictId)
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}
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

      {/* MODAL INPUT TIM TPS BARU (DENGAN AUTO-LOOKUP DPT) */}
      {showTpsModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSaveTimTps} className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-extrabold text-slate-900">+ Input Anggota Tim TPS</h3>

            <div className="space-y-3">
              {/* Input NIK + Tombol Lookup DPT */}
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

              {/* Pilih LO Penanggung Jawab */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">LO Penanggung Jawab *</label>
                <select
                  required
                  value={tpsLoId}
                  onChange={(e) => setTpsLoId(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white font-semibold text-indigo-900"
                >
                  {los.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.full_name} ({l.level} — {l.district_id ? districtMap[l.district_id] : ''})
                    </option>
                  ))}
                </select>
              </div>

              {/* Wilayah & Nomor TPS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kecamatan *</label>
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kelurahan *</label>
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

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Status Awal</label>
                <select
                  value={tpsStatus}
                  onChange={(e) => setTpsStatus(e.target.value as 'approved' | 'pending')}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white"
                >
                  <option value="approved">Langsung Sah (Approved)</option>
                  <option value="pending">Menunggu Verifikasi (Pending)</option>
                </select>
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
                {savingTps ? 'Menyimpan...' : 'Simpan Tim TPS'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}