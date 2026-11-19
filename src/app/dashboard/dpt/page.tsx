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

interface DptRecord {
  id: string;
  nik: string;
  full_name: string;
  gender: string | null;
  age: number | null;
  address: string | null;
  rt: string | null;
  rw: string | null;
  district_id: string | null;
  village_id: string | null;
  tps_number: number;
}

export default function DptPage() {
  const [districts, setDistricts] = useState<District[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [records, setRecords] = useState<DptRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Filter & Search
  const [selectedDistrict, setSelectedDistrict] = useState<string>('ALL');
  const [selectedVillage, setSelectedVillage] = useState<string>('ALL');
  const [tpsFilter, setTpsFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Modal Import CSV
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importVillageId, setImportVillageId] = useState<string>('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState<boolean>(false);
  const [importStatus, setImportStatus] = useState<string>('');

  // Modal Tambah Manual
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [formNik, setFormNik] = useState('');
  const [formName, setFormName] = useState('');
  const [formGender, setFormGender] = useState('L');
  const [formAge, setFormAge] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formRt, setFormRt] = useState('');
  const [formRw, setFormRw] = useState('');
  const [formVillageId, setFormVillageId] = useState('');
  const [formTps, setFormTps] = useState('1');
  const [savingManual, setSavingManual] = useState(false);

  useEffect(() => {
    loadWilayah();
  }, []);

  useEffect(() => {
    fetchDptRecords();
  }, [selectedDistrict, selectedVillage, tpsFilter, searchQuery]);

  async function loadWilayah() {
    const [distRes, villRes] = await Promise.all([
      supabase.from('districts').select('id, name').order('name'),
      supabase.from('villages').select('id, district_id, name, total_tps').order('name'),
    ]);
    if (distRes.data) setDistricts(distRes.data);
    if (villRes.data) {
      setVillages(villRes.data);
      if (villRes.data.length > 0) {
        setImportVillageId(villRes.data[0].id);
        setFormVillageId(villRes.data[0].id);
      }
    }
  }

  async function fetchDptRecords() {
    setLoading(true);
    let query = supabase
      .from('dpt')
      .select('*', { count: 'exact' })
      .order('tps_number', { ascending: true })
      .order('full_name', { ascending: true })
      .limit(50);

    if (selectedDistrict !== 'ALL') {
      query = query.eq('district_id', selectedDistrict);
    }
    if (selectedVillage !== 'ALL') {
      query = query.eq('village_id', selectedVillage);
    }
    if (tpsFilter.trim() !== '') {
      query = query.eq('tps_number', Number(tpsFilter));
    }
    if (searchQuery.trim() !== '') {
      const q = searchQuery.trim();
      if (/^\d+$/.test(q)) {
        query = query.ilike('nik', `${q}%`);
      } else {
        query = query.ilike('full_name', `%${q}%`);
      }
    }

    const { data, count, error } = await query;
    if (!error && data) {
      setRecords(data);
      setTotalCount(count || 0);
    }
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

  const filteredVillagesForDropdown = useMemo(() => {
    if (selectedDistrict === 'ALL') return villages;
    return villages.filter((v) => v.district_id === selectedDistrict);
  }, [villages, selectedDistrict]);

  // Unduh Template CSV
  const handleDownloadTemplate = () => {
    const csvContent =
      'nik,nama,jenis_kelamin,usia,alamat,rt,rw,tps\n' +
      '7371010101900001,BUDI SANTOSO,L,36,JL. ANTANG RAYA NO 12,001,002,1\n' +
      '7371015205950002,SITI RAHMAWATI,P,31,JL. NIPA-NIPA LAMA,003,001,2\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_dpt_anakmudata.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Proses Import CSV Massal
  const handleImportCsv = async () => {
    if (!csvFile || !importVillageId) return;
    setImporting(true);
    setImportStatus('Membaca file CSV...');

    try {
      const text = await csvFile.text();
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      if (lines.length < 2) {
        setImportStatus('File CSV kosong atau hanya berisi header.');
        setImporting(false);
        return;
      }

      const separator = lines[0].includes(';') ? ';' : ',';
      const targetVillage = villageMap[importVillageId];
      const rowsToInsert: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(separator).map((c) => c.replace(/^"|"$/g, '').trim());
        const nik = cols[0];
        const fullName = cols[1];
        if (!nik || !fullName) continue;

        rowsToInsert.push({
          nik: nik.slice(0, 16),
          full_name: fullName.toUpperCase(),
          gender: (cols[2] || '').toUpperCase().slice(0, 10) || null,
          age: cols[3] ? parseInt(cols[3], 10) || null : null,
          address: cols[4] || null,
          rt: cols[5] || null,
          rw: cols[6] || null,
          district_id: targetVillage?.district_id || null,
          village_id: importVillageId,
          tps_number: parseInt(cols[7], 10) || 1,
        });
      }

      if (rowsToInsert.length === 0) {
        setImportStatus('Tidak ada baris data valid ditemukan.');
        setImporting(false);
        return;
      }

      setImportStatus(`Mengunggah ${rowsToInsert.length} data pemilih ke database...`);

      // Upsert per batch 500 baris
      const batchSize = 500;
      for (let i = 0; i < rowsToInsert.length; i += batchSize) {
        const batch = rowsToInsert.slice(i, i + batchSize);
        const { error } = await supabase.from('dpt').upsert(batch, { onConflict: 'nik' });
        if (error) throw error;
      }

      // Sinkronisasi ulang total_dpt pada kelurahan terkait
      const { count: updatedVillageDpt } = await supabase
        .from('dpt')
        .select('*', { count: 'exact', head: true })
        .eq('village_id', importVillageId);

      if (typeof updatedVillageDpt === 'number') {
        await supabase
          .from('villages')
          .update({ total_dpt: updatedVillageDpt })
          .eq('id', importVillageId);
      }

      setImportStatus(`Berhasil mengimpor ${rowsToInsert.length} data DPT!`);
      setCsvFile(null);
      fetchDptRecords();
    } catch (err: any) {
      setImportStatus('Gagal import: ' + (err.message || 'Terjadi kesalahan'));
    } finally {
      setImporting(false);
    }
  };

  // Simpan Tambah Manual 1 Pemilih DPT
  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNik || !formName || !formVillageId) return;
    setSavingManual(true);

    const targetVillage = villageMap[formVillageId];
    const { error } = await supabase.from('dpt').upsert(
      {
        nik: formNik.trim().slice(0, 16),
        full_name: formName.trim().toUpperCase(),
        gender: formGender,
        age: formAge ? parseInt(formAge, 10) : null,
        address: formAddress.trim() || null,
        rt: formRt.trim() || null,
        rw: formRw.trim() || null,
        district_id: targetVillage?.district_id || null,
        village_id: formVillageId,
        tps_number: parseInt(formTps, 10) || 1,
      },
      { onConflict: 'nik' }
    );

    setSavingManual(false);
    if (error) {
      alert('Gagal menyimpan data DPT: ' + error.message);
    } else {
      // Update total_dpt kelurahan
      const { count } = await supabase
        .from('dpt')
        .select('*', { count: 'exact', head: true })
        .eq('village_id', formVillageId);
      if (typeof count === 'number') {
        await supabase.from('villages').update({ total_dpt: count }).eq('id', formVillageId);
      }

      setShowAddModal(false);
      setFormNik('');
      setFormName('');
      setFormAge('');
      setFormAddress('');
      setFormRt('');
      setFormRw('');
      fetchDptRecords();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Tombol Aksi */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">🗂️ Data DPT — Kota Makassar</h1>
          <p className="text-sm text-slate-500 mt-1">
            Total <span className="font-bold text-slate-800">{totalCount.toLocaleString('id-ID')}</span> pemilih terdaftar sesuai filter aktif.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleDownloadTemplate}
            className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            ⬇ Template CSV
          </button>
          <button
            onClick={() => {
              setImportStatus('');
              setShowImportModal(true);
            }}
            className="px-3.5 py-2 rounded-lg bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800"
          >
            📤 Import CSV DPT
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 rounded-lg bg-orange-600 text-xs font-semibold text-white hover:bg-orange-700"
          >
            + Tambah Pemilih DPT
          </button>
        </div>
      </div>

      {/* Bar Filter & Pencarian Cepat */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-3">
        <select
          value={selectedDistrict}
          onChange={(e) => {
            setSelectedDistrict(e.target.value);
            setSelectedVillage('ALL');
          }}
          className="px-3 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-800 bg-white"
        >
          <option value="ALL">Semua Kecamatan</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              KEC. {d.name}
            </option>
          ))}
        </select>

        <select
          value={selectedVillage}
          onChange={(e) => setSelectedVillage(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-800 bg-white"
        >
          <option value="ALL">Semua Kelurahan</option>
          {filteredVillagesForDropdown.map((v) => (
            <option key={v.id} value={v.id}>
              KEL. {v.name}
            </option>
          ))}
        </select>

        <input
          type="number"
          placeholder="Filter No. TPS (misal: 1)"
          value={tpsFilter}
          onChange={(e) => setTpsFilter(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-800"
        />

        <input
          type="text"
          placeholder="Cari NIK (16 digit) atau Nama..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-800"
        />
      </div>

      {/* Tabel Data DPT */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                <th className="py-3.5 px-4">NIK</th>
                <th className="py-3.5 px-4">Nama Lengkap</th>
                <th className="py-3.5 px-4 text-center">L/P</th>
                <th className="py-3.5 px-4 text-center">Usia</th>
                <th className="py-3.5 px-4">Kelurahan / Kecamatan</th>
                <th className="py-3.5 px-4 text-center">TPS</th>
                <th className="py-3.5 px-4">Alamat / RT-RW</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Memuat data DPT...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    Belum ada data DPT yang cocok. Gunakan tombol <b>Import CSV DPT</b> atau <b>+ Tambah Pemilih DPT</b> di atas.
                  </td>
                </tr>
              ) : (
                records.map((r) => {
                  const vill = r.village_id ? villageMap[r.village_id] : null;
                  const distName = r.district_id ? districtMap[r.district_id] : '';
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-mono text-xs text-slate-700">{r.nik}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{r.full_name}</td>
                      <td className="py-3 px-4 text-center text-slate-600">{r.gender || '-'}</td>
                      <td className="py-3 px-4 text-center text-slate-600">{r.age ?? '-'}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">{vill?.name || '-'}</div>
                        <div className="text-xs text-slate-400">{distName}</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-orange-50 text-orange-700 font-bold text-xs">
                          TPS {String(r.tps_number).padStart(3, '0')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {r.address || '-'}
                        {(r.rt || r.rw) && ` (RT ${r.rt || '-'} / RW ${r.rw || '-'})`}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {totalCount > 50 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
            Menampilkan 50 data teratas dari {totalCount.toLocaleString('id-ID')} hasil. Gunakan pencarian NIK/Nama atau filter TPS untuk mempersempit hasil.
          </div>
        )}
      </div>

      {/* Modal Import CSV */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">📤 Import Massal Data DPT (CSV)</h3>
            <p className="text-xs text-slate-500">
              Pilih kelurahan tujuan lalu unggah file CSV dengan urutan kolom: <b>nik, nama, jenis_kelamin, usia, alamat, rt, rw, tps</b>.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Kelurahan Tujuan</label>
                <select
                  value={importVillageId}
                  onChange={(e) => setImportVillageId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  {villages.map((v) => (
                    <option key={v.id} value={v.id}>
                      KEL. {v.name} — KEC. {districtMap[v.district_id] || ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pilih File CSV</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
                />
              </div>

              {importStatus && (
                <div className="p-3 rounded-lg bg-slate-100 text-xs font-medium text-slate-800">
                  {importStatus}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-700"
              >
                Tutup
              </button>
              <button
                onClick={handleImportCsv}
                disabled={!csvFile || importing}
                className="px-4 py-2 rounded-lg bg-orange-600 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {importing ? 'Memproses...' : 'Mulai Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah Manual */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleManualAdd} className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">+ Tambah Pemilih ke DPT</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">NIK (16 Digit) *</label>
                <input
                  required
                  maxLength={16}
                  value={formNik}
                  onChange={(e) => setFormNik(e.target.value.replace(/\D/g, ''))}
                  placeholder="7371xxxxxxxxxxxx"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap *</label>
                <input
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Nama sesuai KTP"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Kelurahan *</label>
                <select
                  value={formVillageId}
                  onChange={(e) => setFormVillageId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  {villages.map((v) => (
                    <option key={v.id} value={v.id}>
                      KEL. {v.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nomor TPS *</label>
                <input
                  required
                  type="number"
                  min={1}
                  value={formTps}
                  onChange={(e) => setFormTps(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Jenis Kelamin</label>
                <select
                  value={formGender}
                  onChange={(e) => setFormGender(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="L">Laki-laki (L)</option>
                  <option value="P">Perempuan (P)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Usia</label>
                <input
                  type="number"
                  value={formAge}
                  onChange={(e) => setFormAge(e.target.value)}
                  placeholder="Contoh: 35"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3 md:col-span-1">
                <label className="block text-xs font-semibold text-slate-700 mb-1">RT / RW</label>
                <div className="flex gap-1.5">
                  <input
                    placeholder="RT"
                    value={formRt}
                    onChange={(e) => setFormRt(e.target.value)}
                    className="w-1/2 px-2.5 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  <input
                    placeholder="RW"
                    value={formRw}
                    onChange={(e) => setFormRw(e.target.value)}
                    className="w-1/2 px-2.5 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="col-span-3 md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Alamat</label>
                <input
                  placeholder="Nama jalan / lorong"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-700"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={savingManual}
                className="px-4 py-2 rounded-lg bg-orange-600 text-sm font-semibold text-white hover:bg-orange-700"
              >
                {savingManual ? 'Menyimpan...' : 'Simpan Data DPT'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}