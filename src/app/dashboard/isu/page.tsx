'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

interface NewsIssueItem {
  id: string;
  title: string;
  link: string;
  source: string;
  pubDate: string;
  districts: string[];
  category: string;
  segment: string;
  urgency: 'TINGGI' | 'SEDANG';
}

interface SavedBrief {
  id: string;
  district_name: string;
  category: string;
  target_segment: string;
  title: string;
  source_name: string | null;
  source_url: string | null;
  published_at: string | null;
  candidate_stance: string | null;
  created_at: string;
}

const DISTRICTS_15 = [
  'BIRINGKANAYA',
  'TAMALANREA',
  'MANGGALA',
  'PANAKKUKANG',
  'RAPPOCINI',
  'TAMALATE',
  'MARISO',
  'MAMAJANG',
  'MAKASSAR',
  'UJUNG PANDANG',
  'WAJO',
  'BONTOALA',
  'TALLO',
  'UJUNG TANAH',
  'KEPULAUAN SANGKARRANG',
];

export default function IsuWilayahPage() {
  const [selectedDistrict, setSelectedDistrict] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [newsItems, setNewsItems] = useState<NewsIssueItem[]>([]);
  const [loadingNews, setLoadingNews] = useState<boolean>(true);
  const [newsError, setNewsError] = useState<string>('');

  // Briefing Caleg Tersimpan
  const [savedBriefs, setSavedBriefs] = useState<SavedBrief[]>([]);
  const [briefModalItem, setBriefModalItem] = useState<NewsIssueItem | null>(null);
  const [stanceInput, setStanceInput] = useState<string>('');
  const [savingBrief, setSavingBrief] = useState<boolean>(false);

  useEffect(() => {
    fetchNews(selectedDistrict);
  }, [selectedDistrict]);

  useEffect(() => {
    fetchSavedBriefs();
  }, []);

  async function fetchNews(district: string) {
    setLoadingNews(true);
    setNewsError('');
    try {
      const res = await fetch(`/api/isu-makassar?district=${encodeURIComponent(district)}`);
      const data = await res.json();
      if (data.error) setNewsError(data.error);
      setNewsItems(data.items || []);
    } catch {
      setNewsError('Gagal terhubung ke layanan radar berita.');
    } finally {
      setLoadingNews(false);
    }
  }

  async function fetchSavedBriefs() {
    const { data } = await supabase
      .from('district_issue_briefs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    if (data) setSavedBriefs(data as SavedBrief[]);
  }

  const handleSaveBrief = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!briefModalItem) return;
    setSavingBrief(true);

    const { error } = await supabase.from('district_issue_briefs').insert({
      district_name: briefModalItem.districts.join(', '),
      category: briefModalItem.category,
      target_segment: briefModalItem.segment,
      title: briefModalItem.title,
      source_name: briefModalItem.source,
      source_url: briefModalItem.link,
      published_at: briefModalItem.pubDate,
      candidate_stance: stanceInput.trim() || null,
    });

    setSavingBrief(false);
    if (error) {
      alert('Gagal menyimpan briefing isu: ' + error.message);
    } else {
      setBriefModalItem(null);
      setStanceInput('');
      fetchSavedBriefs();
    }
  };

  const handleDeleteBrief = async (id: string) => {
    await supabase.from('district_issue_briefs').delete().eq('id', id);
    setSavedBriefs((prev) => prev.filter((b) => b.id !== id));
  };

  const filteredNews = useMemo(() => {
    return newsItems.filter(
      (item) => selectedCategory === 'ALL' || item.category === selectedCategory
    );
  }, [newsItems, selectedCategory]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-600 text-[11px] font-extrabold uppercase tracking-wider mb-1.5">
            Radar Media Lokal Otomatis · 15 Kecamatan Makassar
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">
            📰 Radar Isu & Dinamika Kecamatan
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Pantauan otomatis berita & keluhan warga Makassar dari media lokal sebagai bahan briefing Caleg sebelum turun lapangan.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchNews(selectedDistrict)}
          disabled={loadingNews}
          className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold self-start lg:self-auto"
        >
          {loadingNews ? '⏳ Memindai Berita...' : '🔄 Tarik Berita Terbaru'}
        </button>
      </div>

      {/* Filter Cepat Kecamatan (Dengan Pintasan Basis Biringkanaya & Tamalanrea) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">Wilayah Pantauan:</span>
          <button
            type="button"
            onClick={() => setSelectedDistrict('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              selectedDistrict === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua Makassar
          </button>
          <button
            type="button"
            onClick={() => setSelectedDistrict('BIRINGKANAYA')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              selectedDistrict === 'BIRINGKANAYA'
                ? 'bg-indigo-600 text-white'
                : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
            }`}
          >
            🔥 Basis: Biringkanaya
          </button>
          <button
            type="button"
            onClick={() => setSelectedDistrict('TAMALANREA')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              selectedDistrict === 'TAMALANREA'
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
            }`}
          >
            🔥 Basis: Tamalanrea
          </button>

          <select
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
          >
            <option value="ALL">Pilih dari 15 Kecamatan...</option>
            {DISTRICTS_15.map((d) => (
              <option key={d} value={d}>
                KEC. {d}
              </option>
            ))}
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white"
          >
            <option value="ALL">Semua Topik Isu</option>
            <option value="🌊 Banjir & Drainase">🌊 Banjir & Drainase</option>
            <option value="👩‍👧 Kebutuhan Pokok & UMKM">👩‍👧 Kebutuhan Pokok & UMKM</option>
            <option value="⚡ Pemuda, Kampus & Kerja">⚡ Pemuda, Kampus & Kerja</option>
            <option value="🛣️ Jalan & Transportasi">🛣️ Jalan & Transportasi</option>
            <option value="🚨 Keamanan & Ketertiban">🚨 Keamanan & Ketertiban</option>
            <option value="🏥 Kesehatan & Posyandu">🏥 Kesehatan & Posyandu</option>
          </select>
        </div>
      </div>

      {newsError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
          ⚠️ {newsError}
        </div>
      )}

      {/* Daftar Berita & Isu Terdeteksi Otomatis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loadingNews ? (
          <div className="col-span-full bg-white p-10 rounded-3xl border border-slate-100 text-center text-xs text-slate-400">
            Memindai berita media lokal Makassar untuk wilayah <b>{selectedDistrict}</b>...
          </div>
        ) : filteredNews.length === 0 ? (
          <div className="col-span-full bg-white p-10 rounded-3xl border border-slate-100 text-center text-xs text-slate-400">
            Belum ada berita terbaru yang cocok pada filter kecamatan/kategori ini.
          </div>
        ) : (
          filteredNews.map((item) => (
            <div
              key={item.id}
              className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between gap-4 hover:border-indigo-200 transition"
            >
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {item.districts.map((d) => (
                      <span
                        key={d}
                        className="px-2.5 py-0.5 rounded-full bg-slate-900 text-white text-[10px] font-extrabold"
                      >
                        📍 {d}
                      </span>
                    ))}
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                      {item.category}
                    </span>
                  </div>

                  {item.urgency === 'TINGGI' && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[10px] font-extrabold">
                      🔴 Isu Sensitif / Mendesak
                    </span>
                  )}
                </div>

                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm font-extrabold text-slate-900 hover:text-indigo-600 leading-snug"
                >
                  {item.title}
                </a>

                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                  <span>📰 {item.source}</span>
                  <span>🗓️ {item.pubDate}</span>
                  <span className="text-purple-600 font-semibold">{item.segment}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-slate-600 hover:text-slate-900"
                >
                  Baca Sumber Asli ↗
                </a>

                <button
                  type="button"
                  onClick={() => {
                    setBriefModalItem(item);
                    setStanceInput('');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-extrabold transition"
                >
                  + Jadikan Briefing Caleg
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Papan Briefing Sikap Caleg Tersimpan */}
      {savedBriefs.length > 0 && (
        <section className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              📋 Catatan Briefing & Sikap Caleg Tersimpan ({savedBriefs.length})
            </h2>
            <p className="text-xs text-slate-500">
              Rangkuman isu pilihan yang sudah dilengkapi poin sikap/solusi untuk pegangan Caleg dan Tim di lapangan.
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {savedBriefs.map((b) => (
              <div key={b.id} className="py-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-white">📍 {b.district_name}</span>
                    <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">{b.category}</span>
                    <span className="text-purple-700">{b.target_segment}</span>
                  </div>
                  <div className="text-xs font-extrabold text-slate-900">{b.title}</div>
                  {b.candidate_stance && (
                    <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-900">
                      <b>💡 Poin Sikap / Narasi Caleg:</b> {b.candidate_stance}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteBrief(b.id)}
                  className="text-[11px] font-bold text-rose-500 hover:text-rose-700 self-end sm:self-start"
                >
                  Hapus
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Modal Tambah Catatan Sikap Caleg */}
      {briefModalItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleSaveBrief}
            className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl"
          >
            <h3 className="text-base font-extrabold text-slate-900">📋 Simpan ke Briefing Caleg</h3>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="text-[10px] font-extrabold text-indigo-600">
                📍 {briefModalItem.districts.join(', ')} · {briefModalItem.category}
              </div>
              <div className="text-xs font-bold text-slate-900">{briefModalItem.title}</div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Catatan Sikap / Solusi Caleg untuk Isu Ini
              </label>
              <textarea
                rows={3}
                value={stanceInput}
                onChange={(e) => setStanceInput(e.target.value)}
                placeholder="Contoh: Dorong normalisasi drainase primer & siapkan posko tanggap warga bersama tim..."
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBriefModalItem(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={savingBrief}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
              >
                {savingBrief ? 'Menyimpan...' : 'Simpan Briefing'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}