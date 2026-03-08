// Types for website builder - Visual Editor Architecture
// Based on JSON tree model for pages, not HTML-based storage

// ============================================================================
// CORE TYPES
// ============================================================================

export interface Site {
  id: string;
  restaurant_id: number;
  name: string;
  subdomain: string;
  custom_domain: string | null;
  theme_config: ThemeConfig;
  status: 'draft' | 'published' | 'unpublished';
  published_version_id: string | null;
  settings: SiteSettings | null;
  created_at: string;
  updated_at: string;
}

export interface SiteSettings {
  googleAnalyticsId?: string;
  facebookPixelId?: string;
  customHeadCode?: string;
  customBodyCode?: string;
  [key: string]: unknown;
}

// ============================================================================
// THEME SYSTEM
// ============================================================================

export interface ThemeConfig {
  colors: ThemeColors;
  fonts: ThemeFonts;
  spacing: ThemeSpacing;
  radius: ThemeRadius;
  shadows: ThemeShadows;
}

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  success?: string;
  warning?: string;
  error?: string;
}

export interface ThemeFonts {
  heading: string;
  body: string;
  headingWeights?: [number, number];
  bodyWeights?: [number, number];
}

export interface ThemeSpacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  '2xl': number;
}

export interface ThemeRadius {
  none: number;
  sm: number;
  md: number;
  lg: number;
  full: number;
}

export interface ThemeShadows {
  none: string;
  sm: string;
  md: string;
  lg: string;
}

// ============================================================================
// PAGE TREE MODEL
// ============================================================================

export interface SitePage {
  id: string;
  site_id: string;
  slug: string;
  name: string;
  page_type: 'static' | 'collection_template';
  tree: PageTree;
  seo_config: SEOConfig | null;
  collection_binding: CollectionBinding | null;
  is_home: boolean;
  created_at: string;
  updated_at: string;
}

export interface PageTree {
  id: string;
  type: 'page';
  children: PageNode[];
}

export type PageNode = 
  | HeaderNode 
  | FooterNode 
  | SectionNode 
  | ColumnsNode 
  | ContentNode
  | DynamicNode
  | FormNode;

export interface BaseNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
  style?: NodeStyle;
  bindings?: NodeBinding;
  visibility?: NodeVisibility;
}

export interface NodeStyle {
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  marginTop?: number;
  marginBottom?: number;
  backgroundColor?: string;
  textColor?: string;
  borderRadius?: number | string;
  borderWidth?: number;
  borderColor?: string;
  boxShadow?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  maxWidth?: string;
  minHeight?: number | string;
  [key: string]: unknown;
}

export interface NodeBinding {
  resource: string;
  query?: Record<string, unknown>;
  refreshMode?: 'publish' | 'load' | 'poll';
  cacheTTL?: number;
}

export interface NodeVisibility {
  desktop?: boolean;
  tablet?: boolean;
  mobile?: boolean;
}

// Layout Nodes
export interface HeaderNode extends BaseNode {
  type: 'header';
  children: PageNode[];
}

export interface FooterNode extends BaseNode {
  type: 'footer';
  children: PageNode[];
}

export interface SectionNode extends BaseNode {
  type: 'section';
  children: PageNode[];
}

export interface ColumnsNode extends BaseNode {
  type: 'columns';
  columns: PageNode[][];
}

// Content Nodes
export type ContentNode = 
  | HeroNode
  | TextNode
  | ImageNode
  | HeadingNode
  | ButtonNode
  | SpacerNode
  | DividerNode
  | TestimonialNode
  | MapNode
  | VideoNode
  | GalleryNode
  | SocialLinksNode
  | FAQNode
  | CTABannerNode
  | LogoNode
  | NavMenuNode;

export interface HeroNode extends BaseNode {
  type: 'hero';
  props: {
    title: string;
    subtitle?: string;
    backgroundImage?: string;
    buttonText?: string;
    buttonHref?: string;
    buttonTarget?: '_self' | '_blank';
    align?: 'left' | 'center' | 'right';
    overlay?: boolean;
  };
}

export interface TextNode extends BaseNode {
  type: 'text';
  props: {
    content: string;
    align?: 'left' | 'center' | 'right' | 'justify';
  };
}

export interface ImageNode extends BaseNode {
  type: 'image';
  props: {
    src: string;
    alt: string;
    caption?: string;
    link?: string;
    lazyLoad?: boolean;
  };
}

export interface HeadingNode extends BaseNode {
  type: 'heading';
  props: {
    text: string;
    level: 1 | 2 | 3 | 4 | 5 | 6;
    align?: 'left' | 'center' | 'right';
  };
}

export interface ButtonNode extends BaseNode {
  type: 'button';
  props: {
    text: string;
    href?: string;
    target?: '_self' | '_blank';
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    icon?: string;
  };
}

export interface SpacerNode extends BaseNode {
  type: 'spacer';
  props: {
    height: number;
    mobileHeight?: number;
  };
}

export interface DividerNode extends BaseNode {
  type: 'divider';
  props: {
    style?: 'solid' | 'dashed' | 'dotted';
    width?: 'full' | 'lg' | 'md' | 'sm';
  };
}

export interface TestimonialNode extends BaseNode {
  type: 'testimonial';
  props: {
    quote: string;
    author: string;
    authorRole?: string;
    avatarUrl?: string;
    rating?: number;
  };
}

export interface MapNode extends BaseNode {
  type: 'map';
  props: {
    address?: string;
    latitude?: number;
    longitude?: number;
    zoom?: number;
    height?: number;
  };
}

export interface VideoNode extends BaseNode {
  type: 'video';
  props: {
    src?: string;
    youtubeId?: string;
    vimeoId?: string;
    autoplay?: boolean;
    loop?: boolean;
    muted?: boolean;
    controls?: boolean;
    aspectRatio?: '16:9' | '4:3' | '1:1' | '21:9';
  };
}

export interface GalleryNode extends BaseNode {
  type: 'gallery';
  props: {
    images: Array<{
      src: string;
      alt: string;
      caption?: string;
    }>;
    columns?: number;
    gap?: number;
    enableLightbox?: boolean;
  };
}

export interface SocialLinksNode extends BaseNode {
  type: 'social-links';
  props: {
    links: Array<{
      platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'youtube' | 'tiktok';
      url: string;
    }>;
    layout?: 'horizontal' | 'vertical';
    size?: 'sm' | 'md' | 'lg';
    showLabels?: boolean;
  };
}

export interface FAQNode extends BaseNode {
  type: 'faq';
  props: {
    items: Array<{
      question: string;
      answer: string;
    }>;
    allowMultiple?: boolean;
  };
}

export interface CTABannerNode extends BaseNode {
  type: 'cta-banner';
  props: {
    title: string;
    description?: string;
    buttonText?: string;
    buttonHref?: string;
    backgroundImage?: string;
    align?: 'left' | 'center' | 'right';
  };
}

export interface LogoNode extends BaseNode {
  type: 'logo';
  props: {
    src: string;
    alt?: string;
    href?: string;
    maxWidth?: number;
  };
}

export interface NavMenuNode extends BaseNode {
  type: 'nav-menu';
  props: {
    items: Array<{
      label: string;
      href: string;
      target?: '_self' | '_blank';
    }>;
    style?: 'horizontal' | 'vertical' | 'dropdown';
  };
}

// Dynamic Nodes (with data bindings)
export type DynamicNode = 
  | PropertyGridNode
  | TestimonialGridNode
  | BlogPostsNode
  | MenuDisplayNode;

export interface PropertyGridNode extends BaseNode {
  type: 'property-grid';
  props: {
    title?: string;
    columns?: number;
    showPrice?: boolean;
    showLocation?: boolean;
    cardStyle?: 'card' | 'minimal' | 'featured';
  };
  bindings: NodeBinding & {
    resource: 'properties.latest' | 'properties.featured' | 'properties.search';
    limit?: number;
  };
}

export interface TestimonialGridNode extends BaseNode {
  type: 'testimonial-grid';
  props: {
    title?: string;
    columns?: number;
    showRating?: boolean;
    showAvatar?: boolean;
  };
  bindings: NodeBinding & {
    resource: 'testimonials.all' | 'testimonials.featured';
    limit?: number;
  };
}

export interface BlogPostsNode extends BaseNode {
  type: 'blog-posts';
  props: {
    title?: string;
    layout?: 'grid' | 'list' | 'featured';
    columns?: number;
    showExcerpt?: boolean;
    showDate?: boolean;
    showAuthor?: boolean;
  };
  bindings: NodeBinding & {
    resource: 'blog.latest' | 'blog.category' | 'blog.featured';
    limit?: number;
    category?: string;
  };
}

export interface MenuDisplayNode extends BaseNode {
  type: 'menu-display';
  props: {
    title?: string;
    showPrices?: boolean;
    showDescriptions?: boolean;
    groupByCategory?: boolean;
  };
  bindings: NodeBinding & {
    resource: 'menu.regular' | 'menu.special' | 'menu.wine';
    menuId?: string;
  };
}

// Form Nodes
export type FormNode = 
  | ContactFormNode
  | NewsletterFormNode
  | BookingFormNode;

export interface ContactFormNode extends BaseNode {
  type: 'contact-form';
  props: {
    title?: string;
    showPhone?: boolean;
    showCompany?: boolean;
    submitButtonText?: string;
    successMessage?: string;
    emailTo?: string;
  };
  bindings?: NodeBinding & {
    storeSubmissions?: boolean;
    sendEmail?: boolean;
  };
}

export interface NewsletterFormNode extends BaseNode {
  type: 'newsletter-form';
  props: {
    title?: string;
    description?: string;
    placeholder?: string;
    submitButtonText?: string;
    successMessage?: string;
  };
  bindings?: NodeBinding & {
    listId?: string;
  };
}

export interface BookingFormNode extends BaseNode {
  type: 'booking-form';
  props: {
    title?: string;
    showGuests?: boolean;
    showTime?: boolean;
    showPhone?: boolean;
    submitButtonText?: string;
  };
  bindings?: NodeBinding & {
    restaurantId?: number;
  };
}

// ============================================================================
// SEO
// ============================================================================

export interface SEOConfig {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  canonicalUrl?: string;
  noIndex?: boolean;
  noFollow?: boolean;
}

// ============================================================================
// ASSETS
// ============================================================================

export interface SiteAsset {
  id: string;
  site_id: string;
  type: 'image' | 'video' | 'document' | 'font' | 'other';
  filename: string;
  original_filename: string | null;
  url: string;
  thumbnail_url: string | null;
  mime_type: string | null;
  file_size: number | null;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ============================================================================
// VERSIONS
// ============================================================================

export interface SiteVersion {
  id: string;
  site_id: string;
  version_number: number;
  pages_snapshot: SitePage[];
  theme_snapshot: ThemeConfig;
  assets_snapshot: SiteAsset[] | null;
  settings_snapshot: SiteSettings | null;
  status: 'draft' | 'published' | 'archived';
  change_summary: string | null;
  storage_path: string | null;
  published_at: string | null;
  created_at: string;
}

// ============================================================================
// COMPONENT REGISTRY
// ============================================================================

export interface ComponentDefinition {
  id: number;
  type: string;
  category: ComponentCategory;
  label: string;
  description: string | null;
  props_schema: PropsSchema;
  style_schema: StyleSchema | null;
  bindings_schema: BindingsSchema | null;
  nesting_rules: NestingRules | null;
  icon: string | null;
  thumbnail_url: string | null;
  is_active: boolean;
  sort_order: number;
}

export type ComponentCategory = 'layout' | 'content' | 'dynamic' | 'forms';

export interface PropsSchema {
  [key: string]: PropField;
}

export interface PropField {
  type: 'string' | 'number' | 'boolean' | 'color' | 'richtext' | 'array' | 'object';
  label: string;
  required?: boolean;
  default?: unknown;
  enum?: unknown[];
  min?: number;
  max?: number;
  itemSchema?: PropsSchema;
}

export interface StyleSchema {
  [key: string]: StyleField;
}

export interface StyleField {
  type: 'color' | 'number' | 'string';
  label: string;
  min?: number;
  max?: number;
  enum?: string[];
}

export interface BindingsSchema {
  [key: string]: BindingField;
}

export interface BindingField {
  type: 'string' | 'number' | 'boolean';
  label: string;
  required?: boolean;
  enum?: string[];
  default?: unknown;
}

export interface NestingRules {
  allowedChildren: string[]; // ['*'] for any
  allowedParents: string[];
}

// ============================================================================
// COLLECTIONS (CMS)
// ============================================================================

export interface CollectionDefinition {
  id: string;
  site_id: string;
  name: string;
  slug_pattern: string;
  source_type: 'internal' | 'external';
  source_config: Record<string, unknown> | null;
  fields_schema: CollectionFieldSchema;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CollectionFieldSchema {
  [key: string]: CollectionField;
}

export interface CollectionField {
  type: 'text' | 'number' | 'image' | 'date' | 'boolean' | 'select' | 'relation';
  label: string;
  required?: boolean;
  options?: string[]; // for select
  relationTo?: string; // for relation
}

export interface CollectionBinding {
  collection_id: string;
  slug_pattern: string;
  fields_mapping: Record<string, string>;
}

// ============================================================================
// DOMAINS
// ============================================================================

export interface DomainMapping {
  id: string;
  site_id: string;
  domain: string;
  is_primary: boolean;
  verification_token: string | null;
  verification_method: 'dns' | 'file' | null;
  status: 'pending' | 'verified' | 'active' | 'failed';
  ssl_status: 'none' | 'pending' | 'active' | 'failed';
  error_message: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// PUBLISH QUEUE
// ============================================================================

export interface PublishJob {
  id: string;
  site_id: string;
  version_id: string;
  action: 'publish' | 'unpublish' | 'rollback';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  total_steps: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

// ============================================================================
// LEGACY TYPES (for backward compatibility during migration)
// ============================================================================

export interface WebsiteTemplate {
  id: number;
  slug: string;
  name: string;
  description: string;
  thumbnail_url: string;
  template_data: Record<string, unknown>;
  category: 'restaurant' | 'cafe' | 'bar' | 'bakery' | 'catering';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Legacy aliases for migration
export type Website = Site;
export type WebsitePage = SitePage;
export type WebsiteAsset = SiteAsset;
export type WebsiteSettings = ThemeConfig;
