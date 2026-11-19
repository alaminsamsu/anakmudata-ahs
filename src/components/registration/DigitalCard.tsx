'use client';

import { CheckCircle2, MapPin, ShieldCheck, MessageCircle } from 'lucide-react';

interface DigitalCardProps {
  fullName: string;
  nik: string;
  whatsappNumber: string;
  districtName: string;
  villageName: string;
  tpsNumber: number;
}

export default function DigitalCard({
  fullName,
  nik,
  whatsappNumber,
  districtName,
  villageName,
  tpsNumber,
}: DigitalCardProps) {
  const maskedNik = `${nik.slice(0, 6)}******${nik.slice(-4)}`;

  const handleConfirmWA = () => {
    const text = encodeURIComponent(
      `Halo Tim Anakmudata AHS, saya *${fullName}* baru saja mendaftar sebagai Relawan *TPS ${String(
        tpsNumber
      ).padStart(3, '0')}* Kelurahan *${villageName}*, Kec. *${districtName}* (Kota Makassar). Mohon bantuan verifikasinya.`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
      <div className="bg-slate-900 text-white p-6 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mb-3">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold tracking-wide">PENDAFTARAN BERHASIL</h2>
        <p className="text-xs text-slate-300 mt-1">
          Kartu Bukti Registrasi Relawan — Anakmudata AHS
        </p>
      </div>

      <div className="p-6 space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
          <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900">
            <span className="font-semibold block">Status: Menunggu Verifikasi Kordes</span>
            Silakan screenshot layar ini sebagai bukti pendaftaran Anda.
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              Nama Lengkap Relawan
            </p>
            <p className="text-base font-bold text-slate-900">{fullName}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                NIK
              </p>
              <p className="text-sm font-mono font-semibold text-slate-700">{maskedNik}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                No. WhatsApp
              </p>
              <p className="text-sm font-semibold text-slate-700">{whatsappNumber}</p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200">
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              Penugasan Wilayah
            </p>
            <div className="flex items-center justify-between mt-1">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                <MapPin className="w-4 h-4 text-orange-600 shrink-0" />
                <span>
                  KEL. {villageName}, KEC. {districtName}
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-bold">
                TPS {String(tpsNumber).padStart(3, '0')}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleConfirmWA}
          className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 transition"
        >
          <MessageCircle className="w-4 h-4" />
          Kirim Bukti Daftar ke Koordinator (WA)
        </button>
      </div>
    </div>
  );
}