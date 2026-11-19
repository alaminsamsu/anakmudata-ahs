'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error || !data.user) {
      setLoading(false);
      setErrorMsg('Email atau password tidak sesuai.');
      return;
    }

    // Pastikan akun yang login memiliki peran super_admin atau admin
    const { data: profile, error: profErr } = await supabase
      .from('coordinators')
      .select('role')
      .eq('id', data.user.id)
      .single();

    if (profErr || !profile || !['super_admin', 'admin'].includes(profile.role)) {
      await supabase.auth.signOut();
      setLoading(false);
      setErrorMsg('Akses ditolak. Halaman ini khusus untuk Admin & Super Admin.');
      return;
    }

    router.replace('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Dekorasi Latar Belakang Halus */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/60 p-8 relative z-10">
        {/* Logo & Identitas Brand */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-500 via-pink-500 to-indigo-600 flex items-center justify-center text-white font-extrabold text-2xl shadow-lg shadow-rose-500/30 mb-4">
            A
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-100 text-[11px] font-bold text-rose-600 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            AKSES INTERNAL · ADMIN & SUPER ADMIN
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            ANAKMUDATA
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-1">
            Command Center Kota Makassar
          </p>
        </div>

        {/* Pesan Error */}
        {errorMsg && (
          <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 text-center">
            {errorMsg}
          </div>
        )}

        {/* Form Login */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Email Akun
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@anakmudata.id"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15 transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 mt-2 rounded-xl bg-gradient-to-r from-rose-500 via-pink-500 to-indigo-600 text-white font-bold text-sm shadow-lg shadow-rose-500/25 hover:opacity-95 active:scale-[0.99] transition disabled:opacity-60"
          >
            {loading ? 'Memverifikasi Akses...' : 'Masuk Command Center'}
          </button>
        </form>

        <div className="mt-8 pt-5 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400 font-medium">
            Sistem Manajemen Jaringan LO & Tim TPS Kota Makassar
          </p>
        </div>
      </div>
    </div>
  );
}