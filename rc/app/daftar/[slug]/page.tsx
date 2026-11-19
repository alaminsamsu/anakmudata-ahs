import { supabase } from '@/lib/supabase';
import RegistrationForm from '@/components/registration/RegistrationForm';
import { Village } from '@/types/database';
import { AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { slug: string };
  searchParams: { ref?: string };
}

export default async function DaftarRelawanPage({ params, searchParams }: PageProps) {
  const { data: village, error } = await supabase
    .from('villages')
    .select('*, districts(*)')
    .eq('slug', params.slug)
    .single();

  if (error || !village) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Link Kelurahan Tidak Ditemukan</h1>
          <p className="text-xs text-slate-500">
            Pastikan Anda membuka link pendaftaran resmi yang dibagikan oleh Koordinator Kelurahan
            (Kordes) Anakmudata AHS.
          </p>
        </div>
      </main>
    );
  }

  // Ambil okupansi slot TPS di kelurahan ini
  const { data: occupancy } = await supabase
    .from('public_tps_occupancy')
    .select('tps_number, filled_slots')
    .eq('village_id', village.id);

  const occupiedMap: Record<number, number> = {};
  (occupancy || []).forEach((item) => {
    occupiedMap[item.tps_number] = Number(item.filled_slots);
  });

  return (
    <main className="min-h-screen py-6 px-4 bg-slate-50">
      <div className="max-w-lg mx-auto space-y-4">
        <div className="text-center space-y-1">
          <span className="inline-block px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-[11px] font-bold tracking-wider uppercase">
            Anakmudata AHS • Kota Makassar
          </span>
          <h1 className="text-xl font-extrabold text-slate-900">
            Formulir Relawan & Saksi TPS
          </h1>
          <p className="text-xs text-slate-500">
            Lengkapi data diri Anda sesuai KTP untuk pengamanan suara TPS.
          </p>
        </div>

        <RegistrationForm
          village={village as Village}
          occupiedMap={occupiedMap}
          referredBy={searchParams.ref || null}
        />
      </div>
    </main>
  );
}