'use client';

import React from 'react';
import Link from 'next/link';

export default function LogistikPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">📦 Logistik & Distribusi APK</h1>
          <p className="text-sm text-slate-500 mt-1">
            Pencatatan stok atribut kampanye, distribusi ke wilayah, dan bukti serah terima lapangan.
          </p>
        </div>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 self-start">
          Tahap 5 — Menunggu Aktivasi
        </span>
      </div>

      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-800">Fitur yang akan aktif di halaman ini:</h2>
        <ul className="list-disc list-inside text-sm text-slate-600 space-y-1.5">
          <li>Manajemen stok masuk & keluar gudang (baju, spanduk, stiker, kartu nama, perlengkapan saksi).</li>
          <li>Penyaluran logistik yang terikat langsung ke penerima (Korcam / Kordes / Kelurahan).</li>
          <li>Unggah foto bukti serah terima barang di lapangan.</li>
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