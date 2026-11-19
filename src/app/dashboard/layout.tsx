'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface CoordinatorProfile {
  id: string;
  full_name: string;
  role: string;
  district_id: string | null;
  village_id: string | null;
}

const MENU_ITEMS = [
  { name: 'Dashboard Utama', href: '/dashboard', icon: '📊' },
  { name: 'Data Wilayah', href: '/dashboard/wilayah', icon: '📍' },
  { name: 'DPT', href: '/dashboard/dpt', icon: '🗂️' },
  { name: 'Pemilih', href: '/dashboard/pemilih', icon: '🗳️' },
  { name: 'Tim Sukses', href: '/dashboard/tim-sukses', icon: '🤝' },
  { name: 'Logistik', href: '/dashboard/logistik', icon: '📦' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<CoordinatorProfile | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }

      const { data, error } = await supabase
        .from('coordinators')
        .select('id, full_name, role, district_id, village_id')
        .eq('id', session.user.id)
        .single();

      if (error || !data) {
        await supabase.auth.signOut();
        router.replace('/login');
        return;
      }

      setProfile(data);
      setLoading(false);
    }
    loadUser();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center text-slate-600 text-sm font-medium">
        Memuat Command Center ANAKMUDATA...
      </div>
    );
  }

  const initials = (profile?.full_name || 'AA')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F8FAFC] text-slate-800">
      {/* Top Bar Mobile */}
      <div className="md:hidden bg-white px-4 py-3 flex items-center justify-between border-b border-slate-200 sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-500 via-pink-500 to-indigo-600 flex items-center justify-center text-white font-extrabold text-xs">
            A
          </div>
          <div>
            <div className="font-extrabold text-sm text-slate-900">ANAKMUDATA</div>
            <div className="text-[10px] text-slate-400 font-semibold">{profile?.role.toUpperCase()}</div>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="px-3 py-1.5 rounded-xl bg-slate-100 text-xs font-bold text-slate-700"
        >
          {mobileMenuOpen ? 'Tutup' : '☰ Menu'}
        </button>
      </div>

      {/* Sidebar Navigasi (Gaya Stitch Modern Putih) */}
      <aside
        className={`${
          mobileMenuOpen ? 'block' : 'hidden'
        } md:flex md:w-[270px] bg-white border-r border-slate-100 flex-col justify-between shrink-0 md:h-screen md:sticky md:top-0 z-30 shadow-sm`}
      >
        <div className="p-6">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 via-pink-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/25 font-extrabold text-base">
              A
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-slate-900">ANAKMUDATA</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100">
                  Live
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">Command Center Makassar</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {MENU_ITEMS.map((item) => {
              const isActive =
                item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-rose-500/10 to-indigo-500/5 text-rose-600 font-bold border border-rose-100/80 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Sidebar Widget: Kawal Makassar Menang */}
        <div className="p-4 m-4 rounded-2xl bg-gradient-to-br from-rose-500 via-pink-600 to-indigo-600 text-white shadow-lg shadow-rose-500/25 relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-white/20">
              Kota Makassar
            </span>
            <span className="text-xs font-bold text-white/90">15 Kec</span>
          </div>
          <h4 className="font-bold text-sm leading-snug">Kawal Makassar Menang</h4>
          <p className="text-[11px] text-white/85 mt-1 mb-3">
            Sinkronisasi relawan TPS & data pemilih 153 kelurahan.
          </p>
          <Link
            href="/dashboard/wilayah"
            className="w-full py-2 bg-white text-rose-600 font-bold text-xs rounded-xl shadow hover:bg-slate-50 transition-all flex items-center justify-center gap-1.5"
          >
            🔗 Bagikan Link Kelurahan
          </Link>
        </div>
      </aside>

      {/* Main Content Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="h-16 md:h-20 bg-white border-b border-slate-100 px-4 md:px-8 flex items-center justify-between sticky top-0 z-20 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Supabase Cloud Terhubung</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center font-bold text-white text-xs shadow-sm">
                {initials}
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-800 leading-tight">{profile?.full_name}</p>
                <p className="text-[10px] text-rose-600 font-bold uppercase tracking-wider">{profile?.role}</p>
              </div>
            </div>

            <div className="h-6 w-px bg-slate-200" />

            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-xs font-bold text-slate-600 transition"
            >
              Keluar
            </button>
          </div>
        </header>

        {/* Main Body */}
        <main className="p-4 md:p-8 space-y-8 flex-1 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}