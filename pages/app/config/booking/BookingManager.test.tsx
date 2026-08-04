import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { BookingManager } from './BookingManager'

const DEFAULT_SETTINGS = {
  primary_color: '#7c3aed',
  success_color: '#16a34a',
  border_color: '#e5e7eb',
  surface_color: '#ffffff',
  text_color: '#1f2937',
  muted_color: '#6b7280',
  font_stack: 'system-ui, -apple-system, sans-serif',
}

// Mock lucide-react icons.
vi.mock('lucide-react', () => ({
  Copy: () => null,
  Check: () => null,
}))

// Mock the API client.
const mockGetSettings = vi.fn()
const mockUpdateSettings = vi.fn()

vi.mock('../../../../api/client', () => ({
  createClient: vi.fn(() => ({
    widget: {
      getSettings: mockGetSettings,
      updateSettings: mockUpdateSettings,
    },
  })),
}))

// Mock useToasts and useErrorToast.
vi.mock('../../../../ui/feedback/useToasts', () => ({
  useToasts: vi.fn(() => ({
    pushToast: vi.fn(),
  })),
}))

vi.mock('../../../../ui/feedback/useErrorToast', () => ({
  useErrorToast: vi.fn(),
}))

describe('BookingManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSettings.mockResolvedValue({
      success: true,
      settings: DEFAULT_SETTINGS,
    })
    mockUpdateSettings.mockResolvedValue({ success: true })
  })

  it('renders the install guide panel', async () => {
    render(<BookingManager />)
    await waitFor(() => expect(screen.getByText(/Añade el script/i)).toBeInTheDocument())
  })

  it('renders the color customization panel', async () => {
    render(<BookingManager />)
    await waitFor(() => expect(screen.getByText(/Personalización de colores/i)).toBeInTheDocument())
  })

  it('shows loading state initially', async () => {
    mockGetSettings.mockImplementation(() => new Promise(() => {})) // never resolves
    render(<BookingManager />)
    // The InlineAlert shows "Cargando" title and "Cargando ajustes del widget..." message
    expect(screen.getByText(/Cargando ajustes del widget/i)).toBeInTheDocument()
  })

  it('shows error state when API fails', async () => {
    mockGetSettings.mockResolvedValue({ success: false, message: 'API Error' })
    render(<BookingManager />)
    await waitFor(() => expect(screen.getByText(/Personalización de colores/i)).toBeInTheDocument())
  })

  it('renders all 6 color pickers', async () => {
    render(<BookingManager />)
    await waitFor(() => expect(screen.getByLabelText('Color primario')).toBeInTheDocument())
    // Each ColorPicker has an <input type="color"> with a specific aria-label
    const colorLabels = [
      'Color primario',
      'Color de éxito',
      'Color de borde',
      'Color de fondo',
      'Color de texto',
      'Color secundario',
    ]
    for (const label of colorLabels) {
      const input = screen.getByLabelText(label)
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('type', 'color')
    }
  })

  it('triggers save when a color changes', async () => {
    render(<BookingManager />)
    await waitFor(() => expect(screen.getByLabelText('Color primario')).toBeInTheDocument())

    const primaryInput = screen.getByLabelText('Color primario')
    fireEvent.change(primaryInput, { target: { value: '#ff0000' } })

    // Wait for the 600ms debounce + API call
    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith({ primary_color: '#ff0000' })
    }, { timeout: 2000 })
  })
})
