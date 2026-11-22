'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

interface VolunteerRow {
  id: string;
  full_name: string;
  phone: string | null;
  tps_number: number | null;
  village_id: string | null;
  met_candidate: boolean | null;
}

interface ActivityRow {
  id: string;
  volunteer_id: string;
  activity_type: 'MEETING' | 'ITEM' | 'PROGRAM';
  activity_title: string;
  activity_date: string;
  notes: string | null;
}

interface SummaryRow {
  volunteer_id: string;
  meeting_count: number;
  item_count: number;
  program_count: number;
  last_activity_date: string | null;
}

export default function TpsActivityTracker() {
  const [volunteers, setVolunteers] = useState<VolunteerRow[]>([]);
  const [summaries, setSummaries] = useState<Record<string, SummaryRow>>({});
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [filterType, setFilterType] = useState<'ALL' | 'NO_MEETING' | 'NO_ITEM' | 'NO_PROGRAM'>('ALL');

  // Modal Tambah / Lihat Riwayat Aktivitas
  const [selectedVolunteer, setSelectedVolunteer] = useState<VolunteerRow | null>(null);
  const [activityType, setActivityType] = useState<'MEETING' | 'ITEM' | 'PROGRAM'>('MEETING');
  const [activityTitle, setActivityTitle] = useState<string>('');
  const [activityDate, setActivityDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    loadTrackerData();
  }, []);

  async function loadTrackerData() {
    setLoading(true);
    setErrorMsg('');

    const [volRes, sumRes, actRes] = await Promise.all([
      supabase
        .from('volunteers')
        .select('id, full_name, phone, tps_number, village_id, met_candidate')
        .order('full_name', { ascending: true })
        .limit(500),
      supabase.from('tps_team_activity_summary').select('*').limit(500),
      supabase
        .from('tps_team_activities')
        .select('id, volunteer_id, activity_type, activity_title, activity_date, notes')
        .order('activity_date', { ascending: false })
        .limit(300),
    ]);

    if (volRes.error || sumRes.error || actRes.error) {
      setErrorMsg(
        volRes.error?.message ||
          sumRes.error?.message ||
          actRes.error?.message ||
          'Gagal memuat data aktivitas Tim TPS.'
      );
    }

    if (volRes.data) setVolunteers(volRes.data as VolunteerRow[]);

    if (sumRes.data) {
      const map: Record<string, SummaryRow> = {};
      sumRes.data.forEach((s: any) => {
        map[String(s.volunteer_id)] = {
          volunteer_id: String(s.volunteer_id),
          meeting_count: Number(s.meeting_count) || 0,
          item_count: Number(s.item_count) || 0,
          program_count: Number(s.program_count) || 0,
          last_activity_date: s.last_activity_date || null,
        };
      });
      setSummaries(map);
    }

    if (actRes.data) setActivities(actRes.data as ActivityRow[]);
    setLoading(false);
  }

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVolunteer || !activityTitle.trim()) return;
    setSaving(true);
    setErrorMsg('');

    const { error } = await supabase.from('tps_team_activities').insert({
      volunteer_id: selectedVolunteer.id,
      activity_type: activityType,
      activity_title: activityTitle.trim(),
      activity_date: activityDate,
      notes: notes.trim() || null,
    });

    setSaving(false);
    if (error) {
      setErrorMsg(`Gagal menyimpan aktivitas: ${error.message}`);
      return;
    }

    setActivityTitle('');
    setNotes('');
    await loadTrackerData();
  };

  const handleDeleteActivity = async (activityId: string) => {
    const { error } = await supabase.from('tps_team_activities').delete().eq('id', activityId);
    if (!error) {
      await loadTrackerData();
    }
  };

  const enrichedRows = useMemo(() => {
    return volunteers.map((v) => {
      const s = summaries[String(v.id)] || {
        volunteer_id: String(v.id),
        meeting_count: 0,
        item_count: 0,
        program_count: 0,
        last_activity_date: null,
      };
      return {
        ...v,
        meeting_count: s.meeting_count,
        item_count: s.item_count,
        program_count: s.program_count,
        total_touchpoints: s.meeting_count + s.item_count + s.program_count,
        last_activity_date: s.last_activity_date,
      };
    });
  }, [volunteers, summaries]);

  const totals = useMemo(() => {
    return enrichedRows.reduce(
      (acc, r) => {
        acc.meetings += r.meeting_count;
        acc.items += r.item_count;
        acc.programs += r.program_count;
        if (r.meeting_count > 0) acc.withMeeting += 1;
        if (r.item_count > 0) acc.withItem += 1;
        if (r.program_count > 0) acc.withProgram += 1;
        return acc;
      },
      { meetings: 0, items: 0, programs: 0, withMeeting: 0, withItem: 0, withProgram: 0 }
    );
  }, [enrichedRows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enrichedRows.filter((row) => {
      const matchSearch =
        !q ||
        row.full_name.toLowerCase().includes(q) ||
        String(row.tps_number || '').includes(q) ||
        String(row.phone || '').toLowerCase().includes(q);

      if (!matchSearch) return false;
      if (filterType === 'NO_MEETING') return row.meeting_count === 0;
      if (filterType === 'NO_ITEM') return row.item_count === 0;
      if (filterType === 'NO_PROGRAM') return row.program_count === 0;
      return true;
    });
  }, [enrichedRows, search, filterType]);

  const selectedVolunteerActivities = useMemo(() => {
    if (!selectedVolunteer) return [];
    return activities.filter((a) => String(a.volunteer_id) === String(selectedVolunteer.id));
  }, [activities, selectedVolunteer]);

  const typeLabel = (t: 'MEETING' | 'ITEM' | 'PROGRAM') => {
    if (t === 'MEETING') return '🤝 Pertemuan';
    if (t === 'ITEM') return '📦 Dapat Barang';
    return '🎯 Dapat Program';
  };

  return (
    <div className="space-y-6">
      {/* Header & Ringkasan Frekuensi */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-extrabold uppercase tracking-wider mb-1">
            Deteksi Frekuensi Tim TPS · Pertemuan · Barang · Program
          </span>
          <h2 className="text-xl font-extrabold text-slate-900">
            📋 Rekap Frekuensi Interaksi & Dukungan Tim TPS
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pantau otomatis berapa kali tiap anggota Tim TPS sudah mengikuti pertemuan, menerima barang, dan mendapatkan program.
          </p>
        </div>

        <button
          type="button"
          onClick={loadTrackerData}
          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold self-start lg:self-auto"
        >
          🔄 Segarkan Rekap
        </button>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* 3 Kartu Rekap Akumulasi Frekuensi */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <div className="text-[11px] font-bold text-indigo-600 uppercase">🤝 Total Pertemuan</div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">
            {totals.meetings.toLocaleString('id-ID')} Kali
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {totals.withMeeting} dari {enrichedRows.length} anggota sudah ikut pertemuan
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <div className="text-[11px] font-bold text-amber-700 uppercase">📦 Total Penerimaan Barang</div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">
            {totals.items.toLocaleString('id-ID')} Kali
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {totals.withItem} dari {enrichedRows.length} anggota sudah menerima barang
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <div className="text-[11px] font-bold text-emerald-700 uppercase">🎯 Total Penerimaan Program</div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">
            {totals.programs.toLocaleString('id-ID')} Kali
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {totals.withProgram} dari {enrichedRows.length} anggota sudah dapat program
          </div>
        </div>
      </div>

      {/* Filter & Pencarian Anggota Tim TPS */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
          >
            <option value="ALL">Semua Anggota Tim TPS</option>
            <option value="NO_MEETING">Belum Pernah Pertemuan (0x)</option>
            <option value="NO_ITEM">Belum Pernah Dapat Barang (0x)</option>
            <option value="NO_PROGRAM">Belum Pernah Dapat Program (0x)</option>
          </select>
        </div>

        <input
          type="text"
          placeholder="Cari nama Tim TPS atau No. TPS..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 w-full md:w-64"
        />
      </div>

      {/* Tabel Deteksi Frekuensi Per Anggota Tim TPS */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-4">Anggota Tim TPS</th>
                <th className="py-3.5 px-4 text-center">No. TPS</th>
                <th className="py-3.5 px-4 text-center">🤝 Pertemuan</th>
                <th className="py-3.5 px-4 text-center">📦 Dapat Barang</th>
                <th className="py-3.5 px-4 text-center">🎯 Dapat Program</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    Memuat rekap frekuensi Tim TPS...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    Tidak ada data Tim TPS yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4">
                      <div className="font-extrabold text-slate-900">{row.full_name}</div>
                      <div className="text-[10px] text-slate-400">
                        {row.phone || 'Tanpa no. HP'}
                        {row.last_activity_date ? ` · Update: ${row.last_activity_date}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-700">
                      {row.tps_number ? `TPS ${String(row.tps_number).padStart(3, '0')}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                          row.meeting_count > 0
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {row.meeting_count}x Pertemuan
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                          row.item_count > 0
                            ? 'bg-amber-50 text-amber-800'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {row.item_count}x Barang
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                          row.program_count > 0
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {row.program_count}x Program
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedVolunteer(row);
                          setActivityType('MEETING');
                          setActivityTitle('');
                          setNotes('');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-extrabold transition"
                      >
                        + Catat / Riwayat
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Catat Aktivitas & Lihat Riwayat Per Anggota Tim TPS */}
      {selectedVolunteer && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-extrabold uppercase text-indigo-600">
                  Log Frekuensi Tim TPS
                </div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {selectedVolunteer.full_name}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedVolunteer.tps_number
                    ? `TPS ${String(selectedVolunteer.tps_number).padStart(3, '0')}`
                    : 'TPS belum diatur'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVolunteer(null)}
                className="px-3 py-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
              >
                Tutup
              </button>
            </div>

            <form onSubmit={handleAddActivity} className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Jenis Pencatatan
                  </label>
                  <select
                    value={activityType}
                    onChange={(e) => setActivityType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white"
                  >
                    <option value="MEETING">🤝 Pertemuan</option>
                    <option value="ITEM">📦 Dapat Barang / Logistik</option>
                    <option value="PROGRAM">🎯 Dapat Program</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Tanggal
                  </label>
                  <input
                    type="date"
                    value={activityDate}
                    onChange={(e) => setActivityDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Nama Pertemuan / Barang / Program
                </label>
                <input
                  type="text"
                  value={activityTitle}
                  onChange={(e) => setActivityTitle(e.target.value)}
                  placeholder="Contoh: Rapat Koordinasi LO, Paket Kaos & Atribut, atau Program Beasiswa/UMKM..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Catatan Tambahan (Opsional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Catatan singkat..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold"
                >
                  {saving ? 'Menyimpan...' : '+ Simpan (+1 Frekuensi)'}
                </button>
              </div>
            </form>

            {/* Daftar Riwayat Aktivitas Anggota Ini */}
            <div className="space-y-2">
              <div className="text-xs font-extrabold text-slate-800">
                Riwayat Tercatat ({selectedVolunteerActivities.length})
              </div>
              {selectedVolunteerActivities.length === 0 ? (
                <p className="text-xs text-slate-400">Belum ada riwayat pertemuan, barang, atau program.</p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl px-3">
                  {selectedVolunteerActivities.map((act) => (
                    <div key={act.id} className="py-2.5 flex items-start justify-between gap-2 text-xs">
                      <div>
                        <div className="font-bold text-slate-900">
                          {typeLabel(act.activity_type)} · {act.activity_title}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {act.activity_date}
                          {act.notes ? ` · ${act.notes}` : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteActivity(act.id)}
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