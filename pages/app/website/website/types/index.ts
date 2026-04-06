export interface WebsiteConfig {
  id: number;
  restaurant_id: number;
  template_id: string | null;
  custom_html: string | null;
  domain: string | null;
  is_published: boolean;
}

export type TabKey = "templates" | "ai" | "domain";
