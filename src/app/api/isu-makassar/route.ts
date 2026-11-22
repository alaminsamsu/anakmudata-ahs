import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MAKASSAR_DISTRICTS = [
  'BIRINGKANAYA',
  'TAMALANREA',
  'MANGGALA',
  'PANAKKUKANG',
  'RAPPOCINI',
  'TAMALATE',
  'MARISO',
  'MAMAJANG',
  'MAKASSAR',
  'UJUNG PANDANG',
  'WAJO',
  'BONTOALA',
  'TALLO',
  'UJUNG TANAH',
  'KEPULAUAN SANGKARRANG',
];

function decodeXmlEntities(str: string): string {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyIssue(text: string): {
  category: string;
  segment: string;
  urgency: 'TINGGI' | 'SEDANG';
} {
  const upper = text.toUpperCase();

  let category = '📢 Sosial & Kebijakan Kota';
  let segment = '🏘️ Warga Umum';
  let urgency: 'TINGGI' | 'SEDANG' = 'SEDANG';

  if (/(BANJIR|GENANGAN|DRAINASE|HUJAN DERAS|TANGGUL|SALURAN AIR)/.test(upper)) {
    category = '🌊 Banjir & Drainase';
    segment = '👩‍👧 Emak-Emak & Keluarga';
    urgency = 'TINGGI';
  } else if (/(JALAN RUSAK|MACET|INFRASTRUKTUR|LAMPU JALAN|JEMBATAN|TOL|BRT)/.test(upper)) {
    category = '🛣️ Jalan & Transportasi';
    segment = '💼 Milenial & Pekerja';
  } else if (/(HARGA|SEMBAKO|BERAS|GAS LPG|UMKM|PASAR|INFLASI|AIR BERSIH|PDAM|SAMPAH)/.test(upper)) {
    category = '👩‍👧 Kebutuhan Pokok & UMKM';
    segment = '👩‍👧 Emak-Emak';
    urgency = 'TINGGI';
  } else if (/(KAMPUS|UNHAS|MAHASISWA|BEASISWA|SEKOLAH|LOWONGAN|KERJA|START-UP|ESPORT|OLAHRAGA|FUTSAL|PEMUDA)/.test(upper)) {
    category = '⚡ Pemuda, Kampus & Kerja';
    segment = '⚡ Gen-Z & Milenial';
  } else if (/(BEGAL|TAWURAN|CURANMOR|NARKOBA|KEAMANAN|POLSEK|KRIMINAL|KEBAKARAN)/.test(upper)) {
    category = '🚨 Keamanan & Ketertiban';
    segment = '👩‍👧 Emak-Emak & Pemuda';
    urgency = 'TINGGI';
  } else if (/(KESEHATAN|PUSKESMAS|RSUD|STUNTING|POSYANDU|BPJS)/.test(upper)) {
    category = '🏥 Kesehatan & Posyandu';
    segment = '👩‍👧 Emak-Emak';
  }

  return { category, segment, urgency };
}

function detectDistricts(text: string, fallbackDistrict: string): string[] {
  const upper = text.toUpperCase();
  const matched = MAKASSAR_DISTRICTS.filter((d) => {
    if (d === 'MAKASSAR') return /\bKECAMATAN MAKASSAR\b|\bKEC\.?\s*MAKASSAR\b/.test(upper);
    return upper.includes(d);
  });

  if (matched.length > 0) return matched;
  if (fallbackDistrict && fallbackDistrict !== 'ALL') return [fallbackDistrict];
  return ['UMUM MAKASSAR'];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const districtParam = (searchParams.get('district') || 'ALL').toUpperCase().trim();

  const searchQuery =
    districtParam === 'ALL'
      ? 'Makassar kelurahan kecamatan warga'
      : `"${districtParam}" Makassar`;

  const candidateUrls = [
    `https://news.google.com/rss/search?q=${encodeURIComponent(searchQuery)}&hl=id&gl=ID&ceid=ID:id`,
    `https://www.bing.com/news/search?q=${encodeURIComponent(searchQuery)}&format=rss`,
  ];

  let xml = '';
  let lastError = '';

  for (const url of candidateUrls) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'application/rss+xml, application/xml, text/xml, */*',
        },
        cache: 'no-store',
      });

      if (response.ok) {
        const text = await response.text();
        if (text.includes('<item>')) {
          xml = text;
          break;
        }
      } else {
        lastError = `HTTP ${response.status}`;
      }
    } catch (e: any) {
      lastError = e?.message || 'Fetch error';
    }
  }

  if (!xml) {
    return NextResponse.json(
      { items: [], error: `Sumber berita tidak merespons (${lastError || 'kosong'}).` },
      { status: 502 }
    );
  }

  const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];

  const parsedItems = itemMatches.slice(0, 24).map((rawItem, index) => {
    const titleRaw = rawItem.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '';
    const linkRaw = rawItem.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '';
    const pubDateRaw = rawItem.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '';
    const sourceRaw =
      rawItem.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ||
      rawItem.match(/<news:source>([\s\S]*?)<\/news:source>/)?.[1] ||
      'Media Lokal';
    const descRaw = rawItem.match(/<description>([\s\S]*?)<\/description>/)?.[1] || '';

    const cleanTitle = decodeXmlEntities(titleRaw);
    const cleanDesc = decodeXmlEntities(descRaw);
    const sourceName = decodeXmlEntities(sourceRaw);
    const combinedText = `${cleanTitle} ${cleanDesc}`;

    const districts = detectDistricts(combinedText, districtParam);
    const { category, segment, urgency } = classifyIssue(combinedText);

    let formattedDate = '-';
    if (pubDateRaw) {
      const d = new Date(pubDateRaw);
      if (!isNaN(d.getTime())) {
        formattedDate = d.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      }
    }

    return {
      id: `rss-${index}-${Date.now()}`,
      title: cleanTitle,
      searchBlob: combinedText.toUpperCase(),
      link: decodeXmlEntities(linkRaw),
      source: sourceName,
      pubDate: formattedDate,
      districts,
      category,
      segment,
      urgency,
    };
  });

  return NextResponse.json({ items: parsedItems });
}