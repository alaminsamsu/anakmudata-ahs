'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
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
  address?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  lo_id: string | null;
  met_candidate: boolean | null;
  met_candidate_at: string | null;
  last_routine_verified_at: string | null;
  created_at: string;
}

interface ActivityLogRow {
  id: string;
  volunteer_id: string;
  activity_type: 'MEETING' | 'ITEM' | 'PROGRAM';
  activity_title: string;
  activity_date: string;
  notes: string | null;
  photo_url?: string | null;
}

interface VolunteerFrequency {
  meetingCount: number;
  itemCount: number;
  programCount: number;
}

interface DptSearchResult {
  id: string;
  district_id: string;
  village_id: string;
  tps_number: number;
  full_name: string;
  gender: string | null;
  age: number | null;
  rt: string | null;
  rw: string | null;
}

const MAX_INLINE_DATA_URL_CHARS = 160000;

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildWaLink(rawPhone: string | null | undefined, message?: string): string | null {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  if (!digits || digits.length < 8) return null;

  let normalized = digits;
  if (normalized.startsWith('0')) {
    normalized = '62' + normalized.slice(1);
  } else if (!normalized.startsWith('62')) {
    normalized = '62' + normalized;
  }

  const baseUrl = `https://wa.me/${normalized}`;
  return message ? `${baseUrl}?text=${encodeURIComponent(message)}` : baseUrl;
}

async function compressInlinePhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let maxDim = 480;
      let quality = 0.5;

      const renderAttempt = (): string => {
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.max(1, Math.round((height * maxDim) / width));
            width = maxDim;
          } else {
            width = Math.max(1, Math.round((width * maxDim) / height));
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Canvas tidak didukung di browser ini.');
        }

        ctx.drawImage(img, 0, 0, width, height);
        return canvas.toDataURL('image/jpeg', quality);
      };

      try {
        let dataUrl = renderAttempt();
        while (dataUrl.length > MAX_INLINE_DATA_URL_CHARS && (quality > 0.3 || maxDim > 320)) {
          if (quality > 0.3) {
            quality = Math.max(0.3, Number((quality - 0.1).toFixed(2)));
          } else {
            maxDim = Math.max(320, maxDim - 80);
            quality = 0.45;
          }
          dataUrl = renderAttempt();
        }
        resolve(dataUrl);
      } catch (err: any) {
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('File gambar tidak valid.'));
    };

    img.src = objectUrl;
  });
}

export default function LoDetailPage() {
  const params = useParams();
  const loId = String(params?.id || '');

  const [loData, setLoData] = useState<FieldLo | null>(null);
  const [districts, setDistricts] = useState<District[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [filterMeeting, setFilterMeeting] = useState<'ALL' | 'MET' | 'WAITING'>('ALL');
  const [filterVillage, setFilterVillage] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [showTpsModal, setShowTpsModal] = useState<boolean>(false);
  const [dptSearchInput, setDptSearchInput] = useState('');
  const [dptSearchDistrict, setDptSearchDistrict] = useState<string>('ALL');
  const [dptResults, setDptResults] = useState<DptSearchResult[]>([]);
  const [searchingDpt, setSearchingDpt] = useState(false);
  const [selectedDptBadge, setSelectedDptBadge] = useState<string>('');
  const searchReqIdRef = useRef<number>(0);

  const [tpsNik, setTpsNik] = useState('');
  const [tpsName, setTpsName] = useState('');
  const [tpsWa, setTpsWa] = useState('');
  const [tpsAddress, setTpsAddress] = useState('');
  const [tpsDistrictId, setTpsDistrictId] = useState('');
  const [tpsVillageId, setTpsVillageId] = useState('');
  const [tpsNumber, setTpsNumber] = useState('1');
  const [tpsMetNow, setTpsMetNow] = useState<boolean>(false);
  const [savingTps, setSavingTps] = useState(false);

  const [activeFreqVolunteer, setActiveFreqVolunteer] = useState<Volunteer | null>(null);
  const [freqType, setFreqType] = useState<'MEETING' | 'ITEM' | 'PROGRAM'>('MEETING');
  const [freqTitle, setFreqTitle] = useState<string>('');
  const [freqDate, setFreqDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [freqNotes, setFreqNotes] = useState<string>('');
  const [compressedPhotoDataUrl, setCompressedPhotoDataUrl] = useState<string>('');
  const [photoInfoText, setPhotoInfoText] = useState<string>('');
  const [savingFreq, setSavingFreq] = useState<boolean>(false);

  useEffect(() => {
    if (loId) fetchLoDetail();
  }, [loId]);

  async function fetchLoDetail() {
    setLoading(true);
    const [loRes, distRes, villRes, volRes] = await Promise.all([
      supabase.from('field_los').select('*').eq('id', loId).single(),
      supabase.from('districts').select('id, name').order('name'),
      supabase.from('villages').select('id, district_id, name, total_tps').order('name'),
      supabase
        .from('volunteers')
        .select('*')
        .eq('lo_id', loId)
        .order('created_at', { ascending: false }),
    ]);

    if (loRes.data) setLoData(loRes.data as FieldLo);
    if (distRes.data) {
      setDistricts(distRes.data);
      if (distRes.data.length > 0 && !tpsDistrictId) {
        setTpsDistrictId(distRes.data[0].id);
      }
    }
    if (villRes.data) setVillages(villRes.data);

    const loVols = (volRes.data || []) as Volunteer[];
    setVolunteers(loVols);

    if (loVols.length > 0) {
      const volIds = loVols.map((v) => v.id);
      const { data: logs } = await supabase
        .from('tps_team_activities')
        .select('id, volunteer_id, activity_type, activity_title, activity_date, notes, photo_url')
        .in('volunteer_id', volIds)
        .order('activity_date', { ascending: false })
        .limit(1000);

      setActivityLogs((logs as ActivityLogRow[]) || []);
    } else {
      setActivityLogs([]);
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

  const frequencyByVolunteer = useMemo(() => {
    const map: Record<string, VolunteerFrequency> = {};
    activityLogs.forEach((log) => {
      const vId = String(log.volunteer_id);
      if (!map[vId]) {
        map[vId] = { meetingCount: 0, itemCount: 0, programCount: 0 };
      }
      if (log.activity_type === 'MEETING') map[vId].meetingCount += 1;
      if (log.activity_type === 'ITEM') map[vId].itemCount += 1;
      if (log.activity_type === 'PROGRAM') map[vId].programCount += 1;
    });
    return map;
  }, [activityLogs]);

  const loSummary = useMemo(() => {
    let officialCount = 0;
    let waitingCount = 0;
    let totalMeetings = 0;
    let totalItems = 0;
    let totalPrograms = 0;

    const districtSet = new Set<string>();
    const villageSet = new Set<string>();
    const tpsSet = new Set<string>();

    volunteers.forEach((v) => {
      if (v.met_candidate) officialCount += 1;
      else waitingCount += 1;

      const f = frequencyByVolunteer[String(v.id)];
      if (f) {
        totalMeetings += f.meetingCount;
        totalItems += f.itemCount;
        totalPrograms += f.programCount;
      }

      const vill = villageMap[v.village_id];
      if (vill) {
        villageSet.add(vill.name);
        tpsSet.add(`${vill.id}-${v.tps_number}`);
        if (vill.district_id && districtMap[vill.district_id]) {
          districtSet.add(districtMap[vill.district_id]);
        }
      }
    });

    return {
      totalTeam: volunteers.length,
      officialCount,
      waitingCount,
      totalMeetings,
      totalItems,
      totalPrograms,
      districtNames: Array.from(districtSet),
      villageNames: Array.from(villageSet),
      tpsCount: tpsSet.size,
    };
  }, [volunteers, frequencyByVolunteer, villageMap, districtMap]);

  useEffect(() => {
    if (!showTpsModal) return;
    const q = dptSearchInput.trim().toUpperCase();
    if (q.length < 3) {
      setDptResults([]);
      setSearchingDpt(false);
      return;
    }

    const timer = setTimeout(() => {
      executeDptSearch(q, dptSearchDistrict);
    }, 350);

    return () => clearTimeout(timer);
  }, [dptSearchInput, dptSearchDistrict, showTpsModal]);

  async function executeDptSearch(cleanQuery: string, distFilter: string) {
    const reqId = ++searchReqIdRef.current;
    setSearchingDpt(true);

    let query = supabase
      .from('dpt')
      .select('id, district_id, village_id, tps_number, full_name, gender, age, rt, rw')
      .ilike('full_name', `%${cleanQuery}%`)
      .limit(15);

    if (distFilter !== 'ALL') {
      query = query.eq('district_id', distFilter);
    }

    const { data, error } = await query;
    if (reqId !== searchReqIdRef.current) return;

    setSearchingDpt(false);
    if (!error && data) {
      setDptResults(data as DptSearchResult[]);
    }
  }

  const handleSelectDptPerson = (person: DptSearchResult) => {
    setTpsName(person.full_name);
    if (person.district_id) setTpsDistrictId(person.district_id);
    if (person.village_id) setTpsVillageId(person.village_id);
    if (person.tps_number) setTpsNumber(String(person.tps_number));

    const villName = villageMap[person.village_id]?.name || '';
    const distName = districtMap[person.district_id] || '';
    const rtRwText =
      person.rt || person.rw ? `RT ${person.rt || '000'}/RW ${person.rw || '000'}` : '';

    if (!tpsAddress.trim()) {
      const autoAddr = [rtRwText, villName ? `KEL. ${villName}` : '', distName ? `KEC. ${distName}` : '']
        .filter(Boolean)
        .join(', ');
      if (autoAddr) setTpsAddress(autoAddr);
    }

    setSelectedDptBadge(
      `✓ Terverifikasi DPT: ${person.full_name} (${person.gender || '-'}, ${person.age || '-'} Thn) · KEL. ${villName}, KEC. ${distName} · TPS ${String(person.tps_number).padStart(3, '0')}`
    );
    setDptResults([]);
  };

  const handleSaveTimTps = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tpsName.trim() || !tpsVillageId || !loId) {
      alert('Pastikan Nama Lengkap dan Kelurahan sudah diisi.');
      return;
    }
    setSavingTps(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const nowIso = new Date().toISOString();

    const finalNik =
      tpsNik.trim().length >= 6
        ? tpsNik.trim().slice(0, 16)
        : `DPT-${Date.now().toString().slice(-10)}`.slice(0, 16);

    const basePayload: Record<string, any> = {
      full_name: tpsName.trim().toUpperCase(),
      nik: finalNik,
      whatsapp_number: tpsWa.trim() || '-',
      village_id: tpsVillageId,
      tps_number: parseInt(tpsNumber, 10) || 1,
      lo_id: loId,
      met_candidate: tpsMetNow,
      met_candidate_at: tpsMetNow ? nowIso : null,
      status: tpsMetNow ? 'approved' : 'pending',
      verified_by: tpsMetNow ? session?.user?.id || null : null,
      last_routine_verified_at: tpsMetNow ? nowIso : null,
    };

    const trimmedAddress = tpsAddress.trim();
    const payloadWithAddress = trimmedAddress ? { ...basePayload, address: trimmedAddress } : basePayload;

    let { error } = await supabase.from('volunteers').insert(payloadWithAddress);

    if (error && trimmedAddress && /address/i.test(error.message)) {
      const retry = await supabase.from('volunteers').insert(basePayload);
      error = retry.error;
    }

    setSavingTps(false);
    if (error) {
      alert('Gagal menyimpan Tim TPS: ' + error.message);
      return;
    }

    setShowTpsModal(false);
    setTpsNik('');
    setTpsName('');
    setTpsWa('');
    setTpsAddress('');
    setTpsMetNow(false);
    setDptSearchInput('');
    setDptResults([]);
    setSelectedDptBadge('');
    fetchLoDetail();
  };

  const handleConfirmMeeting = async (vol: Volunteer) => {
    const nextMet = !vol.met_candidate;
    const nowIso = nextMet ? new Date().toISOString() : null;
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const { error } = await supabase
      .from('volunteers')
      .update({
        met_candidate: nextMet,
        met_candidate_at: nowIso,
        status: nextMet ? 'approved' : 'pending',
        verified_by: nextMet ? session?.user?.id || null : null,
        last_routine_verified_at: nextMet ? nowIso : null,
      })
      .eq('id', vol.id);

    if (!error) {
      setVolunteers((prev) =>
        prev.map((item) =>
          item.id === vol.id
            ? {
                ...item,
                met_candidate: nextMet,
                met_candidate_at: nowIso,
                status: nextMet ? 'approved' : 'pending',
                last_routine_verified_at: nextMet ? nowIso : null,
              }
            : item
        )
      );
    }
  };

  const handleDeleteVolunteer = async (vol: Volunteer) => {
    const confirmed = window.confirm(
      `Hapus anggota Tim TPS "${vol.full_name}" (TPS ${String(vol.tps_number).padStart(3, '0')})? Data frekuensi terkait juga akan ikut terhapus.`
    );
    if (!confirmed) return;

    setDeletingId(vol.id);
    const { error } = await supabase.from('volunteers').delete().eq('id', vol.id);
    setDeletingId(null);

    if (error) {
      alert('Gagal menghapus Tim TPS: ' + error.message);
      return;
    }

    setVolunteers((prev) => prev.filter((item) => item.id !== vol.id));
    setActivityLogs((prev) => prev.filter((log) => String(log.volunteer_id) !== String(vol.id)));
  };

  const resetPhotoState = () => {
    setCompressedPhotoDataUrl('');
    setPhotoInfoText('');
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Pilih file gambar (JPG/PNG/WEBP).');
      return;
    }

    try {
      const dataUrl = await compressInlinePhoto(file);
      const approxKb = Math.max(1, Math.round((dataUrl.length * 0.75) / 1024));
      setCompressedPhotoDataUrl(dataUrl);
      setPhotoInfoText(`Terkompres di tempat (~${approxKb} KB)`);
    } catch (err: any) {
      alert(err?.message || 'Gagal mengompres foto.');
    }
  };

  const handleSaveFrequencyLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFreqVolunteer || !freqTitle.trim()) return;

    if (freqType === 'ITEM' && !compressedPhotoDataUrl) {
      alert('Untuk pencatatan Dapat Barang / Logistik, LO wajib memilih foto agar langsung terkompres.');
      return;
    }

    setSavingFreq(true);

    const baseInsert = {
      volunteer_id: activeFreqVolunteer.id,
      activity_type: freqType,
      activity_title: freqTitle.trim(),
      activity_date: freqDate,
      notes: freqNotes.trim() || null,
    };

    const payloadWithPhoto = compressedPhotoDataUrl
      ? { ...baseInsert, photo_url: compressedPhotoDataUrl }
      : baseInsert;

    let { data, error } = await supabase
      .from('tps_team_activities')
      .insert(payloadWithPhoto)
      .select('id, volunteer_id, activity_type, activity_title, activity_date, notes, photo_url')
      .single();

    if (error && compressedPhotoDataUrl && /photo_url/i.test(error.message)) {
      const retry = await supabase
        .from('tps_team_activities')
        .insert(baseInsert)
        .select('id, volunteer_id, activity_type, activity_title, activity_date, notes')
        .single();
      data = retry.data ? { ...retry.data, photo_url: compressedPhotoDataUrl } : null;
      error = retry.error;
    }

    setSavingFreq(false);
    if (error) {
      alert('Gagal menyimpan catatan frekuensi: ' + error.message);
      return;
    }

    if (data) {
      setActivityLogs((prev) => [data as ActivityLogRow, ...prev]);
    }
    setFreqTitle('');
    setFreqNotes('');
    resetPhotoState();
  };

  const handleDeleteFrequencyLog = async (logId: string) => {
    const { error } = await supabase.from('tps_team_activities').delete().eq('id', logId);
    if (!error) {
      setActivityLogs((prev) => prev.filter((item) => item.id !== logId));
    }
  };

  const handleExportPdf = () => {
    if (!loData) return;

    const rowsHtml = volunteers
      .map((v, idx) => {
        const vill = villageMap[v.village_id];
        const distName = vill ? districtMap[vill.district_id] || '-' : '-';
        const freq = frequencyByVolunteer[String(v.id)] || {
          meetingCount: 0,
          itemCount: 0,
          programCount: 0,
        };

        const vLogs = activityLogs.filter((l) => String(l.volunteer_id) === String(v.id));
        const latestLog = vLogs[0];
        const latestText = latestLog
          ? `${
              latestLog.activity_type === 'MEETING'
                ? 'Pertemuan'
                : latestLog.activity_type === 'ITEM'
                ? 'Barang'
                : 'Program'
            }: ${latestLog.activity_title} (${latestLog.activity_date})`
          : '-';

        return `
          <tr>
            <td style="text-align:center;">${idx + 1}</td>
            <td>
              <strong>${escapeHtml(v.full_name)}</strong><br/>
              <span style="color:#64748b;font-size:11px;">WA: ${escapeHtml(v.whatsapp_number || '-')}</span>
              ${
                v.address
                  ? `<br/><span style="color:#475569;font-size:11px;">Alamat: ${escapeHtml(v.address)}</span>`
                  : ''
              }
            </td>
            <td>
              KEL. ${escapeHtml(vill?.name || '-')} · TPS ${String(v.tps_number).padStart(3, '0')}<br/>
              <span style="color:#64748b;font-size:11px;">KEC. ${escapeHtml(distName)}</span>
            </td>
            <td style="text-align:center;">${v.met_candidate ? 'Resmi (Bertemu)' : 'Antrean'}</td>
            <td style="text-align:center;"><strong>${freq.meetingCount}x</strong></td>
            <td style="text-align:center;"><strong>${freq.itemCount}x</strong></td>
            <td style="text-align:center;"><strong>${freq.programCount}x</strong></td>
            <td style="font-size:11px;color:#334155;">${escapeHtml(latestText)}</td>
          </tr>
        `;
      })
      .join('');

    const printedDate = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Laporan LO - ${escapeHtml(loData.full_name)}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; margin: 28px; font-size: 12px; }
          h1 { margin: 0 0 4px; font-size: 20px; }
          .sub { color: #64748b; font-size: 12px; margin-bottom: 18px; }
          .summary-grid { display: flex; gap: 12px; margin-bottom: 18px; }
          .card { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; background: #f8fafc; }
          .card-label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; }
          .card-val { font-size: 16px; font-weight: bold; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border: 1px solid #cbd5e1; padding: 7px 8px; text-align: left; }
          th { background: #0f172a; color: #ffffff; font-size: 11px; }
          @media print { body { margin: 12px; } }
        </style>
      </head>
      <body>
        <h1>Laporan Tim TPS — LO: ${escapeHtml(loData.full_name)}</h1>
        <div class="sub">No. WA LO: ${escapeHtml(loData.whatsapp_number || '-')} · Sebaran: ${loSummary.districtNames.length} Kecamatan, ${loSummary.villageNames.length} Kelurahan (${loSummary.tpsCount} TPS) · Dicetak: ${escapeHtml(printedDate)}</div>

        <div class="summary-grid">
          <div class="card">
            <div class="card-label">Resmi / Antrean</div>
            <div class="card-val">${loSummary.officialCount} Resmi · ${loSummary.waitingCount} Antrean</div>
          </div>
          <div class="card">
            <div class="card-label">Total Pertemuan</div>
            <div class="card-val">${loSummary.totalMeetings}x</div>
          </div>
          <div class="card">
            <div class="card-label">Total Dapat Barang</div>
            <div class="card-val">${loSummary.totalItems}x</div>
          </div>
          <div class="card">
            <div class="card-label">Total Dapat Program</div>
            <div class="card-val">${loSummary.totalPrograms}x</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:36px;text-align:center;">No</th>
              <th>Nama & Alamat Tim TPS</th>
              <th>Wilayah & TPS</th>
              <th style="text-align:center;">Status</th>
              <th style="text-align:center;">Pertemuan</th>
              <th style="text-align:center;">Barang</th>
              <th style="text-align:center;">Program</th>
              <th>Aktivitas Terakhir</th>
            </tr>
          </thead>
          <tbody>
            ${
              rowsHtml ||
              '<tr><td colspan="8" style="text-align:center;color:#64748b;">Belum ada anggota Tim TPS di bawah LO ini.</td></tr>'
            }
          </tbody>
        </table>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    const printWin = window.open('', '_blank', 'width=960,height=720');
    if (!printWin) {
      alert('Izinkan pop-up browser terlebih dahulu untuk mengunduh/mencetak PDF.');
      return;
    }
    printWin.document.open();
    printWin.document.write(htmlContent);
    printWin.document.close();
  };

  const loVillagesList = useMemo(() => {
    const ids = new Set(volunteers.map((v) => v.village_id));
    return villages.filter((v) => ids.has(v.id));
  }, [volunteers, villages]);

  const filteredVolunteers = useMemo(() => {
    return volunteers.filter((v) => {
      const matchMeeting =
        filterMeeting === 'ALL' ||
        (filterMeeting === 'MET' && Boolean(v.met_candidate)) ||
        (filterMeeting === 'WAITING' && !v.met_candidate);

      const matchVillage = filterVillage === 'ALL' || v.village_id === filterVillage;

      const q = searchQuery.toLowerCase();
      const vill = villageMap[v.village_id];
      const matchSearch =
        !q ||
        v.full_name.toLowerCase().includes(q) ||
        String(v.address || '').toLowerCase().includes(q) ||
        String(v.whatsapp_number || '').includes(q) ||
        String(v.tps_number).includes(q) ||
        (vill?.name || '').toLowerCase().includes(q);

      return matchMeeting && matchVillage && matchSearch;
    });
  }, [volunteers, filterMeeting, filterVillage, searchQuery, villageMap]);

  const activeVolunteerLogs = useMemo(() => {
    if (!activeFreqVolunteer) return [];
    return activityLogs.filter((l) => String(l.volunteer_id) === String(activeFreqVolunteer.id));
  }, [activityLogs, activeFreqVolunteer]);

  const loWaHref = loData
    ? buildWaLink(
        loData.whatsapp_number,
        `Halo LO ${loData.full_name}, koordinasi tim TPS dari Command Center ANAKMUDATA.`
      )
    : null;

  return (
    <div className="space-y-6">
      {/* Navigasi Kembali & Header Profil LO */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <Link
            href="/dashboard/tim-sukses"
            className="inline-flex items-center gap-1.5 text-xs font-extrabold text-indigo-600 hover:text-indigo-800"
          >
            ← Kembali ke Daftar LO & Tim Sukses
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">
              🧭 {loading ? 'Memuat Profil LO...' : loData?.full_name || 'LO Tidak Ditemukan'}
            </h1>
            {loData?.whatsapp_number && (
              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
                📱 {loData.whatsapp_number}
              </span>
            )}
          </div>
          {loData?.nik && (
            <p className="font-mono text-xs text-slate-400">NIK LO: {loData.nik}</p>
          )}
        </div>

        {loData && (
          <div className="flex flex-wrap items-center gap-2.5">
            {loWaHref && (
              <a
                href={loWaHref}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs"
              >
                💬 Chat WA LO
              </a>
            )}
            <button
              type="button"
              onClick={handleExportPdf}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs"
            >
              📄 Cetak / PDF LO Ini
            </button>
            <button
              type="button"
              onClick={() => {
                const defaultVill = villages.find((v) => v.district_id === tpsDistrictId);
                if (defaultVill) setTpsVillageId(defaultVill.id);
                setTpsAddress('');
                setDptSearchInput('');
                setDptSearchDistrict('ALL');
                setDptResults([]);
                setSelectedDptBadge('');
                setShowTpsModal(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 via-pink-500 to-indigo-600 text-white text-xs font-extrabold hover:opacity-95 shadow-md shadow-rose-500/20"
            >
              + Tambah Tim TPS ke LO Ini
            </button>
          </div>
        )}
      </div>

      {/* 4 Kartu Ringkasan Angka & Sebaran Wilayah LO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-[11px] font-bold text-emerald-600 uppercase">Tim TPS Resmi</span>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1">
            {loading ? '...' : `${loSummary.officialCount} Orang`}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Dari total {loSummary.totalTeam} anggota binaan LO ini
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-[11px] font-bold text-amber-600 uppercase">Antrean Bertemu Caleg</span>
          <div className="text-2xl font-extrabold text-amber-600 mt-1">
            {loading ? '...' : `${loSummary.waitingCount} Orang`}
          </div>
          <p className="text-xs text-slate-500 mt-1">Menunggu jadwal tatap muka langsung</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-[11px] font-bold text-indigo-600 uppercase">Total Frekuensi Tim</span>
          <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs font-extrabold">
            <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700">
              🤝 {loSummary.totalMeetings}x
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800">
              📦 {loSummary.totalItems}x
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700">
              🎯 {loSummary.totalPrograms}x
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">Pertemuan · Barang · Program</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Sebaran Wilayah / TPS</span>
          <div className="text-xl font-extrabold text-slate-900 mt-1">
            {loading
              ? '...'
              : `${loSummary.districtNames.length} Kec · ${loSummary.villageNames.length} Kel`}
          </div>
          <p className="text-xs text-rose-600 font-bold mt-1">
            Mencakup {loSummary.tpsCount} Titik TPS
          </p>
        </div>
      </div>

      {/* Daftar Sebaran Kecamatan & Kelurahan LO */}
      {loSummary.villageNames.length > 0 && (
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap items-center gap-2 text-xs">
          <span className="font-extrabold text-slate-700">📍 Wilayah Binaan:</span>
          {loSummary.districtNames.map((d) => (
            <span key={d} className="px-2.5 py-0.5 rounded-full bg-slate-900 text-white text-[11px] font-bold">
              KEC. {d}
            </span>
          ))}
          {loSummary.villageNames.map((v) => (
            <span key={v} className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-bold">
              KEL. {v}
            </span>
          ))}
        </div>
      )}

      {/* Filter & Pencarian Daftar Tim TPS LO Ini */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={filterMeeting}
            onChange={(e) => setFilterMeeting(e.target.value as 'ALL' | 'MET' | 'WAITING')}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
          >
            <option value="ALL">Semua Status Pertemuan ({volunteers.length})</option>
            <option value="MET">🤝 Resmi Tim ({loSummary.officialCount})</option>
            <option value="WAITING">⏳ Antrean Bertemu ({loSummary.waitingCount})</option>
          </select>

          <select
            value={filterVillage}
            onChange={(e) => setFilterVillage(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
          >
            <option value="ALL">Semua Kelurahan Binaan</option>
            {loVillagesList.map((v) => (
              <option key={v.id} value={v.id}>
                KEL. {v.name}
              </option>
            ))}
          </select>
        </div>

        <input
          type="text"
          placeholder="Cari nama, alamat, atau No. TPS..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 w-full md:w-64"
        />
      </div>

      {/* Tabel Daftar Anggota Tim TPS di Bawah LO Ini */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-4">Nama, Alamat & Kontak WA</th>
                <th className="py-3.5 px-4">Kelurahan & No. TPS</th>
                <th className="py-3.5 px-4 text-center">Status Bertemu Caleg</th>
                <th className="py-3.5 px-4 text-center">Frekuensi (Pertemuan · Barang · Program)</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    Memuat daftar Tim TPS...
                  </td>
                </tr>
              ) : filteredVolunteers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    Belum ada anggota Tim TPS pada filter ini. Klik <b>+ Tambah Tim TPS ke LO Ini</b> untuk menambahkan.
                  </td>
                </tr>
              ) : (
                filteredVolunteers.map((v) => {
                  const vill = villageMap[v.village_id];
                  const distName = vill ? districtMap[vill.district_id] : '-';
                  const isOfficial = Boolean(v.met_candidate);
                  const tpsLabel = String(v.tps_number).padStart(3, '0');
                  const freq = frequencyByVolunteer[String(v.id)] || {
                    meetingCount: 0,
                    itemCount: 0,
                    programCount: 0,
                  };
                  const waHref = buildWaLink(
                    v.whatsapp_number,
                    `Halo ${v.full_name} (Tim TPS ${tpsLabel} Kel. ${vill?.name || ''}), koordinasi dari LO ${loData?.full_name || ''}.`
                  );

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/80">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{v.full_name}</div>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px]">
                          <span className="font-semibold text-emerald-600">{v.whatsapp_number || '-'}</span>
                          {waHref && (
                            <a
                              href={waHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold"
                            >
                              💬 Chat WA ↗
                            </a>
                          )}
                        </div>
                        {v.address && (
                          <div className="text-[11px] text-slate-500 mt-0.5">🏠 {v.address}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">
                          KEL. {vill?.name || '-'}{' '}
                          <span className="ml-1 px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-extrabold">
                            TPS {tpsLabel}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">KEC. {distName}</div>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleConfirmMeeting(v)}
                          className={`px-3 py-1 rounded-full text-[11px] font-bold transition ${
                            isOfficial
                              ? 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700'
                              : 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200'
                          }`}
                        >
                          {isOfficial ? '🤝 Resmi Tim (Sudah Bertemu)' : '⏳ Belum Bertemu Caleg'}
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            resetPhotoState();
                            setActiveFreqVolunteer(v);
                            setFreqType('MEETING');
                            setFreqTitle('');
                            setFreqNotes('');
                          }}
                          className="inline-flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 transition text-[10px] font-extrabold"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-indigo-700">🤝 {freq.meetingCount}x</span>
                            <span className="text-amber-700">📦 {freq.itemCount}x</span>
                            <span className="text-emerald-700">🎯 {freq.programCount}x</span>
                          </div>
                          <span className="text-[9px] text-indigo-600 underline">+ Catat Frekuensi</span>
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            resetPhotoState();
                            setActiveFreqVolunteer(v);
                            setFreqType('MEETING');
                            setFreqTitle('');
                            setFreqNotes('');
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold"
                        >
                          + Frekuensi
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === v.id}
                          onClick={() => handleDeleteVolunteer(v)}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-[11px] font-bold disabled:opacity-50"
                        >
                          {deletingId === v.id ? '...' : '🗑️ Hapus'}
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

      {/* MODAL TAMBAH TIM TPS LANGSUNG TERHUBUNG KE LO INI */}
      {showTpsModal && loData && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleSaveTimTps}
            className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl max-h-[92vh] overflow-y-auto"
          >
            <div>
              <div className="text-[10px] font-extrabold uppercase text-indigo-600">
                LO Penanggung Jawab: {loData.full_name}
              </div>
              <h3 className="text-lg font-extrabold text-slate-900">+ Tambah Calon / Anggota Tim TPS</h3>
            </div>

            <div className="space-y-3.5">
              <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-extrabold text-indigo-900">
                    🔍 Cari & Ambil Data dari DPT Makassar
                  </label>
                  <select
                    value={dptSearchDistrict}
                    onChange={(e) => setDptSearchDistrict(e.target.value)}
                    className="px-2 py-1 rounded-lg border border-indigo-200 bg-white text-[10px] font-bold text-indigo-800"
                  >
                    <option value="ALL">Semua Kecamatan</option>
                    {districts.map((d) => (
                      <option key={d.id} value={d.id}>
                        KEC. {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={dptSearchInput}
                    onChange={(e) => setDptSearchInput(e.target.value)}
                    placeholder="Ketik nama warga sesuai DPT (min. 3 huruf)..."
                    className="flex-1 px-3.5 py-2 border border-indigo-200 rounded-xl text-xs bg-white font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => executeDptSearch(dptSearchInput.trim().toUpperCase(), dptSearchDistrict)}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold whitespace-nowrap"
                  >
                    {searchingDpt ? 'Mencari...' : 'Cari DPT'}
                  </button>
                </div>

                {dptResults.length > 0 && (
                  <div className="bg-white border border-indigo-200 rounded-xl max-h-44 overflow-y-auto divide-y divide-slate-100 shadow-sm">
                    {dptResults.map((person) => {
                      const vName = villageMap[person.village_id]?.name || '-';
                      const dName = districtMap[person.district_id] || '-';
                      return (
                        <button
                          key={person.id}
                          type="button"
                          onClick={() => handleSelectDptPerson(person)}
                          className="w-full px-3 py-2 text-left hover:bg-indigo-50 flex items-center justify-between gap-2 transition"
                        >
                          <div>
                            <div className="text-xs font-extrabold text-slate-900">
                              {person.full_name}{' '}
                              <span className="text-[10px] font-semibold text-slate-500">
                                ({person.gender || '-'}, {person.age || '-'} Thn)
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500">
                              KEL. {vName}, KEC. {dName} · RT {person.rt || '000'}/RW {person.rw || '000'}
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-extrabold text-[10px] shrink-0">
                            TPS {String(person.tps_number).padStart(3, '0')} →
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedDptBadge && (
                  <div className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl">
                    {selectedDptBadge}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap *</label>
                  <input
                    required
                    value={tpsName}
                    onChange={(e) => setTpsName(e.target.value)}
                    placeholder="Otomatis dari DPT atau ketik manual"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold"
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

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Alamat Domisili / Rumah</label>
                <input
                  value={tpsAddress}
                  onChange={(e) => setTpsAddress(e.target.value)}
                  placeholder="Contoh: Jl. Perintis Kemerdekaan KM 14, Blok B No. 7..."
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  NIK (Opsional — isi jika ada KTP)
                </label>
                <input
                  maxLength={16}
                  value={tpsNik}
                  onChange={(e) => setTpsNik(e.target.value.replace(/\D/g, ''))}
                  placeholder="7371xxxxxxxxxxxx (boleh dikosongkan)"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kecamatan TPS *</label>
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kelurahan TPS *</label>
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

              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-start gap-3">
                <input
                  id="metCandidateCheckLo"
                  type="checkbox"
                  checked={tpsMetNow}
                  onChange={(e) => setTpsMetNow(e.target.checked)}
                  className="mt-1 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="metCandidateCheckLo" className="text-xs text-slate-700 cursor-pointer">
                  <span className="font-bold text-emerald-900 block">
                    Sudah Bertemu Langsung dengan Caleg (Langsung Resmi Masuk Tim)
                  </span>
                  <span className="text-slate-500">
                    Biarkan tidak dicentang jika orang ini masih menunggu jadwal pertemuan tatap muka.
                  </span>
                </label>
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

      {/* MODAL CATAT & RIWAYAT FREKUENSI */}
      {activeFreqVolunteer && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-extrabold uppercase text-indigo-600">
                  Deteksi Frekuensi Tim TPS
                </div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {activeFreqVolunteer.full_name}
                </h3>
                <p className="text-xs text-slate-500">
                  TPS {String(activeFreqVolunteer.tps_number).padStart(3, '0')} ·{' '}
                  {villageMap[activeFreqVolunteer.village_id]?.name || '-'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetPhotoState();
                  setActiveFreqVolunteer(null);
                }}
                className="px-3 py-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
              >
                Tutup
              </button>
            </div>

            {(() => {
              const f = frequencyByVolunteer[String(activeFreqVolunteer.id)] || {
                meetingCount: 0,
                itemCount: 0,
                programCount: 0,
              };
              return (
                <div className="grid grid-cols-3 gap-2.5 text-center">
                  <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-100">
                    <div className="text-[10px] font-bold text-indigo-700 uppercase">Pertemuan</div>
                    <div className="text-lg font-extrabold text-indigo-900 mt-0.5">{f.meetingCount}x</div>
                  </div>
                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-100">
                    <div className="text-[10px] font-bold text-amber-800 uppercase">Dapat Barang</div>
                    <div className="text-lg font-extrabold text-amber-900 mt-0.5">{f.itemCount}x</div>
                  </div>
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
                    <div className="text-[10px] font-bold text-emerald-800 uppercase">Dapat Program</div>
                    <div className="text-lg font-extrabold text-emerald-900 mt-0.5">{f.programCount}x</div>
                  </div>
                </div>
              );
            })()}

            <form
              onSubmit={handleSaveFrequencyLog}
              className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Kategori Aktivitas
                  </label>
                  <select
                    value={freqType}
                    onChange={(e) => {
                      const nextType = e.target.value as 'MEETING' | 'ITEM' | 'PROGRAM';
                      setFreqType(nextType);
                      if (nextType !== 'ITEM') resetPhotoState();
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white"
                  >
                    <option value="MEETING">🤝 Pertemuan (+1x)</option>
                    <option value="ITEM">📦 Dapat Barang / Logistik (+1x · Wajib Foto)</option>
                    <option value="PROGRAM">🎯 Dapat Program (+1x)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Tanggal
                  </label>
                  <input
                    type="date"
                    required
                    value={freqDate}
                    onChange={(e) => setFreqDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Keterangan Pertemuan / Barang / Program *
                </label>
                <input
                  type="text"
                  required
                  value={freqTitle}
                  onChange={(e) => setFreqTitle(e.target.value)}
                  placeholder="Contoh: Silaturahmi Tim TPS, Kaos & Stiker, atau Program Pelatihan..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                />
              </div>

              {(freqType === 'ITEM' || compressedPhotoDataUrl) && (
                <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[11px] font-extrabold text-amber-900">
                      📸 Foto Bukti Barang {freqType === 'ITEM' ? '(Wajib · Auto-Kompres)' : '(Opsional)'}
                    </label>
                    {photoInfoText && (
                      <span className="text-[10px] font-bold text-emerald-700">{photoInfoText}</span>
                    )}
                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    required={freqType === 'ITEM' && !compressedPhotoDataUrl}
                    onChange={handlePhotoChange}
                    className="block w-full text-[11px] text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-amber-900 file:text-white hover:file:bg-amber-800"
                  />

                  {compressedPhotoDataUrl && (
                    <div className="pt-1">
                      <img
                        src={compressedPhotoDataUrl}
                        alt="Pratinjau terkompresi"
                        className="h-24 w-auto rounded-xl object-cover border border-amber-300"
                      />
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Catatan (Opsional)
                </label>
                <input
                  type="text"
                  value={freqNotes}
                  onChange={(e) => setFreqNotes(e.target.value)}
                  placeholder="Catatan tambahan..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingFreq}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold"
                >
                  {savingFreq ? 'Menyimpan...' : '+ Catat Frekuensi'}
                </button>
              </div>
            </form>

            <div className="space-y-2">
              <div className="text-xs font-extrabold text-slate-800">
                Riwayat Tercatat ({activeVolunteerLogs.length})
              </div>
              {activeVolunteerLogs.length === 0 ? (
                <p className="text-xs text-slate-400">Belum ada catatan pertemuan, barang, atau program.</p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl px-3">
                  {activeVolunteerLogs.map((log) => (
                    <div key={log.id} className="py-2.5 flex items-start justify-between gap-2 text-xs">
                      <div className="space-y-1.5">
                        <div className="font-bold text-slate-900">
                          {log.activity_type === 'MEETING'
                            ? '🤝 Pertemuan'
                            : log.activity_type === 'ITEM'
                            ? '📦 Dapat Barang'
                            : '🎯 Dapat Program'}{' '}
                          · {log.activity_title}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {log.activity_date}
                          {log.notes ? ` · ${log.notes}` : ''}
                        </div>
                        {log.photo_url && (
                          <img
                            src={log.photo_url}
                            alt="Bukti barang"
                            className="h-20 w-auto rounded-lg object-cover border border-slate-200"
                          />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteFrequencyLog(log.id)}
                        className="text-[10px] font-bold text-rose-500 hover:text-rose-700"
                      >
                        Hapus
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}