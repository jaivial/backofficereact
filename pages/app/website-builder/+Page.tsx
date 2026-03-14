import { useState, useEffect, useCallback } from 'react';
import { atom, useAtom } from 'jotai';
import { DndProvider, useDrag, useDrop, type DragSourceMonitor, type DropTargetMonitor } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

import "../../../components/bo.css";
import { websiteBuilderApi } from '../../../api/website-builder';
import type { Website, WebsitePage, WebsitePageSection, WebsiteComponent, WebsiteSectionComponent } from '../../../api/website-builder-types';

// Types for local UI state
interface UIComponent {
  id: string;
  type: string;
  name: string;
  icon: string;
  settings: Record<string, any>;
}

// State atoms
const websiteAtom = atom<Website | null>(null);
const pagesAtom = atom<WebsitePage[]>([]);
const currentPageAtom = atom<string | null>(null);
const selectedComponentAtom = atom<string | null>(null);
const previewModeAtom = atom<boolean>(false);
const loadingAtom = atom<boolean>(true);

export default function Page() {
  const [website, setWebsite] = useAtom(websiteAtom);
  const [pages, setPages] = useAtom(pagesAtom);
  const [currentPage, setCurrentPage] = useAtom(currentPageAtom);
  const [selectedComponent, setSelectedComponent] = useAtom(selectedComponentAtom);
  const [previewMode, setPreviewMode] = useAtom(previewModeAtom);
  const [loading, setLoading] = useAtom(loadingAtom);
  const [error, setError] = useState<string | null>(null);

  // Load website data
  useEffect(() => {
    loadWebsite();
  }, []);

  const loadWebsite = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const site = await websiteBuilderApi.getWebsite();
      setWebsite(site);
      if (site?.id) {
        const pageList = await websiteBuilderApi.listPages(site.id);
        setPages(pageList);
        if (pageList.length > 0) {
          setCurrentPage(String(pageList[0].id));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load website');
    } finally {
      setLoading(false);
    }
  }, [setWebsite, setPages, setCurrentPage, setLoading]);

  const handlePublish = useCallback(async () => {
    if (!website) return;
    setLoading(true);
    try {
      const result = await websiteBuilderApi.publish();
      alert(`Website published to ${result.storage_path}`);
      loadWebsite();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setLoading(false);
    }
  }, [website, loadWebsite, setLoading]);

  const handlePreview = useCallback(async () => {
    try {
      const previewUrl = await websiteBuilderApi.preview();
      window.open(previewUrl, '_blank');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Preview failed');
    }
  }, []);

  const currentPageData = pages.find(p => String(p.id) === currentPage);

  if (loading && !website) {
    return (
      <div className="bo-flex bo-items-center bo-justify-center bo-wbLoading" data-ui="loading-state">
        <div className="bo-wbLoadingSpinner" />
        <span className="bo-ml-2 bo-muted">Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bo-wbError" data-ui="error-state">
        <p className="bo-wbErrorText">{error}</p>
        <button onClick={loadWebsite} className="bo-wbErrorRetry">
          Retry
        </button>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="bo-wbContainer" data-ui="website-builder">
        <header className="bo-wbHeader bo-border-b" data-ui="header">
          <div className="bo-max-w-full bo-px-4 bo-py-3 bo-flex bo-items-center bo-justify-between">
            <div className="bo-flex bo-items-center bo-gap-4">
              <h1 className="bo-text-xl bo-weight-semibold bo-wbTitle">
                Website Builder
              </h1>
              {website && (
                <span className={`bo-px-2 bo-py-1 bo-text-xs bo-radius-full ${
                  website.status === 'published' 
                    ? 'bo-bg-success bo-text-success' 
                    : 'bo-bg-warning bo-text-warning'
                }`}>
                  {website.status}
                </span>
              )}
            </div>
            <div className="bo-flex bo-items-center bo-gap-2">
              <button
                onClick={() => setPreviewMode(!previewMode)}
                className="bo-wbBtn"
              >
                {previewMode ? 'Edit' : 'Preview'}
              </button>
              <button
                onClick={handlePreview}
                className="bo-wbBtn"
              >
                Open Preview
              </button>
              <button
                onClick={handlePublish}
                disabled={loading}
                className="bo-wbBtn bo-wbBtnPrimary"
              >
                Publish
              </button>
            </div>
          </div>
        </header>

        <div className="bo-flex bo-h-screen-nav">
          {!previewMode && (
            <aside className="bo-wbSidebar bo-border-r" data-ui="sidebar">
              <div className="bo-p-4">
                <h2 className="bo-text-sm bo-weight-semibold bo-mb-3 bo-wbTitle">
                  Components
                </h2>
                <ComponentLibrary />
              </div>
            </aside>
          )}

          <main className="bo-wbCanvas" data-ui="canvas">
            {previewMode ? (
              <WebsitePreview website={website} currentPage={currentPage} />
            ) : (
              <WebsiteCanvas 
                website={website}
                pages={pages}
                currentPage={currentPage}
                currentPageData={currentPageData}
                onSelectPage={setCurrentPage}
                onSelectComponent={setSelectedComponent}
                onRefresh={loadWebsite}
              />
            )}
          </main>

          {!previewMode && selectedComponent && (
            <aside className="w-80 border-l overflow-y-auto" data-ui="properties-panel" style={{ backgroundColor: 'var(--bo-surface)', borderColor: 'var(--bo-border)' }}>
              <div className="p-4">
                <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--bo-text)' }}>
                  Properties
                </h2>
                <PropertiesPanel componentId={selectedComponent} onUpdate={loadWebsite} />
              </div>
            </aside>
          )}
        </div>
      </div>
    </DndProvider>
  );
}

// Component Library (Draggable Components)
const COMPONENT_CATALOG: UIComponent[] = [
  { id: 'hero-banner', type: 'hero', name: 'Hero Banner', icon: '🖼️', settings: {} },
  { id: 'menu-card', type: 'menu', name: 'Menu Card', icon: '🍽️', settings: { dynamicSource: 'menus' } },
  { id: 'wine-list', type: 'wine', name: 'Wine List', icon: '🍷', settings: { dynamicSource: 'wines' } },
  { id: 'gallery-grid', type: 'gallery', name: 'Gallery', icon: '📷', settings: {} },
  { id: 'contact-form', type: 'contact', name: 'Contact Form', icon: '📧', settings: {} },
  { id: 'hours-table', type: 'hours', name: 'Opening Hours', icon: '🕐', settings: { dynamicSource: 'hours' } },
  { id: 'map-embed', type: 'map', name: 'Map', icon: '📍', settings: {} },
  { id: 'testimonials', type: 'testimonials', name: 'Testimonials', icon: '💬', settings: {} },
  { id: 'cta-button', type: 'cta', name: 'CTA Button', icon: '🔘', settings: {} },
  { id: 'text-block', type: 'text', name: 'Text Block', icon: '📝', settings: {} },
  { id: 'image-block', type: 'image', name: 'Image', icon: '🖼️', settings: {} },
  { id: 'spacer', type: 'spacer', name: 'Spacer', icon: '↕️', settings: {} },
  { id: 'divider', type: 'divider', name: 'Divider', icon: '➖', settings: {} },
  { id: 'social-links', type: 'social', name: 'Social Links', icon: '🔗', settings: {} },
  { id: 'reservation-form', type: 'reservation', name: 'Reservation Form', icon: '📅', settings: {} },
];

function ComponentLibrary() {
  return (
    <div className="bo-flex bo-flex-col bo-gap-2" data-ui="component-list">
      {COMPONENT_CATALOG.map(comp => (
        <DraggableComponent key={comp.id} component={comp} />
      ))}
    </div>
  );
}

function DraggableComponent({ component }: { component: UIComponent }) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'COMPONENT',
    item: component,
    collect: (monitor: DragSourceMonitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [component]);

  return (
    <div
      ref={(node) => {
        drag(node);
      }}
      className={`bo-p-2 bo-radius bo-cursor-move ${isDragging ? 'bo-opacity-50' : ''}`}
      style={{ 
        backgroundColor: 'var(--bo-surface-2)', 
        border: '1px solid var(--bo-border)',
        color: 'var(--bo-text)'
      }}
      data-ui="draggable-component"
      data-component-type={component.type}
    >
      <div className="bo-flex bo-items-center bo-gap-2">
        <span style={{ fontSize: '1.125rem' }}>{component.icon}</span>
        <span className="bo-text-sm" style={{ color: 'var(--bo-text)' }}>{component.name}</span>
      </div>
    </div>
  );
}

// Website Canvas (Drop Zone)
function WebsiteCanvas({ 
  website,
  pages,
  currentPage,
  currentPageData,
  onSelectPage,
  onSelectComponent,
  onRefresh,
}: { 
  website: Website | null;
  pages: WebsitePage[];
  currentPage: string | null;
  currentPageData: WebsitePage | undefined;
  onSelectPage: (id: string) => void;
  onSelectComponent: (id: string) => void;
  onRefresh: () => void;
}) {
  const [sections, setSections] = useState<WebsitePageSection[]>([]);
  const [loadingSections, setLoadingSections] = useState(false);

  useEffect(() => {
    if (currentPageData?.id) {
      loadSections(currentPageData.id);
    }
  }, [currentPageData?.id]);

  const loadSections = useCallback(async (pageId: number) => {
    setLoadingSections(true);
    try {
      const sectionList = await websiteBuilderApi.listSections(pageId);
      setSections(sectionList);
    } catch (err) {
      console.error('Failed to load sections:', err);
    } finally {
      setLoadingSections(false);
    }
  }, []);

  const handleAddSection = useCallback(async (sectionType: string) => {
    if (!currentPageData?.id) return;
    try {
      await websiteBuilderApi.createSection({
        page_id: currentPageData.id,
        section_type: sectionType,
      });
      loadSections(currentPageData.id);
    } catch (err) {
      console.error('Failed to add section:', err);
    }
  }, [currentPageData?.id, loadSections]);

  const handleDeleteSection = useCallback(async (sectionId: number) => {
    if (!confirm('Delete this section?')) return;
    try {
      await websiteBuilderApi.deleteSection(sectionId);
      if (currentPageData?.id) {
        loadSections(currentPageData.id);
      }
    } catch (err) {
      console.error('Failed to delete section:', err);
    }
  }, [currentPageData?.id, loadSections]);

  if (!website) {
    return (
      <div className="bo-flex bo-items-center bo-justify-center bo-h-full" data-ui="no-website">
        <div className="bo-text-center">
          <p className="bo-mb-4" style={{ color: 'var(--bo-muted)' }}>No website created yet</p>
          <button 
            onClick={async () => {
              try {
                await websiteBuilderApi.createWebsite({});
                onRefresh();
              } catch (err) {
                console.error('Failed to create website:', err);
              }
            }}
            className="bo-px-4 bo-py-2 bo-radius"
            style={{ backgroundColor: 'var(--bo-accent)', color: 'var(--bo-fg-inverted)' }}
          >
            Create Website
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bo-p-6" data-ui="canvas-content">
      <div className="bo-flex bo-gap-2 bo-mb-4 bo-overflow-x-auto bo-pb-2" data-ui="page-tabs">
        {pages.map(page => (
          <button
            key={page.id}
            onClick={() => onSelectPage(String(page.id))}
            className="bo-px-4 bo-py-2 bo-radius bo-text-sm bo-whitespace-nowrap"
            style={String(page.id) === currentPage 
              ? { backgroundColor: 'var(--bo-accent)', color: '#fff' }
              : { backgroundColor: 'var(--bo-surface-2)', color: 'var(--bo-muted)', border: '1px solid var(--bo-border)' }
            }
            data-ui="page-tab"
            data-page-id={page.id}
            data-active={String(page.id) === currentPage}
          >
            {page.title || 'Home'}
          </button>
        ))}
        <button
          onClick={async () => {
            const slug = prompt('Page slug (e.g., about, contact):');
            if (slug && website.id) {
              try {
                await websiteBuilderApi.createPage({
                  website_id: website.id,
                  slug: slug,
                  title: slug.charAt(0).toUpperCase() + slug.slice(1),
                });
                onRefresh();
              } catch (err) {
                console.error('Failed to create page:', err);
              }
            }
          }}
          className="bo-px-4 bo-py-2 bo-radius bo-text-sm bo-border bo-border-dashed"
          style={{ backgroundColor: 'var(--bo-surface-2)', color: 'var(--bo-muted)', borderColor: 'var(--bo-border-2)' }}
          data-ui="add-page-btn"
        >
          + Add Page
        </button>
      </div>

      <div className="bo-radius-lg bo-border bo-p-6" style={{ minHeight: '500px', backgroundColor: 'var(--bo-surface)', borderColor: 'var(--bo-border)' }} data-ui="canvas-area">
        {loadingSections ? (
          <div className="bo-flex bo-items-center bo-justify-center" style={{ height: '8rem' }}>
            <div className="animate-spin rounded-full" style={{ width: '1.5rem', height: '1.5rem', borderBottomColor: 'var(--bo-accent)' }} />
          </div>
        ) : (
          <div className="bo-flex bo-flex-col bo-gap-4">
            {sections.length === 0 ? (
              <div className="bo-text-center bo-py-12" style={{ color: 'var(--bo-muted)' }} data-ui="empty-canvas">
                <p>No sections yet. Add a section to start building.</p>
              </div>
            ) : (
              sections.map((section) => (
                <SectionDropZone 
                  key={section.id} 
                  section={section}
                  onSelectComponent={onSelectComponent}
                  onDelete={() => handleDeleteSection(section.id)}
                  onRefresh={() => currentPageData?.id && loadSections(currentPageData.id)}
                />
              ))
            )}
            
            <AddSectionButton onAdd={handleAddSection} />
          </div>
        )}
      </div>
    </div>
  );
}

function SectionDropZone({ 
  section,
  onSelectComponent,
  onDelete,
  onRefresh,
}: { 
  section: WebsitePageSection;
  onSelectComponent: (id: string) => void;
  onDelete: () => void;
  onRefresh: () => void;
}) {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: ['COMPONENT'],
    drop: async (item: UIComponent) => {
      // Add component to section
      try {
        const components = await websiteBuilderApi.listComponents();
        const comp = components.find(c => c.component_type === item.type);
        if (comp) {
          await websiteBuilderApi.createSectionComponent({
            section_id: section.id,
            component_id: comp.id,
            dynamic_source: item.settings?.dynamicSource || '',
          });
          onRefresh();
        }
      } catch (err) {
        console.error('Failed to add component:', err);
      }
    },
    collect: (monitor: DropTargetMonitor) => ({
      isOver: monitor.isOver(),
    }),
  }), [section.id, onRefresh]);

  const [components, setComponents] = useState<WebsiteSectionComponent[]>([]);

  useEffect(() => {
    loadComponents();
  }, [section.id]);

  const loadComponents = useCallback(async () => {
    try {
      const compList = await websiteBuilderApi.listSectionComponents(section.id);
      setComponents(compList);
    } catch (err) {
      console.error('Failed to load section components:', err);
    }
  }, [section.id]);

  const handleDeleteComponent = useCallback(async (compId: number) => {
    if (!confirm('Delete this component?')) return;
    try {
      await websiteBuilderApi.deleteSectionComponent(compId);
      loadComponents();
    } catch (err) {
      console.error('Failed to delete component:', err);
    }
  }, [loadComponents]);

  return (
    <div
      ref={(node) => {
        drop(node);
      }}
      className={`border-2 border-dashed rounded-lg p-4 min-h-[100px] transition-colors ${
        isOver ? '' : ''
      }`}
      style={isOver 
        ? { borderColor: 'var(--bo-accent)', backgroundColor: 'color-mix(in srgb, var(--bo-accent) 8%, transparent)' }
        : { borderColor: 'var(--bo-border-2)' }
      }
      data-ui="section-drop-zone"
      data-section-id={section.id}
      data-section-type={section.section_type}
    >
      <div className="bo-flex bo-items-center bo-justify-between bo-mb-3">
        <h3 className="bo-text-sm bo-weight-medium capitalize" style={{ color: 'var(--bo-text)' }}>
          {section.section_type}
        </h3>
        <div className="bo-flex bo-gap-2">
          <span className="bo-text-xs" style={{ color: 'var(--bo-faint)' }}>
            {section.is_visible ? 'Visible' : 'Hidden'}
          </span>
          <button 
            onClick={onDelete}
            className="bo-text-xs"
            style={{ color: 'var(--bo-text-danger)' }}
            aria-label="Delete section"
          >
            🗑️
          </button>
        </div>
      </div>
      
      <div className="bo-flex bo-flex-col bo-gap-2">
        {components.length === 0 ? (
          <p className="bo-text-sm bo-text-center bo-py-4" style={{ color: 'var(--bo-faint)' }}>
            Drag components here
          </p>
        ) : (
          components.map((comp) => (
            <div
              key={comp.id}
              onClick={() => onSelectComponent(String(comp.id))}
              className="bo-p-2 bo-radius bo-cursor-pointer"
              style={{ 
                backgroundColor: 'var(--bo-surface-2)', 
                border: '1px solid var(--bo-border)',
                color: 'var(--bo-text)'
              }}
              data-ui="section-component"
              data-component-id={comp.id}
            >
              <div className="bo-flex bo-items-center bo-justify-between">
                <div className="bo-flex bo-items-center bo-gap-2">
                  <span style={{ color: 'var(--bo-muted)' }}>
                    {comp.dynamic_source ? '🔗' : '📦'}
                  </span>
                  <span className="bo-text-sm">
                    {comp.component?.name || `Component ${comp.id}`}
                  </span>
                  {comp.dynamic_source && (
                    <span className="bo-text-xs" style={{ color: 'var(--bo-accent)' }}>
                      ({comp.dynamic_source})
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteComponent(comp.id);
                  }}
                  className="bo-text-xs"
                  style={{ color: 'var(--bo-text-danger)' }}
                  aria-label="Delete component"
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const SECTION_TYPES = [
  'header', 'hero', 'about', 'menu', 'gallery', 
  'contact', 'hours', 'map', 'testimonials', 'footer'
];

function AddSectionButton({ onAdd }: { onAdd: (type: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bo-relative" data-ui="add-section-wrapper">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bo-w-full bo-py-3 bo-border-2 bo-border-dashed bo-radius-lg"
        style={{ borderColor: 'var(--bo-border-2)', color: 'var(--bo-muted)' }}
        data-ui="add-section-btn"
      >
        + Add Section
      </button>
      
      {isOpen && (
        <div className="bo-absolute bo-z-10 bo-mt-2 bo-w-full bo-radius-lg bo-shadow-xl bo-p-2" data-ui="section-type-menu" style={{ backgroundColor: 'var(--bo-surface)', border: '1px solid var(--bo-border)' }}>
          {SECTION_TYPES.map(type => (
            <button
              key={type}
              onClick={() => {
                onAdd(type);
                setIsOpen(false);
              }}
              className="bo-w-full bo-text-left bo-px-3 bo-py-2 bo-text-sm bo-radius capitalize"
              style={{ color: 'var(--bo-text)' }}
              data-ui="section-type-option"
              data-type={type}
            >
              {type}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Properties Panel
function PropertiesPanel({ componentId, onUpdate }: { componentId: string; onUpdate: () => void }) {
  const [component, setComponent] = useState<WebsiteSectionComponent | null>(null);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadComponent();
  }, [componentId]);

  const loadComponent = useCallback(async () => {
    setLoading(true);
    try {
      // Note: We need an endpoint to get a single section component
      // For now, we'll just use the settings from the component data
      setSettings({});
    } catch (err) {
      console.error('Failed to load component:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await websiteBuilderApi.updateSectionComponent(parseInt(componentId), {
        settings,
      });
      onUpdate();
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  }, [componentId, settings, onUpdate]);

  if (loading) {
    return <div className="bo-text-sm" style={{ color: 'var(--bo-muted)' }}>Loading...</div>;
  }

  return (
    <div className="bo-flex bo-flex-col bo-gap-4" data-ui="properties-form">
      <div>
        <label className="bo-block bo-text-sm bo-weight-medium bo-mb-1" style={{ color: 'var(--bo-text)' }}>
          Component ID
        </label>
        <input
          type="text"
          value={componentId}
          disabled
          className="bo-w-full bo-px-3 bo-py-2 bo-radius bo-text-sm"
          style={{ backgroundColor: 'var(--bo-surface-2)', border: '1px solid var(--bo-border)', color: 'var(--bo-muted)' }}
        />
      </div>

      <div>
        <label className="bo-block bo-text-sm bo-weight-medium bo-mb-1" style={{ color: 'var(--bo-text)' }}>
          Title
        </label>
        <input
          type="text"
          value={settings.title || ''}
          onChange={(e) => setSettings({ ...settings, title: e.target.value })}
          className="bo-w-full bo-px-3 bo-py-2 bo-radius bo-text-sm"
          style={{ backgroundColor: 'var(--bo-surface-2)', border: '1px solid var(--bo-border)', color: 'var(--bo-text)' }}
        />
      </div>

      <div>
        <label className="bo-block bo-text-sm bo-weight-medium bo-mb-1" style={{ color: 'var(--bo-text)' }}>
          Background Color
        </label>
        <input
          type="color"
          value={settings.bgColor || '#1e293b'}
          onChange={(e) => setSettings({ ...settings, bgColor: e.target.value })}
          className="bo-w-full bo-h-10 bo-radius bo-cursor-pointer"
          style={{ backgroundColor: 'var(--bo-surface-2)', border: '1px solid var(--bo-border)' }}
        />
      </div>

      <div>
        <label className="bo-flex bo-items-center bo-gap-2 bo-cursor-pointer">
          <input
            type="checkbox"
            checked={settings.visible !== false}
            onChange={(e) => setSettings({ ...settings, visible: e.target.checked })}
            className="bo-radius"
            style={{ borderColor: 'var(--bo-border)', backgroundColor: 'var(--bo-surface-2)', accentColor: 'var(--bo-accent)' }}
          />
          <span className="bo-text-sm" style={{ color: 'var(--bo-text)' }}>Visible</span>
        </label>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="bo-w-full bo-py-2 bo-radius bo-text-sm bo-transition-colors bo-disabled-opacity-50"
        style={{ backgroundColor: 'var(--bo-accent)', color: 'var(--bo-fg-inverted)' }}
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}

// Website Preview
function WebsitePreview({ website, currentPage }: { website: Website | null; currentPage: string | null }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (website) {
      generatePreview();
    }
  }, [website, currentPage]);

  const generatePreview = useCallback(async () => {
    setLoading(true);
    try {
      const url = await websiteBuilderApi.preview();
      setPreviewUrl(url);
    } catch (err) {
      console.error('Failed to generate preview:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="bo-flex bo-items-center bo-justify-center bo-h-full" data-ui="preview-loading">
        <p style={{ color: 'var(--bo-muted)' }}>Loading preview...</p>
      </div>
    );
  }

  if (!previewUrl) {
    return (
      <div className="bo-flex bo-items-center bo-justify-center bo-h-full" data-ui="preview-error">
        <p style={{ color: 'var(--bo-muted)' }}>Failed to load preview</p>
      </div>
    );
  }

  return (
    <div className="bo-h-full" data-ui="preview-iframe-container">
      <iframe 
        src={previewUrl}
        className="bo-w-full bo-h-full bo-border-0"
        style={{ backgroundColor: 'var(--bo-shell)' }}
        title="Website Preview"
      />
    </div>
  );
}
