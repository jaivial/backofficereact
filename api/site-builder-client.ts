// API client for Site Builder (new JSON tree-based architecture)
import type {
  Site,
  SitePage,
  SiteAsset,
  SiteVersion,
  ComponentDefinition,
  DomainMapping,
  ThemeConfig,
  SiteSettings,
  PageTree,
} from './site-builder-types';

const API_BASE = '/api/admin/site-builder';

// Helper for API responses
async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.message || 'Request failed');
  }
  return data as T;
}

// ============================================================================
// SITES API
// ============================================================================

export const sitesApi = {
  async list(): Promise<Site[]> {
    const data = await apiRequest<{ sites: Site[] }>(`${API_BASE}/sites`);
    return data.sites;
  },

  async get(siteId: string): Promise<Site> {
    const data = await apiRequest<{ site: Site }>(`${API_BASE}/sites/${siteId}`);
    return data.site;
  },

  async create(params: {
    name: string;
    subdomain: string;
    theme_config?: ThemeConfig;
    settings?: SiteSettings;
  }): Promise<{ id: string }> {
    const data = await apiRequest<{ id: string }>(`${API_BASE}/sites`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return data;
  },

  async update(
    siteId: string,
    params: Partial<{
      name: string;
      subdomain: string;
      custom_domain: string;
      theme_config: ThemeConfig;
      settings: SiteSettings;
      status: 'draft' | 'published' | 'unpublished';
    }>
  ): Promise<void> {
    await apiRequest<void>(`${API_BASE}/sites/${siteId}`, {
      method: 'PUT',
      body: JSON.stringify(params),
    });
  },

  async delete(siteId: string): Promise<void> {
    await apiRequest<void>(`${API_BASE}/sites/${siteId}`, {
      method: 'DELETE',
    });
  },
};

// ============================================================================
// PAGES API
// ============================================================================

export const pagesApi = {
  async list(siteId: string): Promise<SitePage[]> {
    const data = await apiRequest<{ pages: SitePage[] }>(
      `${API_BASE}/sites/${siteId}/pages`
    );
    return data.pages;
  },

  async get(pageId: string): Promise<SitePage> {
    const data = await apiRequest<{ page: SitePage }>(`${API_BASE}/pages/${pageId}`);
    return data.page;
  },

  async create(
    siteId: string,
    params: {
      slug: string;
      name: string;
      page_type?: 'static' | 'collection_template';
      tree?: PageTree;
      is_home?: boolean;
    }
  ): Promise<{ id: string }> {
    const data = await apiRequest<{ id: string }>(
      `${API_BASE}/sites/${siteId}/pages`,
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );
    return data;
  },

  async update(
    pageId: string,
    params: Partial<{
      slug: string;
      name: string;
      page_type: 'static' | 'collection_template';
      tree: PageTree;
      seo_config: SitePage['seo_config'];
      collection_binding: SitePage['collection_binding'];
      is_home: boolean;
    }>
  ): Promise<void> {
    await apiRequest<void>(`${API_BASE}/pages/${pageId}`, {
      method: 'PUT',
      body: JSON.stringify(params),
    });
  },

  async delete(pageId: string): Promise<void> {
    await apiRequest<void>(`${API_BASE}/pages/${pageId}`, {
      method: 'DELETE',
    });
  },
};

// ============================================================================
// ASSETS API
// ============================================================================

export const assetsApi = {
  async list(siteId: string, type?: string): Promise<SiteAsset[]> {
    const url = type
      ? `${API_BASE}/sites/${siteId}/assets?type=${type}`
      : `${API_BASE}/sites/${siteId}/assets`;
    const data = await apiRequest<{ assets: SiteAsset[] }>(url);
    return data.assets;
  },

  async get(assetId: string): Promise<SiteAsset> {
    const data = await apiRequest<{ asset: SiteAsset }>(
      `${API_BASE}/assets/${assetId}`
    );
    return data.asset;
  },

  async register(
    siteId: string,
    params: {
      type: 'image' | 'video' | 'document' | 'font' | 'other';
      filename: string;
      original_filename?: string;
      url: string;
      thumbnail_url?: string;
      mime_type?: string;
      file_size?: number;
      width?: number;
      height?: number;
      alt_text?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<{ id: string }> {
    const data = await apiRequest<{ id: string }>(
      `${API_BASE}/sites/${siteId}/assets`,
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );
    return data;
  },

  async delete(assetId: string): Promise<void> {
    await apiRequest<void>(`${API_BASE}/assets/${assetId}`, {
      method: 'DELETE',
    });
  },
};

// ============================================================================
// VERSIONS API
// ============================================================================

export const versionsApi = {
  async list(siteId: string): Promise<SiteVersion[]> {
    const data = await apiRequest<{ versions: SiteVersion[] }>(
      `${API_BASE}/sites/${siteId}/versions`
    );
    return data.versions;
  },

  async get(versionId: string): Promise<SiteVersion> {
    const data = await apiRequest<{ version: SiteVersion }>(
      `${API_BASE}/versions/${versionId}`
    );
    return data.version;
  },

  async create(
    siteId: string,
    changeSummary?: string
  ): Promise<{ id: string; version_number: number }> {
    const data = await apiRequest<{ id: string; version_number: number }>(
      `${API_BASE}/sites/${siteId}/versions`,
      {
        method: 'POST',
        body: JSON.stringify({ change_summary: changeSummary }),
      }
    );
    return data;
  },
};

// ============================================================================
// COMPONENTS API
// ============================================================================

export const componentsApi = {
  async list(category?: string): Promise<ComponentDefinition[]> {
    const url = category
      ? `${API_BASE}/components?category=${category}`
      : `${API_BASE}/components`;
    const data = await apiRequest<{ components: ComponentDefinition[] }>(url);
    return data.components;
  },

  async getByType(type: string): Promise<ComponentDefinition> {
    const data = await apiRequest<{ component: ComponentDefinition }>(
      `${API_BASE}/components/${type}`
    );
    return data.component;
  },
};

// ============================================================================
// DOMAINS API
// ============================================================================

export const domainsApi = {
  async list(siteId: string): Promise<DomainMapping[]> {
    const data = await apiRequest<{ domains: DomainMapping[] }>(
      `${API_BASE}/sites/${siteId}/domains`
    );
    return data.domains;
  },

  async add(
    siteId: string,
    domain: string,
    isPrimary?: boolean
  ): Promise<{ id: string; verification_token: string }> {
    const data = await apiRequest<{ id: string; verification_token: string }>(
      `${API_BASE}/sites/${siteId}/domains`,
      {
        method: 'POST',
        body: JSON.stringify({ domain, is_primary: isPrimary }),
      }
    );
    return data;
  },

  async remove(domainId: string): Promise<void> {
    await apiRequest<void>(`${API_BASE}/domains/${domainId}`, {
      method: 'DELETE',
    });
  },

  async verify(domainId: string): Promise<void> {
    await apiRequest<void>(`${API_BASE}/domains/${domainId}/verify`, {
      method: 'POST',
    });
  },
};

// ============================================================================
// PUBLISH API
// ============================================================================

export const publishApi = {
  async publish(siteId: string): Promise<{ version_id: string }> {
    const data = await apiRequest<{ version_id: string }>(
      `${API_BASE}/sites/${siteId}/publish`,
      {
        method: 'POST',
      }
    );
    return data;
  },

  async getStatus(siteId: string): Promise<{
    status: 'draft' | 'published' | 'unpublished';
    published_version_id: string | null;
    published_at: string | null;
    storage_path: string | null;
  }> {
    const data = await apiRequest<{
      status: 'draft' | 'published' | 'unpublished';
      published_version_id: string | null;
      published_at: string | null;
      storage_path: string | null;
    }>(`${API_BASE}/sites/${siteId}/publish-status`);
    return data;
  },
};

// ============================================================================
// BINDINGS API
// ============================================================================

export const bindingsApi = {
  async list(siteId: string): Promise<
    Array<{
      id: string;
      site_id: string;
      page_id: string | null;
      node_id: string;
      resource_type: string;
      query_config: Record<string, unknown> | null;
      refresh_mode: string;
      cache_ttl: number | null;
      created_at: string;
    }>
  > {
    const data = await apiRequest<{
      bindings: Array<{
        id: string;
        site_id: string;
        page_id: string | null;
        node_id: string;
        resource_type: string;
        query_config: Record<string, unknown> | null;
        refresh_mode: string;
        cache_ttl: number | null;
        created_at: string;
      }>;
    }>(`${API_BASE}/sites/${siteId}/bindings`);
    return data.bindings;
  },

  async create(
    siteId: string,
    params: {
      page_id?: string;
      node_id: string;
      resource_type: string;
      query_config?: Record<string, unknown>;
      refresh_mode?: 'publish' | 'load' | 'poll';
      cache_ttl?: number;
    }
  ): Promise<{ id: string }> {
    const data = await apiRequest<{ id: string }>(
      `${API_BASE}/sites/${siteId}/bindings`,
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );
    return data;
  },

  async update(
    bindingId: string,
    params: Partial<{
      query_config: Record<string, unknown>;
      refresh_mode: 'publish' | 'load' | 'poll';
      cache_ttl: number;
    }>
  ): Promise<void> {
    await apiRequest<void>(`${API_BASE}/bindings/${bindingId}`, {
      method: 'PUT',
      body: JSON.stringify(params),
    });
  },

  async delete(bindingId: string): Promise<void> {
    await apiRequest<void>(`${API_BASE}/bindings/${bindingId}`, {
      method: 'DELETE',
    });
  },
};

// Export combined API object
export const siteBuilderApi = {
  sites: sitesApi,
  pages: pagesApi,
  assets: assetsApi,
  versions: versionsApi,
  components: componentsApi,
  domains: domainsApi,
  publish: publishApi,
  bindings: bindingsApi,
};

export default siteBuilderApi;
