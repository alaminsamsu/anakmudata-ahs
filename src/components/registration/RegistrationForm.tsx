'use client';

import { useState } from 'react';
import imageCompression from 'browser-image-compression';
import { supabase } from '@/lib/supabase';
import { Village } from '@/types/database';
import { Camera, Loader2, AlertCircle, CheckCircle, Upload } from 'lucide-react';
import DigitalCard from './DigitalCard';

interface RegistrationFormProps {
  village: Village;
  occupiedMap: Record<number, number>; // { tps_number: filled_slots }
  referredBy: string | null;
}

export default function RegistrationForm({
  village,
  occupiedMap,
  referredBy,
}: RegistrationFormProps) {
  const [tpsNumber, setTpsNumber] = useState<string>('');
  const [fullName, setFullName] = useState('');
  const [nik, setNik] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [ktpFile, setKtpFile] = useState<File | null>(null);
  const [ktpPreview, setKtpPreview] = useState<string | null>(null);

  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedData, setSubmittedData] = useState<{
    fullName: string;
    nik: string;
    whatsappNumber: string;
    tpsNumber: number;
  } | null>(null);

  const districtName = village.districts?.name || 'MAKASSAR';
  const tpsList = Array.from({ length: village.total_tps }, (_, i) => i + 1);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setIsCompressing(true);

    try {
      const options = {
        maxSizeMB: 0.24, // Maksimal ~240 KB
        maxWidthOrHeight: 1280,
        useWebWorker: true,
        fileType: 'image/webp',
      };
      const compressedFile = await imageCompression(file, options);
      setKtpFile(compressedFile);
      setKtpPreview(URL.createObjectURL(compressedFile));
    } catch {
      setErrorMsg('Gagal memproses foto KTP. Silakan coba ambil foto ulang.');
    } finally {
      setIsCompressing(false);
    }
  };

  const normalizePhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('0')) return '62' + digits.slice(1);
    if (digits.startsWith('8')) return '62' + digits;
    return digits;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!tpsNumber) return setErrorMsg('Silakan pilih nomor TPS Anda.');
    if (fullName.trim().length < 3) return setErrorMsg('Nama lengkap wajib diisi sesuai KTP.');
    if (!/^\d{16}$/.test(nik)) return setErrorMsg('NIK harus terdiri dari tepat 16 digit angka.');

    const normalizedWA = normalizePhone(whatsapp);
    if (normalizedWA.length < 10 || normalizedWA.length > 15) {
      return setErrorMsg('Nomor WhatsApp tidak valid.');
    }
    if (!ktpFile) return setErrorMsg('Foto KTP wajib diunggah.');

    setIsSubmitting(true);

    try {
      const storagePath = `makassar/${village.district_id}/${village.id}/${nik}-${Date.now()}.webp`;

      // 1. Upload foto KTP ke Private Bucket
      const { error: uploadError } = await supabase.storage
        .from('ktp-documents')
        .upload(storagePath, ktpFile, {
          contentType: 'image/webp',
          upsert: false,
        });

      if (uploadError) {
        throw new Error('Gagal mengunggah foto KTP. Periksa koneksi internet Anda.');
      }

      // 2. Simpan data relawan ke tabel volunteers
      const { error: insertError } = await supabase.from('volunteers').insert({
        village_id: village.id,
        tps_number: Number(tpsNumber),
        full_name: fullName.trim().toUpperCase(),
        nik,
        whatsapp_number: normalizedWA,
        ktp_storage_path: storagePath,
        status: 'pending',
        referred_by: referredBy || null,
      });

      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error(
            'NIK atau Nomor WhatsApp ini sudah terdaftar sebagai relawan di TPS lain.'
          );
        }
        throw new Error(insertError.message || 'Gagal menyimpan data pendaftaran.');
      }

      setSubmittedData({
        fullName: fullName.trim().toUpperCase(),
        nik,
        whatsappNumber: normalizedWA,
        tpsNumber: Number(tpsNumber),
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submittedData) {
    return (
      <DigitalCard
        fullName={submittedData.fullName}
        nik={submittedData.nik}
        whatsappNumber={submittedData.whatsappNumber}
        districtName={districtName}
        villageName={village.name}
        tpsNumber={submittedData.tpsNumber}
      />
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 space-y-5"
    >
      {/* Wilayah Terkunci */}
      <div className="bg-slate-900 text-white rounded-xl p-4">
        <p className="text-[11px] uppercase tracking-wider text-orange-400 font-semibold">
          Wilayah Penugasan (Terkunci)
        </p>
        <p className="text-base font-bold mt-0.5">
          KEL. {village.name} — KEC. {districtName}
        </p>
        <p className="text-xs text-slate-300 mt-0.5">KOTA MAKASSAR • DAPIL SULSEL I</p>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3.5 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Pilih Nomor TPS */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
          1. Pilih Nomor TPS <span className="text-red-500">*</span>
        </label>
        <select
          value={tpsNumber}
          onChange={(e) => setTpsNumber(e.target.value)}
          required
          className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm font-medium focus:border-slate-900 focus:outline-none"
        >
          <option value="">-- Pilih Nomor TPS di Kel. {village.name} --</option>
          {tpsList.map((num) => {
            const count = occupiedMap[num] || 0;
            const isFull = count >= 2;
            return (
              <option key={num} value={num} disabled={isFull}>
                TPS {String(num).padStart(3, '0')}{' '}
                {isFull ? '(SLOT PENUH)' : count === 1 ? '(Tersisa 1 Slot)' : '(Tersedia)'}
              </option>
            );
          })}
        </select>
      </div>

      {/* Nama Lengkap */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
          2. Nama Lengkap (Sesuai KTP) <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Contoh: MUHAMMAD AKBAR"
          required
          className="w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm uppercase focus:border-slate-900 focus:outline-none"
        />
      </div>

      {/* NIK */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
          3. Nomor Induk Kependudukan (NIK 16 Digit) <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          inputMode="numeric"
          maxLength={16}
          value={nik}
          onChange={(e) => setNik(e.target.value.replace(/\D/g, ''))}
          placeholder="7371xxxxxxxxxxxx"
          required
          className="w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm font-mono focus:border-slate-900 focus:outline-none"
        />
        <p className="text-[11px] text-slate-400 mt-1">{nik.length}/16 digit</p>
      </div>

      {/* Nomor WhatsApp */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
          4. Nomor WhatsApp Aktif <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          inputMode="tel"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="Contoh: 081234567890"
          required
          className="w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm focus:border-slate-900 focus:outline-none"
        />
      </div>

      {/* Upload Foto KTP */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
          5. Foto KTP Asli <span className="text-red-500">*</span>
        </label>

        <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-slate-300 hover:border-slate-900 rounded-xl p-4 cursor-pointer bg-slate-50 transition">
          {isCompressing ? (
            <div className="flex flex-col items-center py-4 text-slate-600">
              <Loader2 className="w-6 h-6 animate-spin mb-1" />
              <span className="text-xs font-medium">Mengompresi foto KTP...</span>
            </div>
          ) : ktpPreview ? (
            <div className="w-full space-y-2 text-center">
              <img
                src={ktpPreview}
                alt="Pratinjau KTP"
                className="max-h-44 mx-auto rounded-lg object-contain border border-slate-200"
              />
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                <CheckCircle className="w-3.5 h-3.5" /> Foto siap diunggah (Klik untuk ganti)
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center py-3 text-slate-500">
              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center mb-2 text-slate-700">
                <Camera className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-slate-800">
                Ambil Foto KTP / Pilih dari Galeri
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5">
                Otomatis dikompres agar hemat kuota
              </span>
            </div>
          )}

          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={isSubmitting || isCompressing}
        className="w-full py-3.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Menyimpan Pendaftaran...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            Kirim Pendaftaran Relawan TPS
          </>
        )}
      </button>
    </form>
  );
}