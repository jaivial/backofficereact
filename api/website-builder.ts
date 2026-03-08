// API client for website builder
import type { 
  Website, 
  WebsitePage, 
  WebsitePageSection, 
  WebsiteComponent,
  WebsiteSectionComponent,
  WebsiteAsset,
  WebsiteTemplate 
} from './website-builder-types';

const API_BASE = '/api/admin/website-builder';

export const websiteBuilderApi = {
  // Templates
  async listTemplates(): Promise<WebsiteTemplate[]> {
    const response = await fetch(`${API_BASE}/templates`);
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    return data.templates;
  },

  async getTemplate(id: number): Promise<WebsiteTemplate> {
    const response = await fetch(`${API_BASE}/templates/${id}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    return data.template;
  },

  // Website
  async getWebsite(): Promise<Website | null> {
    const response = await fetch(`${API_BASE}/website`);
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    return data.website;
  },

  async createWebsite(params: {
    template_id?: number;
    subdomain?: string;
    domain?: string;
    settings?: Record<string, any>;
  }): Promise<{ id: number }> {
    const response = await fetch(`${API_BASE}/website`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    return { id: data.id };
  },

  async updateWebsite(params: {
    template_id?: number;
    subdomain?: string;
    domain?: string;
    settings?: Record<string, any>;
  }): Promise<void> {
    const response = await fetch(`${API_BASE}/website`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
  },

  async deleteWebsite(): Promise<void> {
    const response = await fetch(`${API_BASE}/website`, {
      method: 'DELETE',
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
  },

  // Pages
  async listPages(websiteId: number): Promise<WebsitePage[]> {
    const response = await fetch(`${API_BASE}/pages?website_id=${websiteId}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    return data.pages;
  },

  async createPage(params: {
    website_id: number;
    slug: string;
    title: string;
    meta_description?: string;
    meta_keywords?: string;
    is_homepage?: boolean;
  }): Promise<{ id: number }> {
    const response = await fetch(`${API_BASE}/pages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    return { id: data.id };
  },

  async updatePage(id: number, params: Partial<WebsitePage>): Promise<void> {
    const response = await fetch(`${API_BASE}/pages/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
  },

  async deletePage(id: number): Promise<void> {
    const response = await fetch(`${API_BASE}/pages/${id}`, {
      method: 'DELETE',
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
  },

  // Sections
  async listSections(pageId: number): Promise<WebsitePageSection[]> {
    const response = await fetch(`${API_BASE}/pages/${pageId}/sections`);
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    return data.sections;
  },

  async createSection(params: {
    page_id: number;
    section_type: string;
    position?: number;
    settings?: Record<string, any>;
  }): Promise<{ id: number }> {
    const response = await fetch(`${API_BASE}/pages/${params.page_id}/sections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    return { id: data.id };
  },

  async updateSection(id: number, params: Partial<WebsitePageSection>): Promise<void> {
    const response = await fetch(`${API_BASE}/sections/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
  },

  async deleteSection(id: number): Promise<void> {
    const response = await fetch(`${API_BASE}/sections/${id}`, {
      method: 'DELETE',
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
  },

  async reorderSections(pageId: number, sectionIds: number[]): Promise<void> {
    const response = await fetch(`${API_BASE}/sections/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page_id: pageId, section_ids: sectionIds }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
  },

  // Components
  async listComponents(): Promise<WebsiteComponent[]> {
    const response = await fetch(`${API_BASE}/components`);
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    return data.components;
  },

  async getComponent(id: number): Promise<WebsiteComponent> {
    const response = await fetch(`${API_BASE}/components/${id}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    return data.component;
  },

  // Section Components (placed components)
  async listSectionComponents(sectionId: number): Promise<WebsiteSectionComponent[]> {
    const response = await fetch(`${API_BASE}/sections/${sectionId}/components`);
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    return data.components;
  },

  async createSectionComponent(params: {
    section_id: number;
    component_id: number;
    position?: number;
    settings?: Record<string, any>;
    dynamic_source?: string;
    dynamic_params?: Record<string, any>;
  }): Promise<{ id: number }> {
    const response = await fetch(`${API_BASE}/sections/${params.section_id}/components`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    return { id: data.id };
  },

  async updateSectionComponent(id: number, params: Partial<WebsiteSectionComponent>): Promise<void> {
    const response = await fetch(`${API_BASE}/section-components/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
  },

  async deleteSectionComponent(id: number): Promise<void> {
    const response = await fetch(`${API_BASE}/section-components/${id}`, {
      method: 'DELETE',
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
  },

  async reorderSectionComponents(sectionId: number, componentIds: number[]): Promise<void> {
    const response = await fetch(`${API_BASE}/section-components/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section_id: sectionId, component_ids: componentIds }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
  },

  // Assets
  async listAssets(websiteId: number): Promise<WebsiteAsset[]> {
    const response = await fetch(`${API_BASE}/assets?website_id=${websiteId}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    return data.assets;
  },

  async uploadAsset(websiteId: number, file: File, assetType: string): Promise<WebsiteAsset> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('asset_type', assetType);

    const response = await fetch(`${API_BASE}/assets?website_id=${websiteId}`, {
      method: 'POST',
      body: formData,
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    return data.asset;
  },

  async deleteAsset(id: number): Promise<void> {
    const response = await fetch(`${API_BASE}/assets/${id}`, {
      method: 'DELETE',
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
  },

  // Publish
  async publish(): Promise<{ storage_path: string }> {
    const response = await fetch(`${API_BASE}/publish`, {
      method: 'POST',
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    return { storage_path: data.storage_path };
  },

  async preview(): Promise<string> {
    const response = await fetch(`${API_BASE}/preview`);
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    return data.preview_url;
  },

  async getHistory(): Promise<Array<{ version: number; published_at: string; published_by: number }>> {
    const response = await fetch(`${API_BASE}/history`);
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    return data.history;
  },
};
