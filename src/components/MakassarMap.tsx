'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

export interface DistrictStat {
  id: string;
  name: string;
  kelurahanCount: number;
  loCount: number;
  totalTps: number;
  timTpsCount: number;
  routineVerifiedCount: number;
  souvenirCount: number;
  pct: number;
}

export interface VillageMapItem {
  id: string;
  district_id: string;
  name: string;
  total_tps: number;
  lat?: number | null;
  lng?: number | null;
}

export interface VolunteerMapItem {
  id: string;
  village_id: string;
  tps_number: number;
  full_name: string;
  met_candidate: boolean | null;
  lo_name?: string;
}

// Koordinat GPS 15 Kecamatan Kota Makassar
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

// Koordinat GPS Kelurahan Kota Makassar
const VILLAGE_GPS: Record<string, [number, number]> = {
  // Rappocini
  'MINASA UPA': [-5.1785, 119.4445], 'GUNUNG SARI': [-5.1762, 119.4325], 'TIDUNG': [-5.1645, 119.4362],
  'KASSI-KASSI': [-5.1682, 119.4448], 'BALLAPARANG': [-5.1615, 119.4295], 'BANTA-BANTAENG': [-5.1672, 119.4265],
  'BONTO MAKKIO': [-5.1628, 119.4332], 'BUAKANA': [-5.1578, 119.4368], 'KARUNRUNG': [-5.1735, 119.4485],
  'MAPPALA': [-5.1712, 119.4385], 'RAPPOCINI': [-5.1592, 119.4325],
  // Tamalate
  'PARANG TAMBUNG': [-5.1815, 119.4265], 'MANNURUKI': [-5.1795, 119.4312], 'MANGASA': [-5.1865, 119.4345],
  'PA\'BAENG-BAENG': [-5.1725, 119.4215], 'BONGAYA': [-5.1745, 119.4145], 'JONGAYA': [-5.1785, 119.4185],
  'BALANG BARU': [-5.1845, 119.4155], 'MACINI SOMBALA': [-5.1865, 119.4035], 'TANJUNG MERDEKA': [-5.1965, 119.3945],
  'BAROMBONG': [-5.2115, 119.3985], 'BONTODURI': [-5.1835, 119.4225],
  // Panakkukang
  'TAMAMAUNG': [-5.1485, 119.4425], 'KARUWISI': [-5.1415, 119.4435], 'KARUWISI UTARA': [-5.1375, 119.4445],
  'SINRIJALA': [-5.1455, 119.4385], 'PANDANG': [-5.1545, 119.4465], 'MASALE': [-5.1565, 119.4495],
  'PANAKKUKANG': [-5.1525, 119.4435], 'PAROPO': [-5.1595, 119.4485], 'TELLO BARU': [-5.1465, 119.4585],
  'PAMPANG': [-5.1395, 119.4525], 'PANAikang': [-5.1365, 119.4565],
  // Biringkanaya
  'SUDIANG': [-5.0845, 119.5285], 'SUDIANG RAYA': [-5.0965, 119.5195], 'PAI': [-5.0885, 119.5065],
  'DAYA': [-5.1065, 119.5045], 'PACERAKKANG': [-5.1145, 119.5245], 'BERUA': [-5.1125, 119.5115],
  'KATIMBANG': [-5.1045, 119.5325], 'BAKUNG': [-5.0785, 119.5145], 'BULUROKENG': [-5.0765, 119.4965],
  'UNTIA': [-5.0745, 119.4765], 'LAIKANG': [-5.0895, 119.5385],
  // Tamalanrea
  'TAMALANREA': [-5.1265, 119.4885], 'TAMALANREA INDAH': [-5.1355, 119.4845], 'TAMALANREA JAYA': [-5.1385, 119.4965],
  'KAPASA': [-5.1145, 119.4945], 'KAPASA RAYA': [-5.1185, 119.5015], 'BIRA': [-5.0985, 119.4785],
  'PARANG LOE': [-5.0925, 119.4685], 'BUNTUSU': [-5.1285, 119.5085],
  // Manggala
  'ANTANG': [-5.1645, 119.4785], 'BANGKALA': [-5.1785, 119.4785], 'BITOWA': [-5.1685, 119.4895],
  'BORONG': [-5.1625, 119.4625], 'MANGGALA': [-5.1745, 119.4945], 'TAMANGAPA': [-5.1845, 119.4965],
  'BATUA': [-5.1565, 119.4665], 'TODDOPULI': [-5.1615, 119.4545],
  // Tallo
  'TALLO': [-5.1065, 119.4425], 'RAPPOJAWA': [-5.1145, 119.4445], 'RAPPOCINI TALLO': [-5.1185, 119.4395],
  'KALUKU BODOA': [-5.1125, 119.4295], 'LEMU': [-5.1085, 119.4245], 'PANNAMPU': [-5.1165, 119.4265],
  'SUANGGA': [-5.1195, 119.4315], 'TAMAJENE': [-5.1225, 119.4345], 'WALA-WALAYA': [-5.1245, 119.4285],
  'BUNGA EJA BERU': [-5.1265, 119.4325], 'LA\'LATANG': [-5.1215, 119.4385], 'LOMPOE': [-5.1135, 119.4365],
  'BULOADING': [-5.1185, 119.4485], 'RAPPOKALLING': [-5.1245, 119.4465], 'UJUNG PANDANG BARU': [-5.1235, 119.4245],
  // Mariso
  'MARISO': [-5.1585, 119.4065], 'KUNJUNG MAE': [-5.1545, 119.4065], 'PANAMBUNGAN': [-5.1515, 119.4065],
  'MATTOANGIN': [-5.1625, 119.4085], 'BONTO RANU': [-5.1645, 119.4115], 'KAMPUNG BUYANG': [-5.1595, 119.4115],
  'LETTE': [-5.1565, 119.4115], 'MARIO': [-5.1535, 119.4115], 'TAMARUNANG': [-5.1615, 119.4135],
  // Mamajang
  'MAMAJANG DALAM': [-5.1585, 119.4185], 'MAMAJANG LUAR': [-5.1565, 119.4155], 'BONTO BIRAENG': [-5.1535, 119.4165],
  'BONTO LEBANG': [-5.1545, 119.4215], 'KARANG ANYAR': [-5.1625, 119.4175], 'LABUANG BAJI': [-5.1635, 119.4215],
  'MANDALA': [-5.1515, 119.4185], 'PA\'BATANG': [-5.1655, 119.4195], 'PARANG': [-5.1665, 119.4235],
  'SAMBUNG JAWA': [-5.1615, 119.4145], 'TAMPARANG KEKE': [-5.1595, 119.4235],
  // Makassar
  'BARA-BARAYA': [-5.1385, 119.4285], 'BARA-BARAYA SELATAN': [-5.1415, 119.4295], 'BARA-BARAYA TIMUR': [-5.1395, 119.4335],
  'BARA-BARAYA UTARA': [-5.1355, 119.4295], 'BARANA': [-5.1425, 119.4215], 'LARIANG BANGI': [-5.1395, 119.4215],
  'MACCINI': [-5.1425, 119.4335], 'MACCINI GUSUNG': [-5.1395, 119.4365], 'MACCINI PARANG': [-5.1445, 119.4355],
  'MARADEKAYA': [-5.1445, 119.4255], 'MARADEKAYA SELATAN': [-5.1475, 119.4255], 'MARADEKAYA UTARA': [-5.1415, 119.4255],
  'MARICAYA': [-5.1485, 119.4215], 'MARICAYA BARU': [-5.1505, 119.4255],
  // Ujung Pandang
  'LOSARI': [-5.1435, 119.4065], 'MALOKU': [-5.1465, 119.4075], 'MANGKURA': [-5.1485, 119.4115],
  'PISANG SELATAN': [-5.1465, 119.4135], 'PISANG UTARA': [-5.1425, 119.4135], 'SAWERIGADING': [-5.1405, 119.4115],
  'LAE-LAE': [-5.1365, 119.3895], 'BARU': [-5.1365, 119.4085], 'BULOGADING': [-5.1345, 119.4065],
  'LAJANGIRU': [-5.1385, 119.4155],
  // Wajo
  'BUTUNG': [-5.1245, 119.4115], 'ENDE': [-5.1265, 119.4135], 'MALIMONGAN': [-5.1215, 119.4145],
  'MALIMONGAN TUA': [-5.1195, 119.4165], 'MELAYU': [-5.1225, 119.4095], 'MELAYU BARU': [-5.1205, 119.4115],
  'MENDE': [-5.1285, 119.4095], 'PATTUNUANG': [-5.1305, 119.4115],
  // Bontoala
  'BONTOALA': [-5.1315, 119.4215], 'BONTOALA PARANG': [-5.1295, 119.4235], 'BONTOALA TUA': [-5.1335, 119.4225],
  'BUNGA EJAYA': [-5.1285, 119.4265], 'GADDONG': [-5.1345, 119.4175], 'LAYANG': [-5.1275, 119.4205],
  'MALIMONGAN BARU': [-5.1255, 119.4185], 'PARANG LAYANG': [-5.1265, 119.4235], 'TIMUNGAN LOMPOA': [-5.1325, 119.4195],
  'TOMPO BALANG': [-5.1345, 119.4265], 'WAJO BARU': [-5.1315, 119.4165], 'BARAYA': [-5.1295, 119.4285],
  // Ujung Tanah
  'CAMBA BERUA': [-5.1125, 119.4145], 'CAMBAYA': [-5.1095, 119.4165], 'GUSUNG': [-5.1145, 119.4125],
  'PATTIROANG': [-5.1115, 119.4185], 'PATTINGALLOANG': [-5.1085, 119.4205], 'PATTINGALLOANG BARU': [-5.1065, 119.4225],
  'TABARINGAN': [-5.1135, 119.4165], 'TAMALABBA': [-5.1155, 119.4145], 'TOTAKA': [-5.1105, 119.4115],
  // Kepulauan Sangkarrang
  'BARRANG CADDI': [-5.0815, 119.3225], 'BARRANG LOMPO': [-5.0485, 119.3275], 'KODINGARENG': [-5.1465, 119.2685],
};

function normalizeName(name: string): string {
  return name.toUpperCase().replace(/^KEC\.?\s*/i, '').replace(/^KEL\.?\s*/i, '').trim();
}

// Hitung titik koordinat kelurahan (dari DB -> kamus GPS -> sebaran deterministik sekitar kecamatan)
function getVillageCoords(
  village: VillageMapItem,
  districtName: string,
  indexInDistrict: number,
  totalInDistrict: number
): [number, number] {
  if (village.lat && village.lng) return [village.lat, village.lng];
  const normVill = normalizeName(village.name);
  if (VILLAGE_GPS[normVill]) return VILLAGE_GPS[normVill];

  const distGps = MAKASSAR_GPS[normalizeName(districtName)] || { lat: -5.145, lng: 119.445 };
  const angle = (indexInDistrict / Math.max(1, totalInDistrict)) * Math.PI * 2;
  const radius = 0.006 + (indexInDistrict % 3) * 0.0025;
  return [distGps.lat + Math.sin(angle) * radius, distGps.lng + Math.cos(angle) * radius];
}

// Sebarkan titik-titik TPS dalam pola grid melingkar di sekitar pusat kelurahan
function getTpsCoords(centerLat: number, centerLng: number, tpsNumber: number): [number, number] {
  const ring = Math.floor((tpsNumber - 1) / 8) + 1;
  const posInRing = (tpsNumber - 1) % 8;
  const angle = (posInRing / 8) * Math.PI * 2 + ring * 0.35;
  const radius = ring * 0.0012;
  return [centerLat + Math.sin(angle) * radius, centerLng + Math.cos(angle) * radius];
}

export default function MakassarMap({
  districts,
  villages = [],
  volunteers = [],
}: {
  districts: DistrictStat[];
  villages?: VillageMapItem[];
  volunteers?: VolunteerMapItem[];
}) {
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);
  const [selectedVillageId, setSelectedVillageId] = useState<string | null>(null);
  const [selectedTpsInfo, setSelectedTpsInfo] = useState<{
    tpsNumber: number;
    volunteer?: VolunteerMapItem;
  } | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);

  const selectedDistrict = useMemo(
    () => districts.find((d) => d.id === selectedDistrictId) || null,
    [districts, selectedDistrictId]
  );

  const selectedVillage = useMemo(
    () => villages.find((v) => v.id === selectedVillageId) || null,
    [villages, selectedVillageId]
  );

  const districtVillages = useMemo(() => {
    if (!selectedDistrictId) return [];
    return villages.filter((v) => v.district_id === selectedDistrictId);
  }, [villages, selectedDistrictId]);

  // Statistik per kelurahan
  const villageStatsMap = useMemo(() => {
    const map: Record<string, { official: number; waiting: number }> = {};
    volunteers.forEach((vol) => {
      if (!map[vol.village_id]) map[vol.village_id] = { official: 0, waiting: 0 };
      if (vol.met_candidate) map[vol.village_id].official += 1;
      else map[vol.village_id].waiting += 1;
    });
    return map;
  }, [volunteers]);

  // Inisialisasi Peta OpenStreetMap
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

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        markersLayerRef.current = L.layerGroup().addTo(map);
        mapInstanceRef.current = map;
      }

      renderMapLayer();
    }

    initMap();
    return () => {
      isMounted = false;
    };
  }, [districts, villages, volunteers]);

  useEffect(() => {
    renderMapLayer();
  }, [districts, villages, volunteers, selectedDistrictId, selectedVillageId, selectedTpsInfo]);

  const handleResetToCity = () => {
    setSelectedDistrictId(null);
    setSelectedVillageId(null);
    setSelectedTpsInfo(null);
    mapInstanceRef.current?.flyTo([-5.145, 119.445], 12, { duration: 0.6 });
  };

  const handleSelectDistrict = (d: DistrictStat) => {
    setSelectedDistrictId(d.id);
    setSelectedVillageId(null);
    setSelectedTpsInfo(null);
    const gps = MAKASSAR_GPS[normalizeName(d.name)];
    if (gps) {
      mapInstanceRef.current?.flyTo([gps.lat, gps.lng], 14, { duration: 0.6 });
    }
  };

  const handleSelectVillage = (v: VillageMapItem, lat: number, lng: number) => {
    setSelectedVillageId(v.id);
    setSelectedTpsInfo(null);
    mapInstanceRef.current?.flyTo([lat, lng], 16, { duration: 0.6 });
  };

  function renderMapLayer() {
    const L = (window as any).L;
    if (!L || !markersLayerRef.current) return;
    markersLayerRef.current.clearLayers();

    // LEVEL 3: TAMPILKAN SEBARAN TPS DI KELURAHAN TERPILIH
    if (selectedVillage && selectedDistrict) {
      const idx = districtVillages.findIndex((v) => v.id === selectedVillage.id);
      const [vLat, vLng] = getVillageCoords(
        selectedVillage,
        selectedDistrict.name,
        Math.max(0, idx),
        districtVillages.length
      );

      const villageVols = volunteers.filter((vol) => vol.village_id === selectedVillage.id);
      const volByTps: Record<number, VolunteerMapItem> = {};
      villageVols.forEach((vol) => {
        volByTps[vol.tps_number] = vol;
      });

      const totalTps = Math.max(1, selectedVillage.total_tps || 1);
      for (let tpsNum = 1; tpsNum <= totalTps; tpsNum++) {
        const [tLat, tLng] = getTpsCoords(vLat, vLng, tpsNum);
        const assigned = volByTps[tpsNum];
        const isOfficial = Boolean(assigned?.met_candidate);
        const isWaiting = Boolean(assigned && !assigned.met_candidate);
        const isSelectedTps = selectedTpsInfo?.tpsNumber === tpsNum;

        const bg = isOfficial ? '#10B981' : isWaiting ? '#F59E0B' : '#475569';
        const border = isSelectedTps ? '#F43F5E' : '#FFFFFF';

        const icon = L.divIcon({
          className: 'tps-marker-pin',
          html: `
            <div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;background:${bg};color:#fff;font-size:10px;font-weight:800;border:2.5px solid ${border};box-shadow:0 2px 6px rgba(0,0,0,0.4);cursor:pointer;">
              ${String(tpsNum).padStart(2, '0')}
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([tLat, tLng], { icon });
        marker.on('click', () => {
          setSelectedTpsInfo({ tpsNumber: tpsNum, volunteer: assigned });
        });
        marker.addTo(markersLayerRef.current);
      }
      return;
    }

    // LEVEL 2: TAMPILKAN DAFTAR KELURAHAN DI KECAMATAN TERPILIH
    if (selectedDistrict) {
      districtVillages.forEach((v, idx) => {
        const [vLat, vLng] = getVillageCoords(v, selectedDistrict.name, idx, districtVillages.length);
        const st = villageStatsMap[v.id] || { official: 0, waiting: 0 };
        const color = st.official > 0 ? '#6366F1' : st.waiting > 0 ? '#F59E0B' : '#0F172A';

        const icon = L.divIcon({
          className: 'village-marker-pin',
          html: `
            <div style="position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer;">
              <span style="width:16px;height:16px;border-radius:9999px;background:${color};border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.45);display:block;"></span>
              <span style="margin-top:3px;white-space:nowrap;background:rgba(15,23,42,0.92);color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);">
                KEL. ${normalizeName(v.name)} (${st.official}/${v.total_tps} TPS)
              </span>
            </div>
          `,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });

        const marker = L.marker([vLat, vLng], { icon });
        marker.on('click', () => handleSelectVillage(v, vLat, vLng));
        marker.addTo(markersLayerRef.current);
      });
      return;
    }

    // LEVEL 1: TAMPILKAN 15 KECAMATAN KOTA MAKASSAR
    districts.forEach((d) => {
      const norm = normalizeName(d.name);
      const gps = MAKASSAR_GPS[norm];
      if (!gps) return;

      const hasActivity = d.loCount > 0 || d.timTpsCount > 0;
      const color = d.pct >= 60 ? '#F43F5E' : hasActivity ? '#6366F1' : '#F59E0B';

      const icon = L.divIcon({
        className: 'district-marker-pin',
        html: `
          <div style="position:relative;display:flex;align-items:center;justify-content:center;width:18px;height:18px;cursor:pointer;">
            <span style="position:absolute;inset:-5px;border-radius:9999px;background:${color};opacity:0.28;"></span>
            <span style="position:relative;width:18px;height:18px;border-radius:9999px;background:${color};border:2.5px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.45);display:block;"></span>
            <span style="position:absolute;top:22px;white-space:nowrap;background:rgba(15,23,42,0.9);color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);">
              ${norm} (${d.timTpsCount}/${d.totalTps} TPS)
            </span>
          </div>
        `,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      const marker = L.marker([gps.lat, gps.lng], { icon });
      marker.on('click', () => handleSelectDistrict(d));
      marker.addTo(markersLayerRef.current);
    });
  }

  return (
    <section className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-sm">
      {/* Header Peta & Navigasi Breadcrumb 3 Level */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">Peta Interaktif Sebaran LO & TPS Makassar</h2>
            <span className="px-2 py-0.5 text-[11px] font-bold bg-indigo-50 text-indigo-600 rounded-md border border-indigo-100">
              {selectedVillage
                ? `Level 3: Sebaran TPS Kel. ${normalizeName(selectedVillage.name)}`
                : selectedDistrict
                ? `Level 2: Kelurahan di Kec. ${normalizeName(selectedDistrict.name)}`
                : 'Level 1: 15 Kecamatan Makassar'}
            </span>
          </div>

          {/* Breadcrumb Navigasi Klik Cepat */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold mt-2">
            <button
              onClick={handleResetToCity}
              className={`px-2.5 py-1 rounded-lg transition ${
                !selectedDistrict ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              🗺️ Kota Makassar
            </button>

            {selectedDistrict && (
              <>
                <span className="text-slate-400">›</span>
                <button
                  onClick={() => handleSelectDistrict(selectedDistrict)}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    !selectedVillage ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                  }`}
                >
                  Kec. {normalizeName(selectedDistrict.name)}
                </button>
              </>
            )}

            {selectedVillage && (
              <>
                <span className="text-slate-400">›</span>
                <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white">
                  Kel. {normalizeName(selectedVillage.name)} ({selectedVillage.total_tps} TPS)
                </span>
              </>
            )}
          </div>
        </div>

        {/* Legenda Dinamis Sesuai Level Peta */}
        {selectedVillage ? (
          <div className="flex flex-wrap items-center gap-3 px-3.5 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-[11px] font-semibold text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Resmi Tim
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Antrean Bertemu
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-600" /> TPS Kosong
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 px-3.5 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-[11px] font-semibold text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Kuat (≥60%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Terisi Tim
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Kosong (0%)
            </span>
          </div>
        )}
      </div>

      {/* Grid Peta & Panel Detail Kanan */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6 items-stretch">
        <div className="lg:col-span-8 rounded-2xl overflow-hidden border border-slate-200 relative min-h-[460px] z-10">
          <div ref={mapContainerRef} className="w-full h-full min-h-[460px]" />
        </div>

        {/* Panel Detail Dinamis di Sisi Kanan Peta */}
        <div className="lg:col-span-4 bg-slate-50/80 border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between">
          {/* LEVEL 3 PANEL: DETAIL KELURAHAN & TPS TERPILIH */}
          {selectedVillage && selectedDistrict ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <span className="text-[10px] font-bold uppercase text-indigo-600">
                    KEC. {normalizeName(selectedDistrict.name)}
                  </span>
                  <h3 className="font-extrabold text-base text-slate-900">
                    Kel. {normalizeName(selectedVillage.name)}
                  </h3>
                </div>
                <button
                  onClick={() => handleSelectDistrict(selectedDistrict)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200"
                >
                  ← Kembali
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-white p-3 rounded-xl border border-slate-200/70">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total TPS</span>
                  <p className="text-lg font-extrabold text-slate-900">{selectedVillage.total_tps} TPS</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200/70">
                  <span className="text-[10px] uppercase font-bold text-emerald-600">Tim Resmi</span>
                  <p className="text-lg font-extrabold text-emerald-600">
                    {villageStatsMap[selectedVillage.id]?.official || 0} TPS
                  </p>
                </div>
              </div>

              {/* Kotak Info Nomor TPS yang Diklik */}
              {selectedTpsInfo ? (
                <div className="bg-white p-4 rounded-xl border-2 border-indigo-200 shadow-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-indigo-700">
                      TPS {String(selectedTpsInfo.tpsNumber).padStart(3, '0')}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        selectedTpsInfo.volunteer?.met_candidate
                          ? 'bg-emerald-50 text-emerald-700'
                          : selectedTpsInfo.volunteer
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {selectedTpsInfo.volunteer?.met_candidate
                        ? '🤝 Resmi Tim'
                        : selectedTpsInfo.volunteer
                        ? '⏳ Antrean Bertemu'
                        : 'Belum Terisi'}
                    </span>
                  </div>
                  {selectedTpsInfo.volunteer ? (
                    <div className="text-xs text-slate-700 pt-1">
                      <div className="font-bold text-slate-900">{selectedTpsInfo.volunteer.full_name}</div>
                      <div className="text-[11px] text-slate-500">
                        LO: {selectedTpsInfo.volunteer.lo_name || '-'}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400">
                      Klik pin nomor TPS lain di peta untuk memeriksa petugasnya, atau tambahkan tim baru.
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-white p-3.5 rounded-xl border border-dashed border-slate-300 text-xs text-slate-500 text-center">
                  Klik salah satu <b>bulatan nomor TPS</b> di peta untuk melihat nama petugas & LO-nya.
                </div>
              )}

              {/* Daftar Cepat Nomor TPS */}
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase mb-2">
                  Status Seluruh TPS ({selectedVillage.total_tps}):
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {Array.from({ length: selectedVillage.total_tps || 0 }, (_, i) => i + 1).map((num) => {
                    const vol = volunteers.find(
                      (x) => x.village_id === selectedVillage.id && x.tps_number === num
                    );
                    const bg = vol?.met_candidate
                      ? 'bg-emerald-500 text-white'
                      : vol
                      ? 'bg-amber-400 text-slate-900'
                      : 'bg-slate-200 text-slate-600';
                    return (
                      <button
                        key={num}
                        onClick={() => setSelectedTpsInfo({ tpsNumber: num, volunteer: vol })}
                        className={`w-8 h-7 rounded-md text-[11px] font-bold ${bg}`}
                      >
                        {String(num).padStart(2, '0')}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : selectedDistrict ? (
            /* LEVEL 2 PANEL: DAFTAR KELURAHAN DI KECAMATAN TERPILIH */
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <span className="text-[10px] font-bold uppercase text-rose-600">Kecamatan Terpilih</span>
                  <h3 className="font-extrabold text-base text-slate-900">
                    Kec. {normalizeName(selectedDistrict.name)}
                  </h3>
                </div>
                <button
                  onClick={handleResetToCity}
                  className="text-xs font-bold text-slate-500 hover:text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200"
                >
                  ← Semua Kec
                </button>
              </div>

              <p className="text-[11px] text-slate-500">
                Klik salah satu kelurahan di bawah atau di peta untuk melihat titik sebaran TPS-nya:
              </p>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {districtVillages.map((v, idx) => {
                  const st = villageStatsMap[v.id] || { official: 0, waiting: 0 };
                  const [lat, lng] = getVillageCoords(v, selectedDistrict.name, idx, districtVillages.length);
                  return (
                    <button
                      key={v.id}
                      onClick={() => handleSelectVillage(v, lat, lng)}
                      className="w-full bg-white hover:bg-indigo-50/60 p-3 rounded-xl border border-slate-200/80 flex items-center justify-between text-left transition"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-900">KEL. {normalizeName(v.name)}</div>
                        <div className="text-[10px] text-slate-400">
                          {v.total_tps} TPS · Antrean: {st.waiting}
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-extrabold text-[11px]">
                        {st.official} / {v.total_tps} TPS →
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* LEVEL 1 PANEL: RINGKASAN KOTA MAKASSAR */
            <div className="space-y-3">
              <div className="pb-3 border-b border-slate-200">
                <h3 className="font-extrabold text-base text-slate-900">Pilih Kecamatan di Peta</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Klik titik kecamatan pada peta atau pilih dari daftar di bawah untuk zoom ke tingkat kelurahan & TPS.
                </p>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {districts.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => handleSelectDistrict(d)}
                    className="w-full bg-white hover:bg-rose-50/60 p-3 rounded-xl border border-slate-200/80 flex items-center justify-between text-left transition"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900">KEC. {normalizeName(d.name)}</div>
                      <div className="text-[10px] text-slate-400">
                        {d.kelurahanCount} Kel · {d.loCount} LO Bergerak
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-extrabold text-[11px]">
                      {d.timTpsCount} / {d.totalTps} TPS →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <Link
            href="/dashboard/tim-sukses"
            className="mt-4 w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2"
          >
            <span>+ Input Tim TPS Baru</span>
          </Link>
        </div>
      </div>
    </section>
  );
}