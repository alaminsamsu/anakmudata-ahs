'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
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
  status: string;
  lo_id: string | null;
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

interface ExcelPreviewRow {
  rowNum: number;
  loName: string;
  loWa: string;
  timName: string;
  nik: string;
  timWa: string;
  districtName: string;
  villageName: string;
  villageId: string | null;
  tpsNumber: number;
  hasExplicitTps: boolean;
  isValid: boolean;
  errorReason?: string;
  dptStatus: 'idle' | 'matched' | 'ambiguous' | 'not_found';
  dptCandidates: DptSearchResult[];
  selectedDpt: DptSearchResult | null;
}

const MAX_INLINE_DATA_URL_CHARS = 160000;

function normalizeText(str: string): string {
  return String(str || '')
    .toUpperCase()
    .replace(/^KEC\.?\s*/i, '')
    .replace(/^KEL\.?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

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
      reject(new Error('File gambar atau foto tidak valid.'));
    };

    img.src = objectUrl;
  });
}

export default function TimSuksesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'lo' | 'tim_tps'>('lo');
  const [districts, setDistricts] = useState<District[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [los, setLos] = useState<FieldLo[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filter
  const [filterDistrict, setFilterDistrict] = useState<string>('ALL');
  const [filterLo, setFilterLo] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal Tambah LO
  const [showLoModal, setShowLoModal] = useState<boolean>(false);
  const [loName, setLoName] = useState('');
  const [loNik, setLoNik] = useState('');
  const [loWa, setLoWa] = useState('');
  const [savingLo, setSavingLo] = useState(false);

  // Modal Tambah Tim TPS + Pencarian DPT Super Cepat
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
  const [tpsLoId, setTpsLoId] = useState('');
  const [savingTps, setSavingTps] = useState(false);

  // Modal Pelacak Frekuensi Pertemuan, Barang & Program Per Tim TPS
  const [activeFreqVolunteer, setActiveFreqVolunteer] = useState<Volunteer | null>(null);
  const [freqType, setFreqType] = useState<'MEETING' | 'ITEM' | 'PROGRAM'>('MEETING');
  const [freqTitle, setFreqTitle] = useState<string>('');
  const [freqDate, setFreqDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [freqNotes, setFreqNotes] = useState<string>('');
  const [compressedPhotoDataUrl, setCompressedPhotoDataUrl] = useState<string>('');
  const [photoInfoText, setPhotoInfoText] = useState<string>('');
  const [savingFreq, setSavingFreq] = useState<boolean>(false);

  // Modal Import Excel + Smart DPT Auto-Matcher
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [excelRows, setExcelRows] = useState<ExcelPreviewRow[]>([]);
  const [importFileName, setImportFileName] = useState<string>('');
  const [matchingDptBulk, setMatchingDptBulk] = useState<boolean>(false);
  const [matchProgressText, setMatchProgressText] = useState<string>('');
  const [importingExcel, setImportingExcel] = useState<boolean>(false);

  useEffect(() => {
    fetchAllData();
  }, []);

  async function fetchAllData() {
    setLoading(true);
    const [distRes, villRes, loRes, volRes, actRes] = await Promise.all([
      supabase.from('districts').select('id, name').order('name'),
      supabase.from('villages').select('id, district_id, name, total_tps').order('name'),
      supabase.from('field_los').select('*').order('full_name'),
      supabase.from('volunteers').select('*').order('created_at', { ascending: false }),
      supabase
        .from('tps_team_activities')
        .select('id, volunteer_id, activity_type, activity_title, activity_date, notes, photo_url')
        .order('activity_date', { ascending: false })
        .limit(1000),
    ]);

    if (distRes.data) {
      setDistricts(distRes.data);
      if (distRes.data.length > 0 && !tpsDistrictId) {
        setTpsDistrictId(distRes.data[0].id);
      }
    }
    if (villRes.data) setVillages(villRes.data);
    if (loRes.data) setLos(loRes.data as FieldLo[]);
    if (volRes.data) setVolunteers(volRes.data as Volunteer[]);
    if (!actRes.error && actRes.data) {
      setActivityLogs(actRes.data as ActivityLogRow[]);
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

  const loMap = useMemo(() => {
    const m: Record<string, FieldLo> = {};
    los.forEach((l) => (m[l.id] = l));
    return m;
  }, [los]);

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

  const totalFrequencySummary = useMemo(() => {
    let meetings = 0;
    let items = 0;
    let programs = 0;
    volunteers.forEach((v) => {
      const f = frequencyByVolunteer[String(v.id)];
      if (f) {
        meetings += f.meetingCount;
        items += f.itemCount;
        programs += f.programCount;
      }
    });
    return { meetings, items, programs };
  }, [volunteers, frequencyByVolunteer]);

  const loStats = useMemo(() => {
    const stats: Record<
      string,
      {
        teamCount: number;
        districts: Set<string>;
        villages: Set<string>;
        meetingFreq: number;
        itemFreq: number;
        programFreq: number;
      }
    > = {};

    los.forEach((l) => {
      stats[l.id] = {
        teamCount: 0,
        districts: new Set(),
        villages: new Set(),
        meetingFreq: 0,
        itemFreq: 0,
        programFreq: 0,
      };
    });

    volunteers.forEach((v) => {
      if (v.lo_id && stats[v.lo_id]) {
        stats[v.lo_id].teamCount += 1;

        const freq = frequencyByVolunteer[String(v.id)];
        if (freq) {
          stats[v.lo_id].meetingFreq += freq.meetingCount;
          stats[v.lo_id].itemFreq += freq.itemCount;
          stats[v.lo_id].programFreq += freq.programCount;
        }

        const vill = villageMap[v.village_id];
        if (vill) {
          stats[v.lo_id].villages.add(vill.name);
          if (vill.district_id && districtMap[vill.district_id]) {
            stats[v.lo_id].districts.add(districtMap[vill.district_id]);
          }
        }
      }
    });

    return stats;
  }, [los, volunteers, villageMap, districtMap, frequencyByVolunteer]);

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

  const handleExportLoPdf = (lo: FieldLo) => {
    const loVolunteers = volunteers.filter((v) => v.lo_id === lo.id);

    let totalMeetings = 0;
    let totalItems = 0;
    let totalPrograms = 0;

    const rowsHtml = loVolunteers
      .map((v, idx) => {
        const vill = villageMap[v.village_id];
        const distName = vill ? districtMap[vill.district_id] || '-' : '-';
        const freq = frequencyByVolunteer[String(v.id)] || {
          meetingCount: 0,
          itemCount: 0,
          programCount: 0,
        };
        totalMeetings += freq.meetingCount;
        totalItems += freq.itemCount;
        totalPrograms += freq.programCount;

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
        <title>Laporan Tim TPS - ${escapeHtml(lo.full_name)}</title>
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
        <h1>Laporan Frekuensi Tim TPS — LO: ${escapeHtml(lo.full_name)}</h1>
        <div class="sub">No. WA LO: ${escapeHtml(lo.whatsapp_number || '-')} · Dicetak pada: ${escapeHtml(printedDate)}</div>

        <div class="summary-grid">
          <div class="card">
            <div class="card-label">Jumlah Tim TPS</div>
            <div class="card-val">${loVolunteers.length} Orang</div>
          </div>
          <div class="card">
            <div class="card-label">Total Pertemuan</div>
            <div class="card-val">${totalMeetings}x</div>
          </div>
          <div class="card">
            <div class="card-label">Total Dapat Barang</div>
            <div class="card-val">${totalItems}x</div>
          </div>
          <div class="card">
            <div class="card-label">Total Dapat Program</div>
            <div class="card-val">${totalPrograms}x</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:36px;text-align:center;">No</th>
              <th>Nama & Alamat Tim TPS</th>
              <th>Wilayah & TPS</th>
              <th style="text-align:center;">Pertemuan</th>
              <th style="text-align:center;">Barang</th>
              <th style="text-align:center;">Program</th>
              <th>Aktivitas Terakhir</th>
            </tr>
          </thead>
          <tbody>
            ${
              rowsHtml ||
              '<tr><td colspan="7" style="text-align:center;color:#64748b;">Belum ada anggota Tim TPS di bawah LO ini.</td></tr>'
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

  const resetPhotoState = () => {
    setCompressedPhotoDataUrl('');
    setPhotoInfoText('');
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Pilih file gambar atau ambil foto langsung dari kamera.');
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
      alert('Untuk pencatatan Dapat Barang / Logistik, LO wajib mengunggah atau memfoto langsung bukti serah terima.');
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

  const handleDownloadTemplate = () => {
    const sampleData = [
      {
        NAMA_LO: 'AL AMIN SAMSU NIANG',
        WA_LO: '082333933344',
        NAMA_TIM_TPS: 'ANDI FATIMAH A. NEILDRIN A',
        WA_TIM_TPS: '085211223344',
        ALAMAT: 'JL. PERINTIS KEMERDEKAAN KM 14',
        KECAMATAN: 'BIRINGKANAYA',
        KELURAHAN: 'PACCERAKKANG',
        NO_TPS: '',
      },
      {
        NAMA_LO: 'AL AMIN SAMSU NIANG',
        WA_LO: '082333933344',
        NAMA_TIM_TPS: 'SITI AMINAH',
        WA_TIM_TPS: '082199887766',
        ALAMAT: 'JL. PARANG TAMBUNG NO. 12',
        KECAMATAN: 'TAMALATE',
        KELURAHAN: 'PARANG TAMBUNG',
        NO_TPS: 4,
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    worksheet['!cols'] = [
      { wch: 24 },
      { wch: 16 },
      { wch: 28 },
      { wch: 16 },
      { wch: 28 },
      { wch: 18 },
      { wch: 20 },
      { wch: 10 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template_Tim_Sukses');
    XLSX.writeFile(workbook, 'Template_Import_LO_TimTPS_ANAKMUDATA.xlsx');
  };

  async function matchRowsAgainstDpt(rows: ExcelPreviewRow[]) {
    const validIndices = rows
      .map((r, idx) => (r.isValid && r.villageId ? idx : -1))
      .filter((idx) => idx !== -1);

    if (validIndices.length === 0) return;

    setMatchingDptBulk(true);
    const updated = [...rows];
    const chunkSize = 8;

    for (let i = 0; i < validIndices.length; i += chunkSize) {
      const slice = validIndices.slice(i, i + chunkSize);
      setMatchProgressText(
        `Mencocokkan dengan Database DPT (${Math.min(i + chunkSize, validIndices.length)}/${validIndices.length} nama)...`
      );

      await Promise.all(
        slice.map(async (rowIdx) => {
          const item = updated[rowIdx];
          if (!item.villageId) return;

          const cleanSearch = item.timName
            .replace(/\b(MUH\.?|MOH\.?|HJ\.?|H\.?|DRS\.?|IR\.?|S\.PD|S\.E|S\.H)\b/g, '')
            .replace(/\s+/g, ' ')
            .trim();

          const searchToken = cleanSearch.length >= 3 ? cleanSearch : item.timName;

          const { data } = await supabase
            .from('dpt')
            .select('id, district_id, village_id, tps_number, full_name, gender, age, rt, rw')
            .eq('village_id', item.villageId)
            .ilike('full_name', `%${searchToken}%`)
            .limit(8);

          let candidates = (data || []) as DptSearchResult[];

          if (item.hasExplicitTps && candidates.length > 1) {
            const sameTps = candidates.filter((c) => c.tps_number === item.tpsNumber);
            if (sameTps.length > 0) candidates = sameTps;
          }

          if (candidates.length === 1) {
            const picked = candidates[0];
            updated[rowIdx] = {
              ...item,
              timName: picked.full_name,
              tpsNumber: picked.tps_number,
              dptStatus: 'matched',
              dptCandidates: candidates,
              selectedDpt: picked,
            };
          } else if (candidates.length > 1) {
            const exact = candidates.find((c) => normalizeText(c.full_name) === item.timName);
            if (exact) {
              updated[rowIdx] = {
                ...item,
                timName: exact.full_name,
                tpsNumber: exact.tps_number,
                dptStatus: 'matched',
                dptCandidates: candidates,
                selectedDpt: exact,
              };
            } else {
              updated[rowIdx] = {
                ...item,
                tpsNumber: item.hasExplicitTps ? item.tpsNumber : candidates[0].tps_number,
                dptStatus: 'ambiguous',
                dptCandidates: candidates,
                selectedDpt: candidates[0],
              };
            }
          } else {
            updated[rowIdx] = {
              ...item,
              dptStatus: 'not_found',
              dptCandidates: [],
              selectedDpt: null,
            };
          }
        })
      );

      setExcelRows([...updated]);
    }

    setMatchingDptBulk(false);
    setMatchProgressText('');
  }

  const handleExcelFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const binaryStr = evt.target?.result;
      const workbook = XLSX.read(binaryStr, { type: 'binary' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawJson: Record<string, any>[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

      const parsed: ExcelPreviewRow[] = rawJson.map((row, index) => {
        const loName = normalizeText(row.NAMA_LO || row['NAMA LO'] || row.LO || '');
        const loWa = String(row.WA_LO || row['WA LO'] || row['NO WA LO'] || '').trim();
        const timName = normalizeText(
          row.NAMA_TIM_TPS || row['NAMA TIM TPS'] || row.NAMA || row['NAMA LENGKAP'] || ''
        );
        const nik = String(row.NIK || '').replace(/\D/g, '').trim();
        const timWa = String(
          row.WA_TIM_TPS || row['WA TIM TPS'] || row.WA || row['NO WA'] || row.WHATSAPP || ''
        ).trim();
        const districtName = normalizeText(row.KECAMATAN || '');
        const villageName = normalizeText(row.KELURAHAN || '');

        const rawTpsStr = String(row.NO_TPS || row['NO TPS'] || row.TPS || '').replace(/\D/g, '');
        const hasExplicitTps = rawTpsStr.length > 0 && parseInt(rawTpsStr, 10) > 0;
        const tpsNumber = hasExplicitTps ? parseInt(rawTpsStr, 10) : 1;

        let matchedVillage: Village | undefined;
        if (districtName) {
          const matchedDist = districts.find((d) => normalizeText(d.name) === districtName);
          if (matchedDist) {
            matchedVillage = villages.find(
              (v) => v.district_id === matchedDist.id && normalizeText(v.name) === villageName
            );
          }
        }
        if (!matchedVillage) {
          matchedVillage = villages.find((v) => normalizeText(v.name) === villageName);
        }

        let isValid = true;
        let errorReason = '';

        if (!loName) {
          isValid = false;
          errorReason = 'Nama LO kosong';
        } else if (!timName) {
          isValid = false;
          errorReason = 'Nama Tim TPS kosong';
        } else if (!matchedVillage) {
          isValid = false;
          errorReason = `Kelurahan "${villageName || '-'}" tidak ditemukan`;
        }

        const safeNik =
          nik.length >= 10
            ? nik.slice(0, 16)
            : `DPT-${matchedVillage?.id.slice(0, 6) || 'MKS'}-${tpsNumber}-${index + 1}`.slice(0, 16);

        return {
          rowNum: index + 2,
          loName,
          loWa,
          timName,
          nik: safeNik,
          timWa,
          districtName,
          villageName,
          villageId: matchedVillage?.id || null,
          tpsNumber,
          hasExplicitTps,
          isValid,
          errorReason,
          dptStatus: isValid ? 'idle' : 'not_found',
          dptCandidates: [],
          selectedDpt: null,
        };
      });

      setExcelRows(parsed);
      await matchRowsAgainstDpt(parsed);
    };
    reader.readAsBinaryString(file);
  };

  const handlePickCandidateInPreview = (rowIndex: number, candidateId: string) => {
    setExcelRows((prev) =>
      prev.map((row, idx) => {
        if (idx !== rowIndex) return row;
        const found = row.dptCandidates.find((c) => c.id === candidateId) || null;
        if (!found) return row;
        return {
          ...row,
          timName: found.full_name,
          tpsNumber: found.tps_number,
          dptStatus: 'matched',
          selectedDpt: found,
        };
      })
    );
  };

  const handleConfirmExcelImport = async () => {
    const validRows = excelRows.filter((r) => r.isValid && r.villageId);
    if (validRows.length === 0) {
      alert('Tidak ada baris data yang valid untuk disimpan.');
      return;
    }

    setImportingExcel(true);
    try {
      const existingLoMap: Record<string, string> = {};
      los.forEach((l) => {
        existingLoMap[normalizeText(l.full_name)] = l.id;
      });

      const uniqueNewLos = new Map<string, string>();
      validRows.forEach((r) => {
        if (!existingLoMap[r.loName] && !uniqueNewLos.has(r.loName)) {
          uniqueNewLos.set(r.loName, r.loWa || '-');
        }
      });

      if (uniqueNewLos.size > 0) {
        const newLoPayloads = Array.from(uniqueNewLos.entries()).map(([name, wa]) => ({
          full_name: name,
          whatsapp_number: wa,
          level: 'Lintas Wilayah',
          district_id: null,
          village_id: null,
        }));

        const { data: insertedLos, error: loInsertErr } = await supabase
          .from('field_los')
          .insert(newLoPayloads)
          .select('id, full_name');

        if (loInsertErr) throw loInsertErr;
        insertedLos?.forEach((l) => {
          existingLoMap[normalizeText(l.full_name)] = l.id;
        });
      }

      const existingNikMap: Record<string, string> = {};
      volunteers.forEach((v) => {
        if (v.nik) existingNikMap[v.nik] = v.id;
      });

      const toInsert: any[] = [];
      const toUpdate: { id: string; payload: any }[] = [];

      validRows.forEach((r, idx) => {
        const loId = existingLoMap[r.loName] || null;
        const finalNik = r.selectedDpt
          ? `DPT-${r.selectedDpt.id.slice(0, 12)}`.slice(0, 16)
          : `DPT-${r.villageId?.slice(0, 5) || 'MKS'}-${r.tpsNumber}-${Date.now().toString().slice(-4)}${idx}`.slice(0, 16);

        const payload = {
          full_name: r.timName,
          nik: finalNik,
          whatsapp_number: r.timWa || '-',
          village_id: r.villageId,
          tps_number: r.tpsNumber,
          lo_id: loId,
          status: 'approved',
        };

        if (existingNikMap[finalNik]) {
          toUpdate.push({ id: existingNikMap[finalNik], payload });
        } else {
          toInsert.push(payload);
          existingNikMap[finalNik] = 'QUEUED';
        }
      });

      if (toInsert.length > 0) {
        const { error: insErr } = await supabase.from('volunteers').insert(toInsert);
        if (insErr) throw insErr;
      }

      for (const item of toUpdate) {
        await supabase.from('volunteers').update(item.payload).eq('id', item.id);
      }

      alert(
        `Berhasil mengimpor ${toInsert.length} data baru dan memperbarui ${toUpdate.length} data lama!`
      );
      setShowImportModal(false);
      setExcelRows([]);
      setImportFileName('');
      fetchAllData();
    } catch (err: any) {
      alert('Terjadi kesalahan saat menyimpan data Excel: ' + (err?.message || err));
    } finally {
      setImportingExcel(false);
    }
  };

  const handleSaveLo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loName.trim() || !loWa.trim()) return;
    setSavingLo(true);

    const { error } = await supabase.from('field_los').insert({
      full_name: loName.trim().toUpperCase(),
      nik: loNik.trim() || null,
      whatsapp_number: loWa.trim(),
      level: 'Lintas Wilayah',
      district_id: null,
      village_id: null,
    });

    setSavingLo(false);
    if (error) {
      alert('Gagal menyimpan LO: ' + error.message);
    } else {
      setShowLoModal(false);
      setLoName('');
      setLoNik('');
      setLoWa('');
      setActiveTab('lo');
      fetchAllData();
    }
  };

  const handleSaveTimTps = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tpsName.trim() || !tpsVillageId || !tpsLoId) {
      alert('Pastikan Nama Lengkap, Kelurahan, dan LO Penanggung Jawab sudah diisi.');
      return;
    }
    setSavingTps(true);

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
      lo_id: tpsLoId,
      status: 'approved',
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
    } else {
      setShowTpsModal(false);
      setTpsNik('');
      setTpsName('');
      setTpsWa('');
      setTpsAddress('');
      setDptSearchInput('');
      setDptResults([]);
      setSelectedDptBadge('');
      setActiveTab('tim_tps');
      fetchAllData();
    }
  };

  const filteredVolunteers = useMemo(() => {
    return volunteers.filter((v) => {
      const vill = villageMap[v.village_id];
      const matchDist = filterDistrict === 'ALL' || vill?.district_id === filterDistrict;
      const matchLo = filterLo === 'ALL' || v.lo_id === filterLo;

      const q = searchQuery.toLowerCase();
      const matchSearch =
        v.full_name.toLowerCase().includes(q) ||
        v.nik.includes(q) ||
        String(v.address || '').toLowerCase().includes(q) ||
        (vill?.name || '').toLowerCase().includes(q);
      return matchDist && matchLo && matchSearch;
    });
  }, [volunteers, villageMap, filterDistrict, filterLo, searchQuery]);

  const filteredLos = useMemo(() => {
    return los.filter((l) => {
      const q = searchQuery.toLowerCase();
      return l.full_name.toLowerCase().includes(q) || (l.whatsapp_number || '').includes(q);
    });
  }, [los, searchQuery]);

  const activeVolunteerLogs = useMemo(() => {
    if (!activeFreqVolunteer) return [];
    return activityLogs.filter((l) => String(l.volunteer_id) === String(activeFreqVolunteer.id));
  }, [activityLogs, activeFreqVolunteer]);

  const validExcelCount = excelRows.filter((r) => r.isValid).length;
  const invalidExcelCount = excelRows.filter((r) => !r.isValid).length;
  const matchedDptExcelCount = excelRows.filter((r) => r.isValid && r.dptStatus === 'matched').length;

  return (
    <div className="space-y-6">
      {/* Header & Tombol Input Admin */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">🤝 Tim Sukses — Struktur LO & Tim TPS</h1>
          <p className="text-sm text-slate-500 mt-1">
            Klik nama/baris LO untuk membuka halaman khusus LO tersebut, atau kelola langsung Tim TPS di bawah ini.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => {
              setExcelRows([]);
              setImportFileName('');
              setMatchProgressText('');
              setShowImportModal(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-xs flex items-center gap-1.5"
          >
            📥 Import Excel (+ Auto DPT)
          </button>
          <button
            onClick={() => setShowLoModal(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 shadow-xs"
          >
            + Input LO Baru
          </button>
          <button
            onClick={() => {
              if (los.length === 0) {
                alert('Silakan input minimal 1 data LO terlebih dahulu sebelum menambahkan Tim TPS.');
                return;
              }
              const defaultVill = villages.find((v) => v.district_id === tpsDistrictId);
              if (defaultVill) setTpsVillageId(defaultVill.id);
              if (los.length > 0 && !tpsLoId) setTpsLoId(los[0].id);
              setTpsAddress('');
              setDptSearchInput('');
              setDptSearchDistrict('ALL');
              setDptResults([]);
              setSelectedDptBadge('');
              setShowTpsModal(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 via-pink-500 to-indigo-600 text-white text-xs font-bold hover:opacity-95 shadow-md shadow-rose-500/20"
          >
            + Input Tim TPS
          </button>
        </div>
      </div>

      {/* Ringkasan Struktur & Frekuensi */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase">Total LO Aktif</span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{los.length} Orang</div>
          <p className="text-xs text-slate-500 mt-1">Koordinator Lapangan Lintas Wilayah</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-bold text-rose-600 uppercase">Total Anggota Tim TPS</span>
          <div className="text-2xl font-extrabold text-rose-600 mt-1">{volunteers.length} Orang</div>
          <p className="text-xs text-slate-500 mt-1">Personel Tim TPS terdata pada jaringan LO</p>
        </div>
      </div>

      {/* Ringkasan Frekuensi Interaksi & Dukungan Tim TPS */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs font-extrabold text-slate-800">
          📊 Deteksi Frekuensi Tim TPS:
        </div>
        <div className="flex flex-wrap items-center gap-2.5 text-xs font-bold">
          <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700">
            🤝 {totalFrequencySummary.meetings}x Pertemuan
          </span>
          <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-800">
            📦 {totalFrequencySummary.items}x Dapat Barang
          </span>
          <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700">
            🎯 {totalFrequencySummary.programs}x Dapat Program
          </span>
        </div>
      </div>

      {/* Tab Navigasi Struktur + Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-bold self-start">
          <button
            onClick={() => setActiveTab('lo')}
            className={`px-4 py-2 rounded-lg transition ${
              activeTab === 'lo' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🧭 Daftar LO ({los.length})
          </button>
          <button
            onClick={() => setActiveTab('tim_tps')}
            className={`px-4 py-2 rounded-lg transition ${
              activeTab === 'tim_tps' ? 'bg-rose-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🗳️ Daftar Tim TPS ({volunteers.length})
          </button>
        </div>

        <div className="flex flex-wrap gap-2.5 flex-1 lg:justify-end">
          {activeTab === 'tim_tps' && (
            <>
              <select
                value={filterDistrict}
                onChange={(e) => setFilterDistrict(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="ALL">Semua Kecamatan TPS</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    KEC. {d.name}
                  </option>
                ))}
              </select>

              <select
                value={filterLo}
                onChange={(e) => setFilterLo(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="ALL">Semua LO Perekrut</option>
                {los.map((l) => (
                  <option key={l.id} value={l.id}>
                    LO: {l.full_name}
                  </option>
                ))}
              </select>
            </>
          )}

          <input
            type="text"
            placeholder={activeTab === 'lo' ? 'Cari nama LO atau WA...' : 'Cari nama, alamat, atau kelurahan...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 w-full sm:w-56"
          />
        </div>
      </div>

      {/* TAB 1: TABEL DAFTAR LO */}
      {activeTab === 'lo' && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4">Nama LO (Klik Buka Halaman)</th>
                  <th className="py-3.5 px-4">Kontak WhatsApp</th>
                  <th className="py-3.5 px-4">Jangkauan Sebaran Tim</th>
                  <th className="py-3.5 px-4 text-center">Frekuensi Tim</th>
                  <th className="py-3.5 px-4 text-center">Jumlah Tim TPS</th>
                  <th className="py-3.5 px-4 text-right">Halaman LO, PDF & WA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Memuat data LO...
                    </td>
                  </tr>
                ) : filteredLos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      Belum ada data LO. Klik <b>📥 Import Excel</b> atau <b>+ Input LO Baru</b> di kanan atas.
                    </td>
                  </tr>
                ) : (
                  filteredLos.map((lo) => {
                    const st = loStats[lo.id] || {
                      teamCount: 0,
                      districts: new Set(),
                      villages: new Set(),
                      meetingFreq: 0,
                      itemFreq: 0,
                      programFreq: 0,
                    };
                    const distList = Array.from(st.districts);
                    const waHref = buildWaLink(
                      lo.whatsapp_number,
                      `Halo LO ${lo.full_name}, koordinasi dari Command Center ANAKMUDATA.`
                    );

                    return (
                      <tr
                        key={lo.id}
                        onClick={() => router.push(`/dashboard/tim-sukses/lo/${lo.id}`)}
                        className="hover:bg-indigo-50/40 cursor-pointer transition"
                      >
                        <td className="py-3.5 px-4">
                          <Link
                            href={`/dashboard/tim-sukses/lo/${lo.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-bold text-slate-900 hover:text-indigo-600 transition"
                          >
                            {lo.full_name} →
                          </Link>
                          {lo.nik && <div className="font-mono text-[11px] text-slate-400">NIK: {lo.nik}</div>}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-emerald-600">{lo.whatsapp_number}</td>
                        <td className="py-3.5 px-4">
                          {distList.length > 0 ? (
                            <div>
                              <span className="font-bold text-slate-800">
                                {distList.length} Kecamatan · {st.villages.size} Kelurahan
                              </span>
                              <div className="text-[11px] text-slate-400 truncate max-w-xs">
                                {distList.join(', ')}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Belum ada tim</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex items-center gap-1.5 text-[10px] font-extrabold">
                            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                              🤝 {st.meetingFreq}x
                            </span>
                            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800">
                              📦 {st.itemFreq}x
                            </span>
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                              🎯 {st.programFreq}x
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-extrabold">
                            🗳️ {st.teamCount} Orang
                          </span>
                        </td>
                        <td
                          className="py-3.5 px-4 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleExportLoPdf(lo)}
                              className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] transition"
                            >
                              📄 PDF LO
                            </button>
                            {waHref ? (
                              <a
                                href={waHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition inline-flex items-center gap-1 shadow-2xs"
                              >
                                💬 Chat WA
                              </a>
                            ) : (
                              <span className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-400 text-[11px]">
                                No. WA Kosong
                              </span>
                            )}
                            <Link
                              href={`/dashboard/tim-sukses/lo/${lo.id}`}
                              className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] transition"
                            >
                              Buka LO →
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: TABEL TIM TPS */}
      {activeTab === 'tim_tps' && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4">Anggota & Alamat Tim TPS</th>
                  <th className="py-3.5 px-4">Lokasi TPS</th>
                  <th className="py-3.5 px-4">LO Perekrut</th>
                  <th className="py-3.5 px-4 text-center">Frekuensi (Pertemuan · Barang · Program)</th>
                  <th className="py-3.5 px-4 text-right">WA & Hapus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Memuat data Tim TPS...
                    </td>
                  </tr>
                ) : filteredVolunteers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400">
                      Belum ada anggota Tim TPS pada filter ini. Klik <b>📥 Import Excel</b> atau <b>+ Input Tim TPS</b>.
                    </td>
                  </tr>
                ) : (
                  filteredVolunteers.map((v) => {
                    const vill = villageMap[v.village_id];
                    const distName = vill ? districtMap[vill.district_id] : '-';
                    const lo = v.lo_id ? loMap[v.lo_id] : null;
                    const tpsLabel = String(v.tps_number).padStart(3, '0');
                    const freq = frequencyByVolunteer[String(v.id)] || {
                      meetingCount: 0,
                      itemCount: 0,
                      programCount: 0,
                    };
                    const waHref = buildWaLink(
                      v.whatsapp_number,
                      `Halo ${v.full_name} (Tim TPS ${tpsLabel} Kel. ${vill?.name || ''}), salam dari Command Center ANAKMUDATA.`
                    );

                    return (
                      <tr key={v.id} className="hover:bg-slate-50/80">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{v.full_name}</div>
                          <div className="font-mono text-[11px] text-slate-400">
                            {v.nik} · <span className="text-emerald-600 font-sans font-semibold">{v.whatsapp_number}</span>
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
                        <td className="py-3.5 px-4">
                          {lo ? (
                            <Link
                              href={`/dashboard/tim-sukses/lo/${lo.id}`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold transition"
                            >
                              🧭 {lo.full_name}
                            </Link>
                          ) : (
                            <span className="text-slate-400 italic">-</span>
                          )}
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
                            className="inline-flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 transition text-[10px] font-extrabold"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-indigo-700">🤝 {freq.meetingCount}x</span>
                              <span className="text-amber-700">📦 {freq.itemCount}x</span>
                              <span className="text-emerald-700">🎯 {freq.programCount}x</span>
                            </div>
                            <span className="text-[9px] text-indigo-600 underline">+ Catat / Detail</span>
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {waHref ? (
                              <a
                                href={waHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition shadow-2xs"
                              >
                                💬 WA
                              </a>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">No. WA -</span>
                            )}
                            <button
                              type="button"
                              disabled={deletingId === v.id}
                              onClick={() => handleDeleteVolunteer(v)}
                              className="px-2.5 py-1.5 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-600 text-[11px] font-bold transition disabled:opacity-50"
                            >
                              {deletingId === v.id ? '...' : '🗑️ Hapus'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL DETEKSI & PENCATATAN FREKUENSI (PERTEMUAN · BARANG · PROGRAM) */}
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
                      📸 Foto Bukti Serah Terima {freqType === 'ITEM' ? '(Wajib · Upload / Kamera · Auto-Kompres)' : '(Opsional)'}
                    </label>
                    {photoInfoText && (
                      <span className="text-[10px] font-bold text-emerald-700">{photoInfoText}</span>
                    )}
                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    required={freqType === 'ITEM' && !compressedPhotoDataUrl}
                    onChange={handlePhotoChange}
                    className="block w-full text-[11px] text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-amber-900 file:text-white hover:file:bg-amber-800"
                  />

                  {compressedPhotoDataUrl && (
                    <div className="pt-1">
                      <img
                        src={compressedPhotoDataUrl}
                        alt="Pratinjau foto bukti serah terima"
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
                            alt="Foto bukti serah terima"
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

      {/* MODAL IMPORT EXCEL MASAL + SMART DPT AUTO-MATCHER */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-5xl w-full p-6 md:p-8 space-y-5 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">📥 Import Kolektif LO & Tim TPS (Smart DPT Matcher)</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kolom <b>NO_TPS</b> boleh dikosongkan — sistem otomatis mencari nama di 1,93 juta DPT Makassar dan mengisi Nomor TPS-nya.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="px-4 py-2 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold self-start sm:self-auto"
              >
                📄 Download Template Excel
              </button>
            </div>

            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-5 bg-slate-50/70 text-center">
              <input
                id="excelFileInput"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleExcelFileUpload}
                className="hidden"
              />
              <label
                htmlFor="excelFileInput"
                className="cursor-pointer inline-flex flex-col items-center gap-1.5"
              >
                <span className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800">
                  Pilih File Excel Rekrutan LO
                </span>
                <span className="text-xs text-slate-500">
                  {importFileName ? `File dipilih: ${importFileName}` : 'Format didukung: .xlsx, .xls, atau .csv'}
                </span>
              </label>
              {matchProgressText && (
                <p className="text-xs font-bold text-indigo-600 mt-2">{matchProgressText}</p>
              )}
            </div>

            {excelRows.length > 0 && (
              <div className="flex-1 overflow-hidden flex flex-col space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700">
                      ✓ {validExcelCount} Baris Valid Siap Masuk
                    </span>
                    <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700">
                      🗂️ {matchedDptExcelCount} Cocok Persis DPT
                    </span>
                    {invalidExcelCount > 0 && (
                      <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-700">
                        ✕ {invalidExcelCount} Perlu Perbaikan
                      </span>
                    )}
                  </div>
                  <span className="text-slate-400">Total terbaca: {excelRows.length} baris</span>
                </div>

                <div className="overflow-auto border border-slate-200 rounded-2xl flex-1">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                      <tr>
                        <th className="py-2.5 px-3">Baris</th>
                        <th className="py-2.5 px-3">LO Perekrut</th>
                        <th className="py-2.5 px-3">Nama Tim TPS</th>
                        <th className="py-2.5 px-3">Kelurahan / TPS</th>
                        <th className="py-2.5 px-3">Pencocokan Database DPT</th>
                        <th className="py-2.5 px-3">Validasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {excelRows.map((r, idx) => (
                        <tr key={r.rowNum} className={r.isValid ? 'bg-white' : 'bg-rose-50/60'}>
                          <td className="py-2 px-3 font-mono text-slate-400">{r.rowNum}</td>
                          <td className="py-2 px-3 font-bold text-indigo-700">{r.loName || '-'}</td>
                          <td className="py-2 px-3">
                            <div className="font-bold text-slate-900">{r.timName || '-'}</div>
                            <div className="text-[10px] text-slate-400">{r.timWa || 'Tanpa WA'}</div>
                          </td>
                          <td className="py-2 px-3">
                            <span className="font-bold text-slate-800">{r.villageName}</span>{' '}
                            <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-extrabold text-[10px]">
                              TPS {String(r.tpsNumber).padStart(3, '0')}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            {!r.isValid ? (
                              <span className="text-slate-400">-</span>
                            ) : r.dptStatus === 'idle' ? (
                              <span className="text-slate-400 italic">Mengecek DPT...</span>
                            ) : r.dptStatus === 'matched' && r.selectedDpt ? (
                              <div className="text-[11px] font-bold text-emerald-700">
                                🟢 Terverifikasi DPT ({r.selectedDpt.gender}, {r.selectedDpt.age} Thn · RT {r.selectedDpt.rt}/{r.selectedDpt.rw})
                              </div>
                            ) : r.dptStatus === 'ambiguous' ? (
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold text-amber-700 block">
                                  🟡 Ada {r.dptCandidates.length} nama mirip, pilih yang sesuai:
                                </span>
                                <select
                                  value={r.selectedDpt?.id || ''}
                                  onChange={(e) => handlePickCandidateInPreview(idx, e.target.value)}
                                  className="px-2 py-1 rounded border border-amber-300 bg-amber-50 text-[11px] font-bold text-slate-800 max-w-[230px]"
                                >
                                  {r.dptCandidates.map((cand) => (
                                    <option key={cand.id} value={cand.id}>
                                      {cand.full_name} ({cand.gender}, {cand.age}th · TPS {cand.tps_number})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              <span className="text-[11px] font-semibold text-slate-500">
                                ⚪ Belum cocok DPT (tetap bisa masuk)
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {r.isValid ? (
                              <span className="text-emerald-600 font-bold">✓ Siap</span>
                            ) : (
                              <span className="text-rose-600 font-bold">{r.errorReason}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
              >
                Tutup
              </button>
              <button
                type="button"
                disabled={importingExcel || matchingDptBulk || validExcelCount === 0}
                onClick={handleConfirmExcelImport}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
              >
                {matchingDptBulk
                  ? 'Mencocokkan DPT...'
                  : importingExcel
                  ? 'Mengimpor ke Database...'
                  : `Simpan ${validExcelCount} Data Valid ke Database`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INPUT LO BARU */}
      {showLoModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSaveLo} className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-extrabold text-slate-900">+ Input LO Baru</h3>
            <p className="text-xs text-slate-500">
              LO bergerak lintas kelurahan dan kecamatan se-Kota Makassar untuk merekrut & membina Tim TPS.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap LO *</label>
                <input
                  required
                  value={loName}
                  onChange={(e) => setLoName(e.target.value)}
                  placeholder="Nama lengkap sesuai KTP"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">No. WhatsApp *</label>
                <input
                  required
                  value={loWa}
                  onChange={(e) => setLoWa(e.target.value)}
                  placeholder="0812xxxxxxxx"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">NIK (Opsional)</label>
                <input
                  maxLength={16}
                  value={loNik}
                  onChange={(e) => setLoNik(e.target.value.replace(/\D/g, ''))}
                  placeholder="16 digit NIK"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setShowLoModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={savingLo}
                className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
              >
                {savingLo ? 'Menyimpan...' : 'Simpan Data LO'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL INPUT TIM TPS BARU (DENGAN PENCARIAN DPT INSTAN & KOLOM ALAMAT) */}
      {showTpsModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleSaveTimTps}
            className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl max-h-[92vh] overflow-y-auto"
          >
            <h3 className="text-lg font-extrabold text-slate-900">+ Input Calon / Anggota Tim TPS</h3>

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

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">LO Perekrut / Penanggung Jawab *</label>
                <select
                  required
                  value={tpsLoId}
                  onChange={(e) => setTpsLoId(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white font-semibold text-indigo-900"
                >
                  {los.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.full_name} ({l.whatsapp_number})
                    </option>
                  ))}
                </select>
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
                {savingTps ? 'Menyimpan...' : 'Simpan Data'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}