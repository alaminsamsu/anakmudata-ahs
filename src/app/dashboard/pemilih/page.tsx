'use client';

import React from 'react';
import Link from 'next/link';

export default function PemilihPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">🗳️ Data Pemilih & Dukungan</h1>
          <p className="text-sm text-slate-500 mt-1">
            Pendataan warga terverifikasi per TPS yang terhubung langsung dengan jaringan perekrut.
          </p>
        </div>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 self-start">
          Tahap 4 — Menunggu Aktivasi
        </span>
      </div>

      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-800">Fitur yang akan aktif di halaman ini:</h2>
        <ul className="list-disc list-inside text-sm text-slate-600 space-y-1.5">
          <li>Input dukungan pemilih dengan Auto-Lookup NIK ke database DPT Makassar.</li>
          <li>Deteksi otomatis pemilih ganda (anti klaim ganda antar-tim).</li>
          <li>Klasifikasi status pemilih (Ring 1 Pasti / Ring 2 Condong) dan rekap per TPS.</li>
        </ul>
        <div className="pt-2">
          <Link
            href="/dashboard/wilayah"
            className="inline-flex items-center px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
          >
            ← Kembali ke Data Wilayah
          </Link>
        </div>
      </div>
    </div>
  );
}