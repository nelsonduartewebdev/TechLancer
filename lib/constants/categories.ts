/**
 * Hardcoded service categories for the app (PT/EN).
 * Used in new ticket form and agent profile.
 */
export interface CategoryItem {
  id: string;
  name: string;
  label_pt: string;
  label_en: string;
  icon: string | null;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}


