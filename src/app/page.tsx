import Link from 'next/link';
import { Shield, Users, ArrowRight } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-950 text-white">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-semibold">
          <Shield className="w-3.5 h-3.5" />
          DAPIL SULAWESI SELATAN I • KOTA MAKASSAR
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-tight">
            ANAKMUDATA <span className="text-orange-500">AHS</span>
          </h1>
          <p className="text-sm text-slate-400">
            Sistem Konsolidasi Jaringan, Pemetaan Wilayah, dan Penjaringan Relawan TPS Caleg DPR RI.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 text-left">
          <p className="text-xs text-slate-400">
            <strong className="text-white">Calon Relawan TPS:</strong> Silakan gunakan tautan khusus
            kelurahan yang dibagikan oleh Koordinator Kelurahan (Kordes) setempat untuk mendaftar.
          </p>
          <div className="pt-2 border-t border-slate-800">
            <Link
              href="/login"
              className="w-full py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition"
            >
              <Users className="w-4 h-4" />
              Masuk Dashboard Koordinator
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}