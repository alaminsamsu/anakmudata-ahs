'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

interface DistrictRow {
  id: string;
  name: string;
}

interface VillageRow {
  id: string;
  district_id: string;
  name: string;
}

interface NewsIssueItem {
  id: string;
  title: string;
  searchBlob?: string;
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

const MAX_NEWS_PER_VILLAGE = 3;

export default function IsuWilayahPage() {
  const [districts, setDistricts] = useState<DistrictRow[]>([]);
  const [villages, setVillages] = useState<VillageRow[]>([]);
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
    fetchRegions();
    fetchSavedBriefs();
  }, []);

  useEffect(() => {
    fetchNews(selectedDistrict);
  }, [selectedDistrict]);

  async function fetchRegions() {
    const [dRes, vRes] = await Promise.all([
      supabase.from('districts').select('id, name').order('name'),
      supabase.from('villages').select('id, district_id, name').order('name'),
    ]);
    if (dRes.data) setDistricts(dRes.data);
    if (vRes.data) setVillages(vRes.data);
  }

  async function fetchNews(district: string) {
    setLoadingNews(true);
    setNewsError('');
    try {
      const res = await fetch(`/api/isu-makassar?district=${encodeURIComponent(district)}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        setNewsError(
          errData?.error || `Endpoint /api/isu-makassar merespons status ${res.status}.`
        );
        setNewsItems([]);
        return;
      }
      const data = await res.json();
      if (data.error) setNewsError(data.error);
      setNewsItems(data.items || []);
    } catch (err: any) {
      setNewsError(`Gagal terhubung ke layanan radar berita (${err?.message || 'network error'}).`);
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

  // Gambaran Ringkas Per Kecamatan + Pengelompokan Kelurahan (Max 3 Berita / Kelurahan)
  const districtGroupedOverview = useMemo(() => {
    const targetDistricts =
      selectedDistrict === 'ALL'
        ? districts
        : districts.filter((d) => d.name.toUpperCase() === selectedDistrict.toUpperCase());

    return targetDistricts.map((dist) => {
      const distUpper = dist.name.toUpperCase();
      const distVillages = villages.filter((v) => String(v.district_id) === String(dist.id));

      const distNews = filteredNews.filter(
        (item) =>
          item.districts.some((d) => d.toUpperCase() === distUpper) ||
          (item.searchBlob || item.title.toUpperCase()).includes(distUpper)
      );

      // Hitung topik dominan di kecamatan ini
      const catCounts: Record<string, number> = {};
      distNews.forEach((n) => {
        catCounts[n.category] = (catCounts[n.category] || 0) + 1;
      });
      const topCategory =
        Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Belum ada isu menonjol';

      // Kelompokkan per kelurahan (maksimal 3 berita per kelurahan)
      const villageGroups = distVillages
        .map((v) => {
          const vUpper = v.name.toUpperCase();
          const matchedForVillage = distNews.filter((item) =>
            (item.searchBlob || item.title.toUpperCase()).includes(vUpper)
          );
          return {
            villageId: v.id,
            villageName: v.name,
            news: matchedForVillage.slice(0, MAX_NEWS_PER_VILLAGE),
            totalMatched: matchedForVillage.length,
          };
        })
        .filter((vg) => vg.news.length > 0);

      // Berita kecamatan yang tidak menyebut nama kelurahan spesifik (dibatasi maks 3 agar ringkas)
      const generalDistrictNews = distNews
        .filter(
          (item) =>
            !distVillages.some((v) =>
              (item.searchBlob || item.title.toUpperCase()).includes(v.name.toUpperCase())
            )
        )
        .slice(0, MAX_NEWS_PER_VILLAGE);

      return {
        districtId: dist.id,
        districtName: dist.name,
        villageCount: distVillages.length,
        totalNewsCount: distNews.length,
        topCategory,
        villageGroups,
        generalDistrictNews,
      };
    });
  }, [districts, villages, selectedDistrict, filteredNews]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-600 text-[11px] font-extrabold uppercase tracking-wider mb-1.5">
            Gambaran Kecamatan & Kelurahan · 15 Kecamatan Makassar
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">
            📰 Gambaran & Isu Per Kecamatan & Kelurahan
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Ringkasan dinamika berita per kecamatan dan kelurahan (maksimal {MAX_NEWS_PER_VILLAGE} berita per kelurahan agar ringkas).
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchNews(selectedDistrict)}
          disabled={loadingNews}
          className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold self-start lg:self-auto"
        >
          {loadingNews ? '⏳ Memindai...' : '🔄 Tarik Berita Terbaru'}
        </button>
      </div>

      {/* Filter Kecamatan & Topik */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap items-center gap-2.5">
        <select
          value={selectedDistrict}
          onChange={(e) => setSelectedDistrict(e.target.value)}
          className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-extrabold text-slate-800 bg-white"
        >
          <option value="ALL">Semua Kecamatan (15)</option>
          {districts.map((d) => (
            <option key={d.id} value={d.name.toUpperCase()}>
              KEC. {d.name}
            </option>
          ))}
        </select>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white"
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

      {newsError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
          ⚠️ {newsError}
        </div>
      )}

      {/* Gambaran Setiap Kecamatan & Rincian Kelurahannya */}
      {loadingNews ? (
        <div className="bg-white p-10 rounded-3xl border border-slate-100 text-center text-xs text-slate-400">
          Menyusun gambaran isu per kecamatan dan kelurahan...
        </div>
      ) : (
        <div className="space-y-5">
          {districtGroupedOverview.map((grp) => (
            <section
              key={grp.districtId}
              className="bg-white rounded-3xl border border-slate-100 p-5 md:p-6 shadow-sm space-y-4"
            >
              {/* Gambaran Singkat Kecamatan */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    📍 KEC. {grp.districtName}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {grp.villageCount} Kelurahan · Topik utama: <b>{grp.topCategory}</b>
                  </p>
                </div>

                <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-extrabold self-start md:self-auto">
                  {grp.totalNewsCount} Berita Terpantau
                </span>
              </div>

              {/* Rincian Per Kelurahan (Maksimal 3 Berita / Kelurahan) */}
              {grp.villageGroups.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {grp.villageGroups.map((vg) => (
                    <div
                      key={vg.villageId}
                      className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-indigo-900">
                          KEL. {vg.villageName}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          Menampilkan {vg.news.length} berita
                        </span>
                      </div>

                      <div className="space-y-2">
                        {vg.news.map((item) => (
                          <div
                            key={item.id}
                            className="bg-white p-3 rounded-xl border border-slate-100 space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-2 text-[10px]">
                              <span className="font-bold text-indigo-600">{item.category}</span>
                              <span className="text-slate-400">{item.pubDate}</span>
                            </div>
                            <a
                              href={item.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-xs font-bold text-slate-800 hover:text-indigo-600 leading-snug"
                            >
                              {item.title}
                            </a>
                            <div className="flex items-center justify-between pt-1 text-[10px]">
                              <span className="text-slate-400">{item.source}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setBriefModalItem({
                                    ...item,
                                    districts: [`KEC. ${grp.districtName}`, `KEL. ${vg.villageName}`],
                                  });
                                  setStanceInput('');
                                }}
                                className="font-extrabold text-emerald-700 hover:underline"
                              >
                                + Briefing
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Berita Tingkat Kecamatan (Jika Tidak Menyebut Kelurahan Spesifik) */}
              {grp.generalDistrictNews.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-slate-400 uppercase">
                    Ringkasan Tingkat Kecamatan (Maks. {MAX_NEWS_PER_VILLAGE})
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {grp.generalDistrictNews.map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/40 flex flex-col justify-between gap-2"
                      >
                        <div className="space-y-1">
                          <div className="text-[10px] font-bold text-indigo-600">{item.category}</div>
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-xs font-bold text-slate-800 hover:text-indigo-600 leading-snug"
                          >
                            {item.title}
                          </a>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>{item.source}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setBriefModalItem({
                                ...item,
                                districts: [`KEC. ${grp.districtName}`],
                              });
                              setStanceInput('');
                            }}
                            className="font-extrabold text-emerald-700 hover:underline"
                          >
                            + Briefing
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {grp.villageGroups.length === 0 && grp.generalDistrictNews.length === 0 && (
                <p className="text-xs text-slate-400">
                  Belum ada berita terdeteksi untuk kecamatan/kelurahan ini pada filter saat ini.
                </p>
              )}
            </section>
          ))}
        </div>
      )}

      {/* Catatan Briefing Sikap Caleg Tersimpan */}
      {savedBriefs.length > 0 && (
        <section className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
          <h2 className="text-base font-extrabold text-slate-900">
            📋 Catatan Briefing Caleg Tersimpan ({savedBriefs.length})
          </h2>
          <div className="divide-y divide-slate-100">
            {savedBriefs.map((b) => (
              <div key={b.id} className="py-3 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-indigo-700">
                    📍 {b.district_name} · {b.category}
                  </div>
                  <div className="text-xs font-extrabold text-slate-900">{b.title}</div>
                  {b.candidate_stance && (
                    <div className="text-xs text-emerald-900 bg-emerald-50/70 px-3 py-2 rounded-xl border border-emerald-200">
                      <b>Sikap Caleg:</b> {b.candidate_stance}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteBrief(b.id)}
                  className="text-[11px] font-bold text-rose-500 hover:text-rose-700"
                >
                  Hapus
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Modal Tambah Briefing */}
      {briefModalItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleSaveBrief}
            className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl"
          >
            <h3 className="text-base font-extrabold text-slate-900">📋 Simpan ke Briefing Caleg</h3>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="text-[10px] font-extrabold text-indigo-600">
                📍 {briefModalItem.districts.join(' · ')}
              </div>
              <div className="text-xs font-bold text-slate-900">{briefModalItem.title}</div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Catatan Sikap / Narasi Caleg
              </label>
              <textarea
                rows={3}
                value={stanceInput}
                onChange={(e) => setStanceInput(e.target.value)}
                placeholder="Tuliskan poin sikap atau tanggapan Caleg..."
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs"
              />
            </div>
            <div className="flex justify-end gap-2">
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
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
              >
                {savingBrief ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}