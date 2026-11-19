'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export interface DistrictStat {
  id: string;
  name: string;
  kelurahanCount: number;
  totalTps: number;
  targetVotes: number;
  approved: number;
  pending: number;
  pct: number;
}

// Koordinat relatif (0-100) untuk 15 Kecamatan Kota Makassar (menyerupai posisi geografis asli)
const MAKASSAR_COORDS: Record<string, { x: number; y: number; zone: string }> = {
  'KEPULAUAN SANGKARRANG': { x: 14, y: 22, zone: 'Kepulauan' },
  'UJUNG TANAH': { x: 34, y: 26, zone: 'Utara / Pesisir' },
  'TALLO': { x: 46, y: 24, zone: 'Utara' },
  'WAJO': { x: 32, y: 34, zone: 'Pusat / Kota Lama' },
  'BONTOALA': { x: 39, y: 36, zone: 'Pusat' },
  'UJUNG PANDANG': { x: 30, y: 44, zone: 'Pusat / Pesisir' },
  'MAKASSAR': { x: 41, y: 45, zone: 'Pusat' },
  'MAMAJANG': { x: 33, y: 54, zone: 'Selatan / Pesisir' },
  'MARISO': { x: 27, y: 60, zone: 'Selatan / Pesisir' },
  'RAPPOCINI': { x: 44, y: 58, zone: 'Selatan' },
  'TAMALATE': { x: 33, y: 74, zone: 'Selatan' },
  'PANAKKUKANG': { x: 54, y: 48, zone: 'Timur' },
  'MANGGALA': { x: 69, y: 62, zone: 'Timur' },
  'TAMALANREA': { x: 67, y: 27, zone: 'Timur Laut' },
  'BIRINGKANAYA': { x: 82, y: 18, zone: 'Timur Laut' },
};

function normalizeDistrictName(name: string): string {
  return name.toUpperCase().replace(/^KEC\.?\s*/i, '').trim();
}

export default function MakassarMap({ districts }: { districts: DistrictStat[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const mappedDistricts = districts.map((d) => {
    const key = normalizeDistrictName(d.name);
    const coord = MAKASSAR_COORDS[key] || { x: 50, y: 50, zone: 'Makassar' };
    return { ...d, ...coord };
  });

  const activeDistrict =
    mappedDistricts.find((d) => d.id === selectedId) || mappedDistricts[0] || null;

  const getPinColor = (pct: number, approved: number) => {
    if (pct >= 80) return { bg: '#10b981', ring: 'rgba(16, 185, 129, 0.25)', label: 'Kuat (≥80%)' };
    if (approved > 0) return { bg: '#f97316', ring: 'rgba(249, 115, 22, 0.25)', label: 'Berjalan (1-79%)' };
    return { bg: '#ef4444', ring: 'rgba(239, 68, 68, 0.2)', label: 'Kosong (0%)' };
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900">🗺️ Peta Sebaran Kekuatan — Kota Makassar</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Klik titik kecamatan pada peta untuk melihat detail cakupan TPS dan target suara.
          </p>
        </div>

        {/* Legenda Warna */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Kuat (≥80%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" /> Berjalan
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Belum Terisi
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3">
        {/* Kanvas Peta Interaktif Kota Makassar */}
        <div className="lg:col-span-2 bg-slate-950 relative min-h-[380px] p-4 flex items-center justify-center overflow-hidden">
          <svg
            viewBox="0 0 100 90"
            className="w-full h-full max-h-[400px] select-none"
          >
            {/* Garis Grid Radar Wilayah */}
            <defs>
              <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(148,163,184,0.08)" strokeWidth="0.3" />
              </pattern>
            </defs>
            <rect width="100" height="90" fill="url(#grid)" />

            {/* Siluet Daratan Utama Kota Makassar & Garis Pantai Selat Makassar */}
            <path
              d="M 24,80 L 23,62 L 26,44 L 29,31 L 35,21 L 52,20 L 66,18 L 88,10 L 92,28 L 80,45 L 78,68 L 62,74 L 44,82 Z"
              fill="rgba(30, 41, 59, 0.85)"
              stroke="rgba(148, 163, 184, 0.35)"
              strokeWidth="0.6"
              strokeLinejoin="round"
            />

            {/* Label Perairan */}
            <text x="8" y="55" fill="rgba(148,163,184,0.35)" fontSize="2.6" fontWeight="600" letterSpacing="0.3">
              SELAT MAKASSAR
            </text>

            {/* Titik 15 Kecamatan */}
            {mappedDistricts.map((d) => {
              const color = getPinColor(d.pct, d.approved);
              const isSelected = activeDistrict?.id === d.id;

              return (
                <g
                  key={d.id}
                  onClick={() => setSelectedId(d.id)}
                  className="cursor-pointer transition-transform"
                >
                  {/* Lingkaran Denyut / Sorotan */}
                  <circle
                    cx={d.x}
                    cy={d.y}
                    r={isSelected ? 4.8 : 3.2}
                    fill={color.ring}
                  />
                  {/* Titik Utama */}
                  <circle
                    cx={d.x}
                    cy={d.y}
                    r={isSelected ? 2.3 : 1.7}
                    fill={color.bg}
                    stroke={isSelected ? '#ffffff' : '#0f172a'}
                    strokeWidth={isSelected ? 0.6 : 0.4}
                  />
                  {/* Label Nama Kecamatan */}
                  <text
                    x={d.x}
                    y={d.y - 2.8}
                    textAnchor="middle"
                    fill={isSelected ? '#ffffff' : '#cbd5e1'}
                    fontSize={isSelected ? '2.5' : '2.1'}
                    fontWeight={isSelected ? '700' : '500'}
                  >
                    {normalizeDistrictName(d.name)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Panel Detail Kecamatan Terpilih */}
        <div className="p-6 bg-slate-50 border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col justify-between">
          {activeDistrict ? (
            <div className="space-y-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-orange-600">
                  Zona {activeDistrict.zone}
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 mt-0.5">
                  KEC. {normalizeDistrictName(activeDistrict.name)}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Terdiri dari <b>{activeDistrict.kelurahanCount} Kelurahan</b>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <div className="text-[11px] text-slate-500">Total TPS</div>
                  <div className="text-lg font-bold text-slate-900">{activeDistrict.totalTps}</div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <div className="text-[11px] text-slate-500">Relawan Aktif</div>
                  <div className="text-lg font-bold text-emerald-600">{activeDistrict.approved}</div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <div className="text-[11px] text-slate-500">Menunggu Verifikasi</div>
                  <div className="text-lg font-bold text-amber-600">{activeDistrict.pending}</div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <div className="text-[11px] text-slate-500">Target Suara</div>
                  <div className="text-lg font-bold text-orange-600">
                    {activeDistrict.targetVotes.toLocaleString('id-ID')}
                  </div>
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                <div className="flex justify-between text-xs font-semibold mb-1.5">
                  <span className="text-slate-600">Cakupan Relawan TPS</span>
                  <span className="text-slate-900">{activeDistrict.pct}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-orange-600 h-full rounded-full transition-all"
                    style={{ width: `${activeDistrict.pct}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-400">Memuat data wilayah...</div>
          )}

          <div className="pt-5">
            <Link
              href="/dashboard/wilayah"
              className="block w-full text-center py-2.5 px-4 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
            >
              Buka Rincian Kelurahan & Link Pendaftaran →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}