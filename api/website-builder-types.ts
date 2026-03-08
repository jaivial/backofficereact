// Types for website builder

export interface WebsiteTemplate {
  id: number;
  slug: string;
  name: string;
  description: string;
  thumbnail_url: string;
  template_data: Record<string, any>;
  category: 'restaurant' | 'cafe' | 'bar' | 'bakery' | 'catering';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Website {
  id: number;
  restaurant_id: number;
  template_id: number | null;
  domain: string;
  subdomain: string;
  status: 'draft' | 'published' | 'unpublished';
  settings: WebsiteSettings;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  pages?: WebsitePage[];
}

export interface WebsiteSettings {
  primaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
  fontBody?: string;
  customCSS?: string;
  logoUrl?: string;
  faviconUrl?: string;
  [key: string]: any;
}

export interface WebsitePage {
  id: number;
  website_id: number;
  slug: string;
  title: string;
  meta_description: string;
  meta_keywords: string;
  is_homepage: boolean;
  status: 'draft' | 'published';
  created_at: string;
  updated_at: string;
  sections?: WebsitePageSection[];
}

export interface WebsitePageSection {
  id: number;
  page_id: number;
  section_type: string;
  position: number;
  settings: Record<string, any>;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
  components?: WebsiteSectionComponent[];
}

export interface WebsiteComponent {
  id: number;
  component_type: string;
  name: string;
  description: string;
  icon: string;
  default_settings: Record<string, any>;
  schema_json: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WebsiteSectionComponent {
  id: number;
  section_id: number;
  component_id: number;
  position: number;
  settings: Record<string, any>;
  dynamic_source: string;
  dynamic_params: Record<string, any>;
  created_at: string;
  updated_at: string;
  component?: WebsiteComponent;
}

export interface WebsiteAsset {
  id: number;
  website_id: number;
  asset_type: 'image' | 'logo' | 'favicon' | 'video' | 'document';
  original_filename: string;
  storage_path: string;
  public_url: string;
  mime_type: string;
  file_size: number;
  width: number;
  height: number;
  alt_text: string;
  created_at: string;
}

export interface PublishHistory {
  id: number;
  website_id: number;
  version: number;
  snapshot_json: Record<string, any>;
  published_by: number;
  published_at: string;
  storage_path: string;
}
