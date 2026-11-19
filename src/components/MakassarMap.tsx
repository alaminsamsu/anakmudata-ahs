'use client';

import React, { useEffect, useRef, useState } from 'react';
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

// Koordinat GPS Asli (Latitude, Longitude) 15 Kecamatan Kota Makassar
const MAKASSAR_GPS: Record<string, { lat: number; lng: number; code: string }> = {
  'KEPULAUAN SANGKARRANG': { lat: -5.0485, lng: 119.3275, code: '01' },
  'BIRINGKANAYA': { lat: -5.0982, lng: 119.5145, code: '02' },
  'TAMALANREA': { lat: -5.1325, lng: 119.4938, code: '03' },
  'MANGGALA': { lat: -5.1742, lng: 119.4865, code: '04' },
  'PANAKKUKANG': { lat: -5.1518, lng: 119.4485, code: '05' },
  'TALLO': { lat: -5.1154, lng: 119.4352, code: '06' },
  'UJUNG TANAH': { lat: -5.1112, lng: 119.4125, code: '07' },
  'WAJO': { lat: -5.1258, lng: 119.4105, code: '08' },
  'BONTOALA': { lat: -5.1312, lng: 119.4235, code: '09' },
  'MAKASSAR': { lat: -5.1445, lng: 119.4242, code: '10' },
  'UJUNG PANDANG': { lat: -5.1415, lng: 119.4085, code: '11' },
  'MARISO': { lat: -5.1585, lng: 119.4072, code: '12' },
  'MAMAJANG': { lat: -5.1612, lng: 119.4198, code: '13' },
  'RAPPOCINI': { lat: -5.1695, lng: 119.4368, code: '14' },
  'TAMALATE': { lat: -5.1885, lng: 119.4165, code: '15' },
};

function normalizeName(name: string): string {
  return name.toUpperCase().replace(/^KEC\.?\s*/i, '').trim();
}

export default function MakassarMap({ districts }: { districts: DistrictStat[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<'street' | 'satellite'>('street');
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);

  const activeDistrict =
    districts.find((d) => d.id === selectedId) ||
    districts.find((d) => normalizeName(d.name) === 'RAPPOCINI') ||
    districts[0] ||
    null;

  const getTileConfig = (style: 'street' | 'satellite') => {
    if (style === 'satellite') {
      return {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: '&copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
      };
    }
    return {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors',
    };
  };

  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (typeof window === 'undefined' || !mapContainerRef.current) return;

      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      if (!(window as any).L) {
        await new Promise<void>((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.onload = () => resolve();
          document.body.appendChild(script);
        });
      }

      if (!isMounted || !mapContainerRef.current) return;
      const L = (window as any).L;

      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [-5.145, 119.445],
          zoom: 12,
          zoomControl: true,
        });

        const cfg = getTileConfig(mapStyle);
        tileLayerRef.current = L.tileLayer(cfg.url, {
          attribution: cfg.attribution,
          maxZoom: 18,
        }).addTo(map);

        markersLayerRef.current = L.layerGroup().addTo(map);
        mapInstanceRef.current = map;
      }

      renderMarkers();
    }

    initMap();

    return () => {
      isMounted = false;
    };
  }, [districts]);

  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const cfg = getTileConfig(mapStyle);
    tileLayerRef.current.setUrl(cfg.url);
  }, [mapStyle]);

  useEffect(() => {
    renderMarkers();
  }, [districts, selectedId]);

  function renderMarkers() {
    const L = (window as any).L;
    if (!L || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();

    districts.forEach((d) => {
      const norm = normalizeName(d.name);
      const gps = MAKASSAR_GPS[norm];
      if (!gps) return;

      const isSelected = activeDistrict?.id === d.id;
      const color = d.pct >= 60 ? '#F43F5E' : d.approved > 0 ? '#6366F1' : '#F59E0B';
      const size = isSelected ? 22 : 16;

      const icon = L.divIcon({
        className: 'custom-district-pin',
        html: `
          <div style="position:relative;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;">
            <span style="position:absolute;inset:-6px;border-radius:9999px;background:${color};opacity:${isSelected ? '0.45' : '0.25'};"></span>
            <span style="position:relative;width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2.5px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.45);display:block;"></span>
            <span style="position:absolute;top:${size + 4}px;white-space:nowrap;background:rgba(15,23,42,0.9);color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);">
              ${norm} (${d.pct}%)
            </span>
          </div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([gps.lat, gps.lng], { icon });
      marker.on('click', () => {
        setSelectedId(d.id);
        mapInstanceRef.current?.flyTo([gps.lat, gps.lng], 13, { duration: 0.6 });
      });
      marker.addTo(markersLayerRef.current);
    });
  }

  return (
    <section className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-sm">
      {/* Header Peta */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">Peta Geografis Sebaran Kekuatan Makassar</h2>
            <span className="px-2 py-0.5 text-[11px] font-bold bg-indigo-50 text-indigo-600 rounded-md border border-indigo-100">
              GPS Live · {districts.length} Kecamatan
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Peta interaktif jalanan & satelit Kota Makassar. Klik titik kecamatan untuk memfokuskan wilayah.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Toggle Mode Peta Jalan vs Satelit */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setMapStyle('street')}
              className={`px-3 py-1.5 rounded-lg transition ${
                mapStyle === 'street' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600'
              }`}
            >
              Peta Jalan
            </button>
            <button
              onClick={() => setMapStyle('satellite')}
              className={`px-3 py-1.5 rounded-lg transition ${
                mapStyle === 'satellite' ? 'bg-slate-900 text-white font-bold' : 'text-slate-600'
              }`}
            >
              Mode Satelit
            </button>
          </div>

          {/* Legenda Warna */}
          <div className="hidden xl:flex items-center gap-3 px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-[11px] font-semibold text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Kuat (≥60%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Berjalan
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Kosong (0%)
            </span>
          </div>
        </div>
      </div>

      {/* Grid Peta & Panel Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6 items-stretch">
        {/* Kanvas Peta Leaflet Asli (8 Cols) */}
        <div className="lg:col-span-8 rounded-2xl overflow-hidden border border-slate-200 relative min-h-[450px] z-10">
          <div ref={mapContainerRef} className="w-full h-full min-h-[450px]" />
        </div>

        {/* Panel Intelijen Kecamatan Terpilih (4 Cols) */}
        <div className="lg:col-span-4 bg-slate-50/80 border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between">
          {activeDistrict ? (
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-rose-500 text-white flex items-center justify-center font-bold text-xs">
                    {MAKASSAR_GPS[normalizeName(activeDistrict.name)]?.code || 'MK'}
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