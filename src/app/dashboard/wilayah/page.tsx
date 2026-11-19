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
  slug: string;
  total_tps: number;
  total_dpt: number;
  target_votes: number;
}

export default function DataWilayahPage() {
  const [districts, setDistricts] = useState<District[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [volunteerCounts, setVolunteerCounts] = useState<Record<string, number>>({});
  const [selectedDistrict, setSelectedDistrict] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // State untuk edit target kelurahan
  const [editingVillage, setEditingVillage] = useState<Village | null>(null);
  const [editDpt, setEditDpt] = useState<number>(0);
  const [editTarget, setEditTarget] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [distRes, villRes, volRes] = await Promise.all([
      supabase.from('districts').select('id, name').order('name'),
      supabase.from('villages').select('id, district_id, name, slug, total_tps, total_dpt, target_votes').order('name'),
      supabase.from('volunteers').select('village_id, status'),
    ]);

    if (distRes.data) setDistricts(distRes.data);
    if (villRes.data) setVillages(villRes.data);

    if (volRes.data) {
      const counts: Record<string, number> = {};
      volRes.data.forEach((v) => {
        if (v.status === 'approved') {
          counts[v.village_id] = (counts[v.village_id] || 0) + 1;
        }
      });
      setVolunteerCounts(counts);
    }
    setLoading(false);
  }

  const districtMap = useMemo(() => {
    const map: Record<string, string> = {};
    districts.forEach((d) => (map[d.id] = d.name));
    return map;
  }, [districts]);

  const filteredVillages = useMemo(() => {
    return villages.filter((v) => {
      const matchDistrict = selectedDistrict === 'ALL' || v.district_id === selectedDistrict;
      const matchSearch = v.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchDistrict && matchSearch;
    });
  }, [villages, selectedDistrict, searchQuery]);

  const summary = useMemo(() => {
    const totalTps = filteredVillages.reduce((acc, v) => acc + (v.total_tps || 0), 0);
    const totalDpt = filteredVillages.reduce((acc, v) => acc + (v.total_dpt || 0), 0);
    const totalTarget = filteredVillages.reduce((acc, v) => acc + (v.target_votes || 0), 0);
    const totalRelawan = filteredVillages.reduce((acc, v) => acc + (volunteerCounts[v.id] || 0), 0);
    return {
      kelurahanCount: filteredVillages.length,
      totalTps,
      totalDpt,
      totalTarget,
      totalRelawan,
    };
  }, [filteredVillages, volunteerCounts]);

  const handleCopyLink = (slug: string) => {
    const url = `${window.location.origin}/daftar/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const openEditModal = (village: Village) => {
    setEditingVillage(village);
    setEditDpt(village.total_dpt || 0);
    setEditTarget(village.target_votes || 0);
  };

  const handleSaveTarget = async () => {
    if (!editingVillage) return;
    setSaving(true);
    const { error } = await supabase
      .from('villages')
      .update({ total_dpt: editDpt, target_votes: editTarget })
      .eq('id', editingVillage.id);

    setSaving(false);
    if (!error) {
      setVillages((prev) =>
        prev.map((v) =>
          v.id === editingVillage.id ? { ...v, total_dpt: editDpt, target_votes: editTarget } : v
        )
      );
      setEditingVillage(null);
    } else {
      alert('Gagal menyimpan target: ' + error.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Data Wilayah — Kota Makassar</h1>
        <p className="text-sm text-slate-500 mt-1">
          Pemetaan Kecamatan, Kelurahan, jumlah TPS, target suara, dan tautan pendaftaran lapangan.
        </p>
      </div>

      {/* Ringkasan Statistik Wilayah */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Kelurahan</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{summary.kelurahanCount}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Total TPS</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{summary.totalTps.toLocaleString('id-ID')}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Relawan TPS Aktif</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {summary.totalRelawan.toLocaleString('id-ID')}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Target Suara</div>
          <div className="text-2xl font-bold text-orange-600 mt-1">
            {summary.totalTarget.toLocaleString('id-ID')}
          </div>
        </div>
      </div>

      {/* Filter Kecamatan & Pencarian Kelurahan */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3">
        <select
          value={selectedDistrict}
          onChange={(e) => setSelectedDistrict(e.target.value)}
          className="px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-800 bg-white md:w-72"
        >
          <option value="ALL">Semua Kecamatan ({districts.length})</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              KEC. {d.name}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Cari nama kelurahan..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-800 flex-1"
        />
      </div>

      {/* Tabel Data Kelurahan */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                <th className="py-3.5 px-4">Kelurahan</th>
                <th className="py-3.5 px-4">Kecamatan</th>
                <th className="py-3.5 px-4 text-center">Jml TPS</th>
                <th className="py-3.5 px-4 text-center">Relawan TPS</th>
                <th className="py-3.5 px-4 text-right">DPT</th>
                <th className="py-3.5 px-4 text-right">Target Suara</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Memuat data wilayah Makassar...
                  </td>
                </tr>
              ) : filteredVillages.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Kelurahan tidak ditemukan.
                  </td>
                </tr>
              ) : (
                filteredVillages.map((v) => {
                  const approvedCount = volunteerCounts[v.id] || 0;
                  const tpsCount = v.total_tps || 0;
                  const pct = tpsCount > 0 ? Math.min(100, Math.round((approvedCount / tpsCount) * 100)) : 0;

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/80">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">{v.name}</td>
                      <td className="py-3.5 px-4 text-slate-600">{districtMap[v.district_id] || '-'}</td>
                      <td className="py-3.5 px-4 text-center font-medium text-slate-800">{tpsCount}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            pct >= 100
                              ? 'bg-emerald-100 text-emerald-700'
                              : approvedCount > 0
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {approvedCount} / {tpsCount} ({pct}%)
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-700">
                        {(v.total_dpt || 0).toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-orange-600">
                        {(v.target_votes || 0).toLocaleString('id-ID')}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => openEditModal(v)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          Atur Target
                        </button>
                        <button
                          onClick={() => handleCopyLink(v.slug)}
                          className="px-2.5 py-1.5 rounded-lg bg-orange-600 text-xs font-medium text-white hover:bg-orange-700"
                        >
                          {copiedSlug === v.slug ? '✓ Tersalin' : 'Salin Link'}
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

      {/* Modal Edit Target Kelurahan */}
      {editingVillage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">
              Atur Target — Kel. {editingVillage.name}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Jumlah DPT Kelurahan
                </label>
                <input
                  type="number"
                  value={editDpt}
                  onChange={(e) => setEditDpt(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Target Perolehan Suara
                </label>
                <input
                  type="number"
                  value={editTarget}
                  onChange={(e) => setEditTarget(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingVillage(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-700"
              >
                Batal
              </button>
              <button
                onClick={handleSaveTarget}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-orange-600 text-sm font-semibold text-white hover:bg-orange-700"
              >
                {saving ? 'Menyimpan...' : 'Simpan Target'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}