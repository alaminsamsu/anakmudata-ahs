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

// Koordinat GPS Presisi Pusat 15 Kecamatan Kota Makassar
const MAKASSAR_GPS: Record<string, { lat: number; lng: number; code: string }> = {
  'KEPULAUAN SANGKARRANG': { lat: -5.0478, lng: 119.3278, code: '01' },
  'BIRINGKANAYA': { lat: -5.0975, lng: 119.5142, code: '02' },
  'TAMALANREA': { lat: -5.1332, lng: 119.4935, code: '03' },
  'MANGGALA': { lat: -5.1715, lng: 119.4835, code: '04' },
  'PANAKKUKANG': { lat: -5.1495, lng: 119.4465, code: '05' },
  'TALLO': { lat: -5.1165, lng: 119.4345, code: '06' },
  'UJUNG TANAH': { lat: -5.1118, lng: 119.4152, code: '07' },
  'WAJO': { lat: -5.1255, lng: 119.4112, code: '08' },
  'BONTOALA': { lat: -5.1305, lng: 119.4225, code: '09' },
  'MAKASSAR': { lat: -5.1435, lng: 119.4275, code: '10' },
  'UJUNG PANDANG': { lat: -5.1412, lng: 119.4105, code: '11' },
  'MARISO': { lat: -5.1582, lng: 119.4092, code: '12' },
  'MAMAJANG': { lat: -5.1595, lng: 119.4192, code: '13' },
  'RAPPOCINI': { lat: -5.1678, lng: 119.4365, code: '14' },
  'TAMALATE': { lat: -5.1845, lng: 119.4185, code: '15' },
};

// Kamus Koordinat GPS Presisi 153 Kelurahan Kota Makassar
const VILLAGE_GPS: Record<string, [number, number]> = {
  // 1. KECAMATAN RAPPOCINI
  'MINASA UPA': [-5.1812, 119.4438],
  'GUNUNG SARI': [-5.1768, 119.4328],
  'TIDUNG': [-5.1638, 119.4368],
  'KASSI-KASSI': [-5.1688, 119.4452],
  'BALLAPARANG': [-5.1612, 119.4292],
  'BANTA-BANTAENG': [-5.1668, 119.4268],
  'BONTO MAKKIO': [-5.1632, 119.4335],
  'BUAKANA': [-5.1572, 119.4365],
  'KARUNRUNG': [-5.1742, 119.4492],
  'MAPPALA': [-5.1715, 119.4388],
  'RAPPOCINI': [-5.1588, 119.4322],

  // 2. KECAMATAN TAMALATE
  'PARANG TAMBUNG': [-5.1818, 119.4268],
  'MANNURUKI': [-5.1788, 119.4308],
  'MANGASA': [-5.1868, 119.4342],
  'PA\'BAENG-BAENG': [-5.1718, 119.4218],
  'PABAENG-BAENG': [-5.1718, 119.4218],
  'BONGAYA': [-5.1738, 119.4148],
  'JONGAYA': [-5.1778, 119.4188],
  'BALANG BARU': [-5.1842, 119.4152],
  'MACINI SOMBALA': [-5.1858, 119.4038],
  'MACCINI SOMBALA': [-5.1858, 119.4038],
  'TANJUNG MERDEKA': [-5.1955, 119.3948],
  'BAROMBONG': [-5.2112, 119.3992],
  'BONTODURI': [-5.1828, 119.4222],

  // 3. KECAMATAN PANAKKUKANG
  'TAMAMAUNG': [-5.1482, 119.4422],
  'KARUWISI': [-5.1412, 119.4432],
  'KARUWISI UTARA': [-5.1372, 119.4442],
  'SINRIJALA': [-5.1452, 119.4382],
  'PANDANG': [-5.1542, 119.4462],
  'MASALE': [-5.1562, 119.4492],
  'PANAKKUKANG': [-5.1522, 119.4432],
  'PAROPO': [-5.1592, 119.4482],
  'TELLO BARU': [-5.1462, 119.4582],
  'PAMPANG': [-5.1392, 119.4522],
  'PANAIKANG': [-5.1362, 119.4562],

  // 4. KECAMATAN BIRINGKANAYA
  'SUDIANG': [-5.0842, 119.5282],
  'SUDIANG RAYA': [-5.0962, 119.5192],
  'PAI': [-5.0882, 119.5062],
  'DAYA': [-5.1062, 119.5042],
  'PACERAKKANG': [-5.1142, 119.5242],
  'BERUA': [-5.1122, 119.5112],
  'KATIMBANG': [-5.1042, 119.5322],
  'BAKUNG': [-5.0782, 119.5142],
  'BULUROKENG': [-5.0762, 119.4962],
  'UNTIA': [-5.0742, 119.4768],
  'LAIKANG': [-5.0892, 119.5382],

  // 5. KECAMATAN TAMALANREA
  'TAMALANREA': [-5.1262, 119.4882],
  'TAMALANREA INDAH': [-5.1352, 119.4842],
  'TAMALANREA JAYA': [-5.1382, 119.4962],
  'KAPASA': [-5.1142, 119.4942],
  'KAPASA RAYA': [-5.1182, 119.5012],
  'BIRA': [-5.0982, 119.4782],
  'PARANG LOE': [-5.0922, 119.4682],
  'BUNTUSU': [-5.1282, 119.5082],

  // 6. KECAMATAN MANGGALA
  'ANTANG': [-5.1642, 119.4782],
  'BANGKALA': [-5.1782, 119.4782],
  'BITOWA': [-5.1682, 119.4892],
  'BORONG': [-5.1622, 119.4622],
  'MANGGALA': [-5.1742, 119.4942],
  'TAMANGAPA': [-5.1842, 119.4962],
  'BATUA': [-5.1562, 119.4662],
  'TODDOPULI': [-5.1612, 119.4542],

  // 7. KECAMATAN TALLO
  'TALLO': [-5.1068, 119.4422],
  'RAPPOJAWA': [-5.1148, 119.4442],
  'RAPPOCINI TALLO': [-5.1188, 119.4392],
  'KALUKU BODOA': [-5.1128, 119.4292],
  'LEMU': [-5.1088, 119.4242],
  'LEMBO': [-5.1218, 119.4272],
  'PANNAMPU': [-5.1168, 119.4262],
  'SUANGGA': [-5.1198, 119.4312],
  'TAMAJENE': [-5.1228, 119.4342],
  'WALA-WALAYA': [-5.1248, 119.4282],
  'BUNGA EJA BERU': [-5.1268, 119.4322],
  'LA\'LATANG': [-5.1212, 119.4382],
  'LALATANG': [-5.1212, 119.4382],
  'LOMPOE': [-5.1138, 119.4362],
  'BULOADING': [-5.1182, 119.4482],
  'RAPPOKALLING': [-5.1242, 119.4462],
  'UJUNG PANDANG BARU': [-5.1238, 119.4242],

  // 8. KECAMATAN MARISO
  'MARISO': [-5.1582, 119.4068],
  'KUNJUNG MAE': [-5.1542, 119.4068],
  'PANAMBUNGAN': [-5.1512, 119.4068],
  'MATTOANGIN': [-5.1622, 119.4088],
  'BONTO RANU': [-5.1642, 119.4118],
  'KAMPUNG BUYANG': [-5.1592, 119.4118],
  'LETTE': [-5.1562, 119.4118],
  'MARIO': [-5.1532, 119.4118],
  'TAMARUNANG': [-5.1612, 119.4138],

  // 9. KECAMATAN MAMAJANG
  'MAMAJANG DALAM': [-5.1582, 119.4188],
  'MAMAJANG LUAR': [-5.1562, 119.4158],
  'BONTO BIRAENG': [-5.1532, 119.4168],
  'BONTO LEBANG': [-5.1542, 119.4218],
  'KARANG ANYAR': [-5.1622, 119.4178],
  'LABUANG BAJI': [-5.1632, 119.4218],
  'MANDALA': [-5.1512, 119.4188],
  'PA\'BATANG': [-5.1652, 119.4198],
  'PABATANG': [-5.1652, 119.4198],
  'PARANG': [-5.1662, 119.4238],
  'SAMBUNG JAWA': [-5.1612, 119.4148],
  'TAMPARANG KEKE': [-5.1592, 119.4238],
  'BAJI MAPPAKASUNGGU': [-5.1552, 119.4138],
  'KARUNRUNG MAMAJANG': [-5.1572, 119.4218],

  // 10. KECAMATAN MAKASSAR
  'BARA-BARAYA': [-5.1382, 119.4288],
  'BARA-BARAYA SELATAN': [-5.1412, 119.4298],
  'BARA-BARAYA TIMUR': [-5.1392, 119.4338],
  'BARA-BARAYA UTARA': [-5.1352, 119.4298],
  'BARANA': [-5.1422, 119.4218],
  'LARIANG BANGI': [-5.1392, 119.4218],
  'MACCINI': [-5.1422, 119.4338],
  'MACCINI GUSUNG': [-5.1392, 119.4368],
  'MACCINI PARANG': [-5.1442, 119.4358],
  'MARADEKAYA': [-5.1442, 119.4258],
  'MARADEKAYA SELATAN': [-5.1472, 119.4258],
  'MARADEKAYA UTARA': [-5.1412, 119.4258],
  'MARICAYA': [-5.1482, 119.4218],
  'MARICAYA BARU': [-5.1502, 119.4258],

  // 11. KECAMATAN UJUNG PANDANG
  'LOSARI': [-5.1432, 119.4068],
  'MALOKU': [-5.1462, 119.4078],
  'MANGKURA': [-5.1482, 119.4118],
  'PISANG SELATAN': [-5.1462, 119.4138],
  'PISANG UTARA': [-5.1422, 119.4138],
  'SAWERIGADING': [-5.1402, 119.4118],
  'LAE-LAE': [-5.1362, 119.3898],
  'BARU': [-5.1362, 119.4088],
  'BULOGADING': [-5.1342, 119.4068],
  'LAJANGIRU': [-5.1382, 119.4158],

  // 12. KECAMATAN WAJO
  'BUTUNG': [-5.1242, 119.4118],
  'ENDE': [-5.1262, 119.4138],
  'MALIMONGAN': [-5.1212, 119.4148],
  'MALIMONGAN TUA': [-5.1192, 119.4168],
  'MELAYU': [-5.1222, 119.4098],
  'MELAYU BARU': [-5.1202, 119.4118],
  'MENDE': [-5.1282, 119.4098],
  'PATTUNUANG': [-5.1302, 119.4118],

  // 13. KECAMATAN BONTOALA
  'BONTOALA': [-5.1312, 119.4218],
  'BONTOALA PARANG': [-5.1292, 119.4238],
  'BONTOALA TUA': [-5.1332, 119.4228],
  'BUNGA EJAYA': [-5.1282, 119.4268],
  'GADDONG': [-5.1342, 119.4178],
  'LAYANG': [-5.1272, 119.4208],
  'MALIMONGAN BARU': [-5.1252, 119.4188],
  'PARANG LAYANG': [-5.1262, 119.4238],
  'TIMUNGAN LOMPOA': [-5.1322, 119.4198],
  'TOMPO BALANG': [-5.1342, 119.4268],
  'WAJO BARU': [-5.1312, 119.4168],
  'BARAYA': [-5.1292, 119.4288],

  // 14. KECAMATAN UJUNG TANAH
  'CAMBA BERUA': [-5.1122, 119.4148],
  'CAMBAYA': [-5.1092, 119.4168],
  'GUSUNG': [-5.1142, 119.4128],
  'PATTIROANG': [-5.1112, 119.4188],
  'PATTINGALLOANG': [-5.1082, 119.4208],
  'PATTINGALLOANG BARU': [-5.1062, 119.4228],
  'TABARINGAN': [-5.1132, 119.4168],
  'TAMALABBA': [-5.1152, 119.4148],
  'TOTAKA': [-5.1102, 119.4118],

  // 15. KECAMATAN KEPULAUAN SANGKARRANG
  'BARRANG CADDI': [-5.0812, 119.3228],
  'BARRANG LOMPO': [-5.0482, 119.3278],
  'KODINGARENG': [-5.1462, 119.2688],
};

function normalizeName(name: string): string {
  return name
    .toUpperCase()
    .replace(/^KEC\.?\s*/i, '')
    .replace(/^KEL\.?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getVillageCoords(
  village: VillageMapItem,
  districtName: string,
  indexInDistrict: number,
  totalInDistrict: number
): [number, number] {
  if (village.lat && village.lng) return [village.lat, village.lng];

  const normVill = normalizeName(village.name);
  if (VILLAGE_GPS[normVill]) return VILLAGE_GPS[normVill];

  const fuzzyKey = Object.keys(VILLAGE_GPS).find(
    (k) => k.replace(/[^A-Z]/g, '') === normVill.replace(/[^A-Z]/g, '')
  );
  if (fuzzyKey) return VILLAGE_GPS[fuzzyKey];

  const distGps = MAKASSAR_GPS[normalizeName(districtName)] || { lat: -5.145, lng: 119.445 };
  const angle = (indexInDistrict / Math.max(1, totalInDistrict)) * Math.PI * 2;
  const radius = 0.004 + (indexInDistrict % 3) * 0.0015;
  return [distGps.lat + Math.sin(angle) * radius, distGps.lng + Math.cos(angle) * radius];
}

function getTpsCoords(centerLat: number, centerLng: number, tpsNumber: number): [number, number] {
  const ring = Math.floor((tpsNumber - 1) / 8) + 1;
  const posInRing = (tpsNumber - 1) % 8;
  const angle = (posInRing / 8) * Math.PI * 2 + ring * 0.4;
  const radius = ring * 0.0006;
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

  const villageStatsMap = useMemo(() => {
    const map: Record<string, { official: number; waiting: number }> = {};
    volunteers.forEach((vol) => {
      if (!map[vol.village_id]) map[vol.village_id] = { official: 0, waiting: 0 };
      if (vol.met_candidate) map[vol.village_id].official += 1;
      else map[vol.village_id].waiting += 1;
    });
    return map;
  }, [volunteers]);

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
          center: [-5.142, 119.442],
          zoom: 12,
          zoomControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        markersLayerRef.current = L.layerGroup().addTo(map);
        mapInstanceRef.current = map;

        setTimeout(() => {
          map.invalidateSize();
        }, 250);
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
    mapInstanceRef.current?.flyTo([-5.142, 119.442], 12, { duration: 0.6 });
  };

  const handleSelectDistrict = (d: DistrictStat) => {
    setSelectedDistrictId(d.id);
    setSelectedVillageId(null);
    setSelectedTpsInfo(null);

    const L = (window as any).L;
    const distVills = villages.filter((v) => v.district_id === d.id);

    if (L && mapInstanceRef.current && distVills.length > 0) {
      const coords = distVills.map((v, idx) => getVillageCoords(v, d.name, idx, distVills.length));
      const bounds = L.latLngBounds(coords);
      mapInstanceRef.current.flyToBounds(bounds, { padding: [55, 55], maxZoom: 15, duration: 0.6 });
    } else {
      const gps = MAKASSAR_GPS[normalizeName(d.name)];
      if (gps) {
        mapInstanceRef.current?.flyTo([gps.lat, gps.lng], 14, { duration: 0.6 });
      }
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

    // LEVEL 3: SEBARAN TPS DI KELURAHAN TERPILIH
    if (selectedVillage && selectedDistrict) {
      const idx = districtVillages.findIndex((v) => v.id === selectedVillage.id);
      const [vLat, vLng] = getVillageCoords(
        selectedVillage,
        selectedDistrict.name,
        Math.max(0, idx),
        districtVillages.length
      );

      const centerPin = L.divIcon({
        className: 'village-center-badge',
        html: `<div style="background:rgba(15,23,42,0.88);color:#fff;font-size:10px;font-weight:800;padding:3px 8px;border-radius:9999px;border:1.5px solid #fff;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.3);">📍 KEL. ${normalizeName(selectedVillage.name)}</div>`,
        iconSize: [120, 22],
        iconAnchor: [60, 11],
      });
      L.marker([vLat, vLng], { icon: centerPin }).addTo(markersLayerRef.current);

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
            <div style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:9999px;background:${bg};color:#fff;font-size:10px;font-weight:800;border:2px solid ${border};box-shadow:0 2px 6px rgba(0,0,0,0.4);cursor:pointer;">
              ${String(tpsNum).padStart(2, '0')}
            </div>
          `,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });

        const marker = L.marker([tLat, tLng], { icon });
        marker.on('click', () => {
          setSelectedTpsInfo({ tpsNumber: tpsNum, volunteer: assigned });
        });
        marker.addTo(markersLayerRef.current);
      }
      return;
    }

    // LEVEL 2: KELURAHAN DI KECAMATAN TERPILIH
    if (selectedDistrict) {
      districtVillages.forEach((v, idx) => {
        const [vLat, vLng] = getVillageCoords(v, selectedDistrict.name, idx, districtVillages.length);
        const st = villageStatsMap[v.id] || { official: 0, waiting: 0 };
        const color = st.official > 0 ? '#6366F1' : st.waiting > 0 ? '#F59E0B' : '#0F172A';

        const icon = L.divIcon({
          className: 'village-marker-pin',
          html: `
            <div style="position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer;">
              <span style="width:15px;height:15px;border-radius:9999px;background:${color};border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.45);display:block;"></span>
              <span style="margin-top:3px;white-space:nowrap;background:rgba(15,23,42,0.92);color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);">
                ${normalizeName(v.name)} (${st.official}/${v.total_tps})
              </span>
            </div>
          `,
          iconSize: [15, 15],
          iconAnchor: [7.5, 7.5],
        });

        const marker = L.marker([vLat, vLng], { icon });
        marker.on('click', () => handleSelectVillage(v, vLat, vLng));
        marker.addTo(markersLayerRef.current);
      });
      return;
    }

    // LEVEL 1: 15 KECAMATAN KOTA MAKASSAR
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
    <section className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-sm space-y-6">
      {/* Header Peta & Breadcrumb Navigasi */}
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

        <div className="flex flex-wrap items-center gap-3">
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

          <Link
            href="/dashboard/tim-sukses"
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition"
          >
            + Input Tim TPS
          </Link>
        </div>
      </div>

      {/* KANVAS PETA FULL-WIDTH (LEBAR PENUH) */}
      <div className="w-full rounded-2xl overflow-hidden border border-slate-200 relative h-[520px] z-10">
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

      {/* PANEL NAVIGASI & DETAIL WILAYAH DI BAWAH PETA */}
      <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-5 md:p-6">
        {selectedVillage && selectedDistrict ? (
          /* LEVEL 3 PANEL (DI BAWAH PETA): DETAIL KELURAHAN & STATUS SELURUH NOMOR TPS */
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-bold uppercase text-indigo-600">
                  KEC. {normalizeName(selectedDistrict.name)}
                </span>
                <h3 className="font-extrabold text-base text-slate-900">
                  Sebaran TPS — Kel. {normalizeName(selectedVillage.name)} ({villageStatsMap[selectedVillage.id]?.official || 0} / {selectedVillage.total_tps} TPS Resmi)
                </h3>
              </div>

              <button
                onClick={() => handleSelectDistrict(selectedDistrict)}
                className="text-xs font-bold text-slate-700 hover:text-slate-900 bg-white px-3.5 py-2 rounded-xl border border-slate-200 self-start sm:self-auto"
              >
                ← Kembali ke Daftar Kelurahan
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* Kotak Detail TPS Terpilih */}
              <div className="lg:col-span-4 bg-white p-4 rounded-xl border border-slate-200">
                {selectedTpsInfo ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-extrabold text-indigo-700">
                        TPS {String(selectedTpsInfo.tpsNumber).padStart(3, '0')}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
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
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          LO Perekrut: <b>{selectedTpsInfo.volunteer.lo_name || '-'}</b>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 pt-1">
                        TPS ini belum memiliki petugas. Klik bulatan nomor TPS lain di samping untuk mengecek.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 py-2">
                    Klik salah satu <b>nomor TPS</b> di peta atau di kotak samping untuk melihat nama petugas & LO-nya.
                  </div>
                )}
              </div>

              {/* Grid Seluruh Nomor TPS Kelurahan */}
              <div className="lg:col-span-8 bg-white p-4 rounded-xl border border-slate-200">
                <p className="text-[11px] font-bold text-slate-400 uppercase mb-2.5">
                  Pilih Nomor TPS ({selectedVillage.total_tps} TPS):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: selectedVillage.total_tps || 0 }, (_, i) => i + 1).map((num) => {
                    const vol = volunteers.find(
                      (x) => x.village_id === selectedVillage.id && x.tps_number === num
                    );
                    const bg = vol?.met_candidate
                      ? 'bg-emerald-500 text-white'
                      : vol
                      ? 'bg-amber-400 text-slate-900'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200';
                    return (
                      <button
                        key={num}
                        onClick={() => setSelectedTpsInfo({ tpsNumber: num, volunteer: vol })}
                        className={`w-9 h-8 rounded-lg text-xs font-bold transition ${bg}`}
                      >
                        {String(num).padStart(2, '0')}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : selectedDistrict ? (
          /* LEVEL 2 PANEL (DI BAWAH PETA): GRID KELURAHAN DI KECAMATAN TERPILIH */
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-bold uppercase text-rose-600">Kecamatan Terpilih</span>
                <h3 className="font-extrabold text-base text-slate-900">
                  Pilih Kelurahan di Kec. {normalizeName(selectedDistrict.name)} ({districtVillages.length} Kelurahan)
                </h3>
              </div>
              <button
                onClick={handleResetToCity}
                className="text-xs font-bold text-slate-700 hover:text-slate-900 bg-white px-3.5 py-2 rounded-xl border border-slate-200 self-start sm:self-auto"
              >
                ← Kembali ke 15 Kecamatan
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {districtVillages.map((v, idx) => {
                const st = villageStatsMap[v.id] || { official: 0, waiting: 0 };
                const [lat, lng] = getVillageCoords(v, selectedDistrict.name, idx, districtVillages.length);
                return (
                  <button
                    key={v.id}
                    onClick={() => handleSelectVillage(v, lat, lng)}
                    className="bg-white hover:bg-indigo-50/70 p-3.5 rounded-xl border border-slate-200/80 flex items-center justify-between text-left transition shadow-2xs"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-bold text-slate-900 truncate">KEL. {normalizeName(v.name)}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {v.total_tps} TPS · Antrean: {st.waiting}
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-extrabold text-[11px] shrink-0">
                      {st.official}/{v.total_tps} →
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* LEVEL 1 PANEL (DI BAWAH PETA): GRID 15 KECAMATAN KOTA MAKASSAR */
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Pilih Kecamatan Kota Makassar</h3>
                <p className="text-xs text-slate-500">
                  Klik titik kecamatan pada peta atau pilih salah satu kartu kecamatan di bawah untuk zoom ke tingkat kelurahan & TPS.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {districts.map((d) => (
                <button
                  key={d.id}
                  onClick={() => handleSelectDistrict(d)}
                  className="bg-white hover:bg-rose-50/70 p-3.5 rounded-xl border border-slate-200/80 flex flex-col justify-between text-left transition shadow-2xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-slate-900 truncate">
                      {normalizeName(d.name)}
                    </span>
                    <span className="text-rose-600 font-bold text-xs">→</span>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px]">
                    <span className="text-slate-400 font-medium">{d.kelurahanCount} Kel</span>
                    <span className="font-extrabold text-indigo-600">
                      {d.timTpsCount}/{d.totalTps} TPS
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}