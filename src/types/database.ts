export type CoordinatorRole = 'super_admin' | 'korda' | 'korcam' | 'kordes';
export type VolunteerStatus = 'pending' | 'approved' | 'rejected';

export interface District {
  id: string;
  regency_id: string;
  name: string;
}

export interface Village {
  id: string;
  district_id: string;
  slug: string;
  name: string;
  total_tps: number;
  districts?: District;
}

export interface Coordinator {
  id: string;
  full_name: string;
  whatsapp_number: string;
  role: CoordinatorRole;
  regency_id: string | null;
  district_id: string | null;
  village_id: string | null;
}

export interface Volunteer {
  id: string;
  village_id: string;
  tps_number: number;
  full_name: string;
  nik: string;
  whatsapp_number: string;
  ktp_storage_path: string;
  status: VolunteerStatus;
  rejection_reason: string | null;
  referred_by: string | null;
  verified_by: string | null;
  created_at: string;
  villages?: Village;
}