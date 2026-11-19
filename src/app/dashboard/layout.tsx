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
  { name: 'Dashboard', href: '/dashboard', icon: '📊' },
  { name: 'Data Wilayah', href: '/dashboard/wilayah', icon: '🗺️' },
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-300 text-sm">
        Memuat Command Center Anakmudata AHS...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row">
      {/* Top Bar Mobile */}
      <div className="md:hidden bg-slate-950 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800">
        <div>
          <div className="font-bold text-sm tracking-wide">
            ANAKMUDATA <span className="text-orange-500">AHS</span>
          </div>
          <div className="text-[11px] text-slate-400">
            {profile?.full_name} • {profile?.role.toUpperCase()}
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-medium text-slate-200"
        >
          {mobileMenuOpen ? 'Tutup' : '☰ Menu'}
        </button>
      </div>

      {/* Sidebar Navigasi */}
      <aside
        className={`${
          mobileMenuOpen ? 'block' : 'hidden'
        } md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-slate-950 text-white border-r border-slate-800 z-30`}
      >
        <div className="p-5 border-b border-slate-800 hidden md:block">
          <div className="text-lg font-extrabold tracking-wide">
            ANAKMUDATA <span className="text-orange-500">AHS</span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Command Center Makassar</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
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
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <div className="mb-3">
            <div className="text-sm font-semibold text-white truncate">{profile?.full_name}</div>
            <div className="text-[11px] font-medium text-orange-400 uppercase tracking-wider">
              {profile?.role}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-red-600/90 text-xs font-semibold text-slate-200 hover:text-white transition"
          >
            Keluar Sistem
          </button>
        </div>
      </aside>

      {/* Konten Utama */}
      <main className="flex-1 md:pl-64">
        <div className="max-w-7xl mx-auto p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}