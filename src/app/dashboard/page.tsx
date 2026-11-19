'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Coordinator, Village, Volunteer } from '@/types/database';
import {
  LogOut,
  CheckCircle2,
  XCircle,
  Eye,
  MessageCircle,
  Link as LinkIcon,
  Copy,
  Check,
  Loader2,
  ShieldCheck,
  X,
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const [coordinator, setCoordinator] = useState<Coordinator | null>(null);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [copied, setCopied] = useState(false);

  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [ktpModalUrl, setKtpModalUrl] = useState<string | null>(null);
  const [ktpModalName, setKtpModalName] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    initDashboard();
  }, []);

  const initDashboard = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    const { data: coordData } = await supabase
      .from('coordinators')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!coordData) {
      await supabase.auth.signOut();
      router.push('/login');
      return;
    }

    setCoordinator(coordData as Coordinator);

    // Ambil daftar kelurahan untuk generator link
    const { data: villageList } = await supabase
      .from('villages')
      .select('*, districts(*)')
      .order('name', { ascending: true });

    if (villageList && villageList.length > 0) {
      setVillages(villageList as Village[]);
      setSelectedSlug(villageList[0].slug);
    }

    await fetchVolunteers();
    setLoading(false);
  };

  const fetchVolunteers = async () => {
    const { data } = await supabase
      .from('volunteers')
      .select('*, villages(*, districts(*))')
      .order('created_at', { ascending: false });

    if (data) setVolunteers(data as Volunteer[]);
  };

  const handleViewKTP = async (vol: Volunteer) => {
    const { data, error } = await supabase.storage
      .from('ktp-documents')
      .createSignedUrl(vol.ktp_storage_path, 60);

    if (error || !data?.signedUrl) {
      alert('Gagal memuat foto KTP.');
      return;
    }

    setKtpModalName(`${vol.full_name} — NIK: ${vol.nik}`);
    setKtpModalUrl(data.signedUrl);
  };

  const handleVerify = async (volId: string, newStatus: 'approved' | 'rejected') => {
    let reason: string | null = null;
    if (newStatus === 'rejected') {
      reason = prompt('Masukkan alasan penolakan (contoh: Foto KTP buram / bukan warga TPS ini):');
      if (reason === null) return;
    }

    setActionLoading(volId);
    const { error } = await supabase
      .from('volunteers')
      .update({
        status: newStatus,
        rejection_reason: reason,
        verified_by: coordinator?.id,
      })
      .eq('id', volId);

    if (!error) {
      await fetchVolunteers();
    }
    setActionLoading(null);
  };

  const handleCopyLink = () => {
    if (!selectedSlug || !coordinator) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://anakmudata.id';
    const url = `${origin}/daftar/${selectedSlug}?ref=${coordinator.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-orange-600" />
      </div>
    );
  }

  const totalApproved = volunteers.filter((v) => v.status === 'approved').length;
  const totalPending = volunteers.filter((v) => v.status === 'pending').length;
  const totalRejected = volunteers.filter((v) => v.status === 'rejected').length;

  const filteredVolunteers =
    statusFilter === 'all' ? volunteers : volunteers.filter((v) => v.status === statusFilter);

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Header */}
      <header className="bg-slate-900 text-white px-4 py-4 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-base font-extrabold tracking-tight">
              ANAKMUDATA <span className="text-orange-500">AHS</span>
            </h1>
            <p className="text-[11px] text-slate-400">
              {coordinator?.full_name} • <span className="uppercase text-orange-400">{coordinator?.role}</span>
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" /> Keluar
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-6 space-y-6">
        {/* Statistik Ringkas */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-[11px] font-semibold text-slate-400 uppercase">Menunggu (Pending)</p>
            <p className="text-2xl font-black text-amber-600 mt-1">{totalPending}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-[11px] font-semibold text-slate-400 uppercase">Terverifikasi</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{totalApproved}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-[11px] font-semibold text-slate-400 uppercase">Ditolak</p>
            <p className="text-2xl font-black text-red-600 mt-1">{totalRejected}</p>
          </div>
        </div>

        {/* Generator Link Pendaftaran Kelurahan */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <LinkIcon className="w-4 h-4 text-orange-600" />
            <span>Bagikan Link Pendaftaran Relawan TPS (Makassar)</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <select
              value={selectedSlug}
              onChange={(e) => setSelectedSlug(e.target.value)}
              className="flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm bg-white"
            >
              {villages.map((v) => (
                <option key={v.id} value={v.slug}>
                  KEL. {v.name} — KEC. {v.districts?.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleCopyLink}
              className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center justify-center gap-1.5"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Link Tersalin!' : 'Salin Link Kelurahan'}
            </button>
          </div>
        </div>

        {/* Filter & Daftar Relawan */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Data Pendaftar Relawan TPS</span>
            </div>
            <div className="flex gap-1.5">
              {(['pending', 'approved', 'rejected', 'all'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize ${
                    statusFilter === st
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredVolunteers.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Belum ada data relawan pada kategori ini.
              </div>
            ) : (
              filteredVolunteers.map((vol) => (
                <div key={vol.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-[11px] font-bold">
                        TPS {String(vol.tps_number).padStart(3, '0')}
                      </span>
                      <span className="text-xs font-semibold text-orange-600">
                        KEL. {vol.villages?.name} ({vol.villages?.districts?.name})
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-900">{vol.full_name}</p>
                    <p className="text-xs font-mono text-slate-500">
                      NIK: {vol.nik} • WA: {vol.whatsapp_number}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleViewKTP(vol)}
                      className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" /> KTP
                    </button>
                    <a
                      href={`https://wa.me/${vol.whatsapp_number}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> WA
                    </a>
                    {vol.status === 'pending' && (
                      <>
                        <button
                          disabled={actionLoading === vol.id}
                          onClick={() => handleVerify(vol.id, 'approved')}
                          className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          disabled={actionLoading === vol.id}
                          onClick={() => handleVerify(vol.id, 'rejected')}
                          className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Tolak
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Modal Preview KTP (Signed URL 60 Detik) */}
      {ktpModalUrl && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <p className="text-xs font-bold text-slate-900">{ktpModalName}</p>
              <button onClick={() => setKtpModalUrl(null)} className="p-1 text-slate-500 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-slate-100 flex justify-center">
              <img src={ktpModalUrl} alt="Foto KTP" className="max-h-[70vh] rounded-lg object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}