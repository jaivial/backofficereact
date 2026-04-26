import { useState, useEffect, useCallback } from 'react';
import { atom, useAtom } from 'jotai';
import { DndProvider, useDrag, useDrop, type DragSourceMonitor, type DropTargetMonitor } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
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

export default function WebsiteBuilder() {
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
      <div className="flex items-center justify-center h-64" data-ui="loading-state">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" data-slot="website-builder-border-purple-500" />
        <span className="ml-2 text-slate-400" data-slot="website-builder-text-slate-400">Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 m-6" data-ui="error-state">
        <p className="text-red-400" data-slot="website-builder-text-red-400">{error}</p>
        <button onClick={loadWebsite} className="mt-2 text-red-300 underline hover:text-red-200" data-testid="website-builder-retry">
          Retry
        </button>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-slate-900" data-ui="website-builder">
        {/* Header */}
        <header className="bg-slate-800 border-b border-slate-700" data-ui="header">
          <div className="max-w-full px-4 py-3 flex items-center justify-between" data-slot="website-builder-justify-between">
            <div className="flex items-center gap-4" data-slot="website-builder-gap-4">
              <h1 className="text-xl font-semibold text-slate-100" data-slot="website-builder-text-slate-100">
                Website Builder
              </h1>
              {website && (
                <span className={`px-2 py-1 text-xs rounded-full ${
                  website.status === 'published' 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {website.status}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2" data-slot="website-builder-gap-2">
              <button
                onClick={() => setPreviewMode(!previewMode)}
                className="px-3 py-1.5 text-sm border border-slate-600 rounded hover:bg-slate-700 text-slate-300"
                data-testid="website-builder-preview-toggle"
              >
                {previewMode ? 'Edit' : 'Preview'}
              </button>
              <button
                onClick={handlePreview}
                className="px-3 py-1.5 text-sm border border-slate-600 rounded hover:bg-slate-700 text-slate-300"
                data-testid="website-builder-open-preview"
              >
                Open Preview
              </button>
              <button
                onClick={handlePublish}
                disabled={loading}
                className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                data-testid="website-builder-publish"
              >
                Publish
              </button>
            </div>
          </div>
        </header>

        <div className="flex h-[calc(100vh-60px)]" data-slot="website-builder-h-[calc(100vh-60px)]">
          {/* Sidebar - Component Library */}
          {!previewMode && (
            <aside className="w-64 bg-slate-800 border-r border-slate-700 overflow-y-auto" data-ui="sidebar">
              <div className="p-4" data-slot="website-builder-p-4">
                <h2 className="text-sm font-semibold text-slate-300 mb-3" data-slot="website-builder-mb-3">
                  Components
                </h2>
                <ComponentLibrary />
              </div>
            </aside>
          )}

          {/* Main Canvas */}
          <main className="flex-1 overflow-y-auto bg-slate-900" data-ui="canvas">
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

          {/* Right Sidebar - Properties Panel */}
          {!previewMode && selectedComponent && (
            <aside className="w-80 bg-slate-800 border-l border-slate-700 overflow-y-auto" data-ui="properties-panel">
              <div className="p-4" data-slot="website-builder-p-4">
                <h2 className="text-sm font-semibold text-slate-300 mb-3" data-slot="website-builder-mb-3">
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
    <div className="space-y-2" data-ui="component-list">
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
      className={`p-2 bg-slate-700/50 border border-slate-600 rounded cursor-move hover:border-indigo-400 hover:bg-slate-700 transition-colors ${
        isDragging ? 'opacity-50' : ''
      }`}
      data-ui="draggable-component"
      data-component-type={component.type}
    >
      <div className="flex items-center gap-2" data-slot="website-builder-gap-2">
        <span className="text-lg" data-slot="website-builder-text-lg">{component.icon}</span>
        <span className="text-sm text-slate-200" data-slot="website-builder-text-slate-200">{component.name}</span>
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
      <div className="flex items-center justify-center h-full" data-ui="no-website">
        <div className="text-center" data-slot="website-builder-text-center">
          <p className="text-slate-400 mb-4" data-slot="website-builder-mb-4">No website created yet</p>
          <button
            onClick={async () => {
              try {
                await websiteBuilderApi.createWebsite({});
                onRefresh();
              } catch (err) {
                console.error('Failed to create website:', err);
              }
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            data-testid="website-builder-create-website"
          >
            Create Website
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6" data-ui="canvas-content">
      {/* Page Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2" data-ui="page-tabs" data-testid="website-builder-page-tabs">
        {pages.map(page => (
          <button
            key={page.id}
            onClick={() => onSelectPage(String(page.id))}
            className={`px-4 py-2 rounded text-sm whitespace-nowrap transition-colors ${
              String(page.id) === currentPage
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            data-ui="page-tab"
            data-page-id={page.id}
            data-active={String(page.id) === currentPage}
            data-testid={`website-builder-page-tab-${page.id}`}
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
          className="px-4 py-2 rounded text-sm bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-dashed border-slate-600"
          data-ui="add-page-btn"
          data-testid="website-builder-add-page"
        >
          + Add Page
        </button>
      </div>

      {/* Canvas Area */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 min-h-[500px]" data-ui="canvas-area">
        {loadingSections ? (
          <div className="flex items-center justify-center h-32" data-slot="website-builder-h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" data-slot="website-builder-border-indigo-500" />
          </div>
        ) : (
          <div className="space-y-4" data-slot="website-builder-space-y-4">
            {sections.length === 0 ? (
              <div className="text-center py-12 text-slate-400" data-ui="empty-canvas">
                <p data-slot="website-builder-ing">No sections yet. Add a section to start building.</p>
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
            
            {/* Add Section Button */}
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
        isOver ? 'border-indigo-400 bg-indigo-500/10' : 'border-slate-600'
      }`}
      data-ui="section-drop-zone"
      data-section-id={section.id}
      data-section-type={section.section_type}
    >
      <div className="flex items-center justify-between mb-3" data-slot="website-builder-mb-3">
        <h3 className="text-sm font-medium text-slate-300 capitalize" data-slot="website-builder-capitalize">
          {section.section_type}
        </h3>
        <div className="flex gap-2" data-slot="website-builder-gap-2">
          <span className="text-xs text-slate-500" data-slot="website-builder-text-slate-500">
            {section.is_visible ? 'Visible' : 'Hidden'}
          </span>
          <button
            onClick={onDelete}
            className="text-xs text-red-400 hover:text-red-300"
            aria-label="Delete section"
            data-testid="website-builder-delete-section"
          >
            🗑️
          </button>
        </div>
      </div>
      
      <div className="space-y-2" data-slot="website-builder-space-y-2">
        {components.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4" data-slot="website-builder-py-4">
            Drag components here
          </p>
        ) : (
          components.map((comp) => (
            <div
              key={comp.id}
              onClick={() => onSelectComponent(String(comp.id))}
              className="p-2 bg-slate-700/50 border border-slate-600 rounded cursor-pointer hover:border-indigo-400 transition-colors"
              data-ui="section-component"
              data-component-id={comp.id}
            >
              <div className="flex items-center justify-between" data-slot="website-builder-justify-between">
                <div className="flex items-center gap-2" data-slot="website-builder-gap-2">
                  <span className="text-slate-400" data-slot="website-builder-text-slate-400">
                    {comp.dynamic_source ? '🔗' : '📦'}
                  </span>
                  <span className="text-sm text-slate-200" data-slot="website-builder-text-slate-200">
                    {comp.component?.name || `Component ${comp.id}`}
                  </span>
                  {comp.dynamic_source && (
                    <span className="text-xs text-indigo-400" data-slot="website-builder-text-indigo-400">
                      ({comp.dynamic_source})
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteComponent(comp.id);
                  }}
                  className="text-xs text-red-400 hover:text-red-300"
                  aria-label="Delete component"
                  data-testid="website-builder-delete-component"
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
    <div className="relative" data-ui="add-section-wrapper">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-3 border-2 border-dashed border-slate-600 rounded-lg text-slate-400 hover:border-indigo-400 hover:text-indigo-400 transition-colors"
        data-ui="add-section-btn"
        data-testid="website-builder-add-section"
      >
        + Add Section
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-2 w-full bg-slate-800 border border-slate-600 rounded-lg shadow-xl p-2" data-ui="section-type-menu">
          {SECTION_TYPES.map(type => (
            <button
              key={type}
              onClick={() => {
                onAdd(type);
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-700 rounded capitalize text-slate-200"
              data-ui="section-type-option"
              data-type={type}
              data-testid={`website-builder-section-type-${type}`}
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
    return <div className="text-sm text-slate-400">Loading...</div>;
  }

  return (
    <div className="space-y-4" data-ui="properties-form">
      <div data-slot="website-builder-div">
        <label className="block text-sm font-medium text-slate-300 mb-1" data-slot="website-builder-mb-1">
          Component ID
        </label>
        <input
          type="text"
          value={componentId}
          disabled
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-slate-400"
          data-testid="website-builder-component-id-input"
        />
      </div>

      <div data-slot="website-builder-div">
        <label className="block text-sm font-medium text-slate-300 mb-1" data-slot="website-builder-mb-1">
          Title
        </label>
        <input
          type="text"
          value={settings.title || ''}
          onChange={(e) => setSettings({ ...settings, title: e.target.value })}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-slate-200"
          data-testid="website-builder-title-input"
        />
      </div>

      <div data-slot="website-builder-div">
        <label className="block text-sm font-medium text-slate-300 mb-1" data-slot="website-builder-mb-1">
          Background Color
        </label>
        <input
          type="color"
          value={settings.bgColor || '#1e293b'}
          onChange={(e) => setSettings({ ...settings, bgColor: e.target.value })}
          className="w-full h-10 bg-slate-700 border border-slate-600 rounded cursor-pointer"
          data-testid="website-builder-color-input"
        />
      </div>

      <div data-slot="website-builder-div">
        <label className="flex items-center gap-2 cursor-pointer" data-slot="website-builder-cursor-pointer">
          <input
            type="checkbox"
            checked={settings.visible !== false}
            onChange={(e) => setSettings({ ...settings, visible: e.target.checked })}
            className="rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500"
            data-testid="website-builder-visible-checkbox"
          />
          <span className="text-sm text-slate-300" data-slot="website-builder-text-slate-300">Visible</span>
        </label>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        data-testid="website-builder-save-button"
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
      <div className="flex items-center justify-center h-full" data-ui="preview-loading">
        <p className="text-slate-400" data-slot="website-builder-text-slate-400">Loading preview...</p>
      </div>
    );
  }

  if (!previewUrl) {
    return (
      <div className="flex items-center justify-center h-full" data-ui="preview-error">
        <p className="text-slate-400" data-slot="website-builder-text-slate-400">Failed to load preview</p>
      </div>
    );
  }

  return (
    <div className="h-full" data-ui="preview-iframe-container">
      <iframe 
        src={previewUrl}
        className="w-full h-full border-0 bg-white"
        title="Website Preview"
      />
    </div>
  );
}
