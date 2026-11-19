'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export interface DistrictStat {
  id: string;
  name: string;
  kelurahanCount: number;
  totalTps: number;
  totalDpt: number;
  targetVotes: number;
  approved: number;
  pending: number;
  pct: number;
}

const DISTRICT_POLYGONS: Record<
  string,
  { points?: string; isIsland?: boolean; labelX: number; labelY: number; code: string }
> = {
  'KEPULAUAN SANGKARRANG': { isIsland: true, labelX: 95, labelY: 70, code: '01' },
  'BIRINGKANAYA': { points: '490,40 680,60 740,160 580,200 480,120', labelX: 590, labelY: 120, code: '02' },
  'TAMALANREA': { points: '480,120 580,200 520,270 410,210 440,150', labelX: 490, labelY: 195, code: '03' },
  'MANGGALA': { points: '520,270 710,240 760,340 570,390 490,320', labelX: 615, labelY: 315, code: '04' },
  'PANAKKUKANG': { points: '360,210 490,210 490,320 370,310', labelX: 425, labelY: 262, code: '05' },
  'TALLO': { points: '260,110 440,130 410,210 290,190', labelX: 350, labelY: 162, code: '06' },
  'UJUNG TANAH': { points: '210,120 260,110 270,165 215,160', labelX: 240, labelY: 140, code: '07' },
  'WAJO': { points: '215,160 270,165 270,200 220,195', labelX: 243, labelY: 182, code: '08' },
  'BONTOALA': { points: '270,165 330,160 330,215 270,210', labelX: 300, labelY: 190, code: '09' },
  'MAKASSAR': { points: '220,200 310,200 310,250 230,250', labelX: 265, labelY: 228, code: '10' },
  'UJUNG PANDANG': { points: '180,210 220,200 225,255 185,250', labelX: 202, labelY: 230, code: '11' },
  'MARISO': { points: '185,250 240,255 240,310 180,305', labelX: 210, labelY: 282, code: '12' },
  'MAMAJANG': { points: '240,255 310,250 310,310 240,310', labelX: 275, labelY: 282, code: '13' },
  'RAPPOCINI': { points: '310,250 420,250 420,360 300,350', labelX: 362, labelY: 305, code: '14' },
  'TAMALATE': { points: '180,310 320,320 320,440 200,430', labelX: 250, labelY: 375, code: '15' },
};

function normalizeName(name: string): string {
  return name.toUpperCase().replace(/^KEC\.?\s*/i, '').trim();
}

export default function MakassarMap({ districts }: { districts: DistrictStat[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeDistrict =
    districts.find((d) => d.id === selectedId) ||
    districts.find((d) => normalizeName(d.name) === 'RAPPOCINI') ||
    districts[0] ||
    null;

  const getPolygonFill = (pct: number, approved: number) => {
    if (pct >= 60) return '#F43F5E'; // Unggul / Kuat (Rose)
    if (approved > 0) return '#6366F1'; // Berjalan (Indigo)
    return '#334155'; // Belum Terisi (Slate)
  };

  return (
    <section className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-sm">
      {/* Header Peta */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">Peta Interaktif Sebaran Suara & TPS Makassar</h2>
            <span className="px-2 py-0.5 text-[11px] font-bold bg-indigo-50 text-indigo-600 rounded-md border border-indigo-100">
              Geo-Spasial {districts.length} Kecamatan
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Klik poligon kecamatan pada peta untuk melihat detail cakupan TPS, relawan aktif, dan target suara.
          </p>
        </div>

        {/* Legenda Warna */}
        <div className="flex flex-wrap items-center gap-4 px-3.5 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-[11px] font-semibold text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500" /> Kuat (≥60% TPS)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-indigo-500" /> Berjalan (1-59%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-slate-700" /> Belum Terisi (0%)
          </span>
        </div>
      </div>

      {/* Grid Kanvas Peta & Panel Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6 items-stretch">
        {/* Kanvas SVG Peta Makassar (8 Cols) */}
        <div className="lg:col-span-8 bg-slate-900 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between min-h-[450px] shadow-inner">
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{ backgroundImage: 'radial-gradient(#6366F1 1px, transparent 1px)', backgroundSize: '24px 24px' }}
          />

          <div className="relative z-10 flex items-center justify-between">
            <div className="bg-slate-800/80 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-slate-700/80 text-xs text-slate-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-medium">Live Radar: Selat Makassar & Daratan</span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
              Koordinat -5.1477, 119.4327
            </span>
          </div>

          <div className="relative z-10 flex items-center justify-center my-auto py-3">
            <svg className="w-full h-auto max-h-[360px] select-none" viewBox="0 0 850 480">
              <path
                d="M 120,40 Q 150,180 180,260 T 170,450"
                fill="none"
                opacity="0.6"
                stroke="#1E293B"
                strokeDasharray="6,6"
                strokeWidth="8"
              />
              <text
                fill="#475569"
                fontSize="11"
                fontWeight="700"
                letterSpacing="3"
                transform="rotate(-90, 70, 240)"
                x="70"
                y="240"
              >
                SELAT MAKASSAR
              </text>

              {districts.map((d) => {
                const norm = normalizeName(d.name);
                const shape = DISTRICT_POLYGONS[norm];
                if (!shape) return null;

                const isSelected = activeDistrict?.id === d.id;
                const fill = getPolygonFill(d.pct, d.approved);

                if (shape.isIsland) {
                  return (
                    <g
                      key={d.id}
                      onClick={() => setSelectedId(d.id)}
                      className="cursor-pointer transition-opacity hover:opacity-90"
                    >
                      <circle
                        cx="95"
                        cy="90"
                        r="14"
                        fill={fill}
                        stroke={isSelected ? '#FBBF24' : '#FFFFFF'}
                        strokeWidth={isSelected ? 3 : 1.5}
                      />
                      <circle cx="115" cy="130" r="10" fill={fill} stroke="#FFFFFF" strokeWidth="1" />
                      <circle cx="80" cy="150" r="8" fill={fill} stroke="#FFFFFF" strokeWidth="1" />
                      <text fill="#CBD5E1" fontSize="10" fontWeight="700" x="55" y="68">
                        SANGKARRANG
                      </text>
                    </g>
                  );
                }

                return (
                  <g
                    key={d.id}
                    onClick={() => setSelectedId(d.id)}
                    className="cursor-pointer transition-all hover:opacity-95"
                  >
                    <polygon
                      points={shape.points}
                      fill={fill}
                      fillOpacity={isSelected ? 0.98 : 0.82}
                      stroke={isSelected ? '#FBBF24' : '#FFFFFF'}
                      strokeWidth={isSelected ? 3.5 : 1.5}
                    />
                    <text
                      fill="#FFFFFF"
                      fontSize={norm.length > 11 ? '10' : '11'}
                      fontWeight="800"
                      textAnchor="middle"
                      x={shape.labelX}
                      y={shape.labelY}
                    >
                      {norm}
                    </text>
                    <text
                      fill="#F8FAFC"
                      fontSize="9"
                      fontWeight="600"
                      textAnchor="middle"
                      x={shape.labelX}
                      y={shape.labelY + 14}
                    >
                      {d.approved}/{d.totalTps} TPS ({d.pct}%)
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {activeDistrict && (
            <div className="relative z-10 bg-slate-800/95 backdrop-blur-md border border-slate-700 p-3 rounded-xl flex items-center justify-between text-xs text-slate-300">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-rose-500" />
                <span>
                  <strong>Wilayah Aktif:</strong> KEC. {normalizeName(activeDistrict.name)} ({activeDistrict.kelurahanCount} Kelurahan)
                </span>
              </div>
              <span className="text-rose-400 font-bold">
                Target: {activeDistrict.targetVotes.toLocaleString('id-ID')} Suara
              </span>
            </div>
          )}
        </div>

        {/* Panel Intelijen Kecamatan Terpilih (4 Cols) */}
        <div className="lg:col-span-4 bg-slate-50/80 border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between">
          {activeDistrict ? (
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-rose-500 text-white flex items-center justify-center font-bold text-xs">
                    {DISTRICT_POLYGONS[normalizeName(activeDistrict.name)]?.code || 'MK'}
                  </div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    Kec. {normalizeName(activeDistrict.name)}
                  </h3>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                  {activeDistrict.kelurahanCount} Kel
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 my-4">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/70">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Target Suara</span>
                  <p className="text-lg font-extrabold text-slate-900 mt-0.5">
                    {activeDistrict.targetVotes.toLocaleString('id-ID')}
                  </p>
                  <span className="text-[10px] text-slate-500 font-medium">
                    DPT: {activeDistrict.totalDpt.toLocaleString('id-ID')}
                  </span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200/70">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Relawan Aktif</span>
                  <p className="text-lg font-extrabold text-rose-600 mt-0.5">
                    {activeDistrict.approved}
                  </p>
                  <span className="text-[10px] text-rose-600 font-semibold">
                    {activeDistrict.pct}% TPS Terisi
                  </span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200/70">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Jumlah TPS</span>
                  <p className="text-lg font-extrabold text-slate-900 mt-0.5">
                    {activeDistrict.totalTps}
                  </p>
                  <span className="text-[10px] text-emerald-600 font-semibold">TPS Terdaftar</span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200/70">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Antrean Pending</span>
                  <p className="text-lg font-extrabold text-amber-600 mt-0.5">
                    {activeDistrict.pending}
                  </p>
                  <span className="text-[10px] text-amber-600 font-semibold">Perlu Verifikasi</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200/70">
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1.5">
                  <span>Progres Keterisian Relawan TPS</span>
                  <span className="text-rose-600">{activeDistrict.pct}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-rose-500 to-indigo-600 h-full rounded-full transition-all"
                    style={{ width: `${activeDistrict.pct}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400">Memuat data kecamatan...</div>
          )}

          <Link
            href="/dashboard/wilayah"
            className="mt-5 w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2"
          >
            <span>Buka Rincian Kelurahan & Link Daftar</span>
            <span>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}