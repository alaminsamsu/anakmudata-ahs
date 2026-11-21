'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard Utama', icon: '📊' },
  { href: '/dashboard/tim-sukses', label: 'Tim Sukses (LO & TPS)', icon: '🤝' },
  { href: '/dashboard/wilayah', label: 'Data Wilayah', icon: '📍' },
  { href: '/dashboard/dpt', label: 'DPT', icon: '🗂️' },
  { href: '/dashboard/analisa', label: 'Analisa Segmen', icon: '🎯' },
  { href: '/dashboard/isu', label: 'Isu Wilayah', icon: '📰' },
  { href: '/dashboard/pemilih', label: 'Pemilih', icon: '🗳️' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string>('Super Admin');
  const [userRole, setUserRole] = useState<string>('SUPER_ADMIN');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push('/login');
      return;
    }

    if (session.user.email) {
      setUserEmail(session.user.email);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', session.user.id)
      .single();

    if (profile?.full_name) setUserEmail(profile.full_name);
    if (profile?.role) setUserRole(profile.role);
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const initials = userEmail
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-slate-50/70 flex flex-col lg:flex-row text-slate-800">
      {/* Sidebar Desktop & Mobile Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-100 flex flex-col justify-between transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <div className="p-5 space-y-6">
          {/* Logo Brand */}
          <div className="flex items-center gap-3 px-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 via-pink-500 to-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-md shadow-rose-500/20">
              A
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm tracking-tight text-slate-900">ANAKMUDATA</span>
                <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 text-[9px] font-extrabold uppercase">
                  Internal
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Command Center Makassar</p>
            </div>
          </div>

          {/* Navigasi Utama */}
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname?.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                    isActive
                      ? 'bg-rose-50 text-rose-600 shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Kartu Pintasan Admin di Bawah Sidebar */}
        <div className="p-4">
          <div className="rounded-2xl bg-gradient-to-br from-rose-600 via-pink-600 to-indigo-700 p-4 text-white shadow-lg shadow-rose-500/20 space-y-2.5">
            <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-rose-100">
              <span>Admin Only</span>
              <span>LO → TPS</span>
            </div>
            <div className="text-xs font-extrabold leading-snug">Input & Rawat Jaringan</div>
            <p className="text-[10px] text-rose-100/90 leading-relaxed">
              Kelola data LO, Tim TPS, verifikasi rutin & komunikasi langsung.
            </p>
            <Link
              href="/dashboard/tim-sukses"
              onClick={() => setMobileMenuOpen(false)}
              className="block w-full py-2 rounded-xl bg-white text-rose-600 hover:bg-rose-50 text-center text-[11px] font-extrabold transition shadow-xs"
            >
              + Kelola LO & Tim TPS
            </Link>
          </div>
        </div>
      </aside>

      {/* Overlay Mobile */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
        />
      )}

      {/* Area Konten Utama */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-100 px-4 md:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold"
            >
              ☰ Menu
            </button>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Akses Terbatas · Admin & Super Admin
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-extrabold text-xs flex items-center justify-center">
                {initials || 'SA'}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-extrabold text-slate-900 leading-none">{userEmail}</div>
                <div className="text-[10px] font-bold text-rose-600 uppercase mt-0.5">{userRole}</div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-600 transition"
            >
              Keluar
            </button>
          </div>
        </header>

        {/* Halaman Dinamis */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}