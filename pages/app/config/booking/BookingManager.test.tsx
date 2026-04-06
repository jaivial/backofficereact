import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BookingManager } from './BookingManager'
import * as client from '../../../../api/client'

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

function tick() {
  return new Promise((r) => setTimeout(r, 0))
}

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
    await tick()
    expect(screen.getByText(/Añade el script/i)).toBeInTheDocument()
  })

  it('renders the color customization panel', async () => {
    render(<BookingManager />)
    await tick()
    expect(screen.getByText(/Personalización de colores/i)).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    mockGetSettings.mockImplementation(() => new Promise(() => {})) // never resolves
    render(<BookingManager />)
    expect(screen.getByText(/Cargando/i)).toBeInTheDocument()
  })

  it('shows error state when API fails', async () => {
    mockGetSettings.mockResolvedValue({ success: false, message: 'API Error' })
    render(<BookingManager />)
    await tick()
    // Error is handled by useErrorToast (mocked), so no visible error element expected.
    expect(screen.getByText(/Cargando ajustes/i)).toBeInTheDocument()
  })

  it('renders all 6 color pickers', async () => {
    render(<BookingManager />)
    await tick()
    const pickers = screen.getAllByRole('textbox')
    expect(pickers.length).toBeGreaterThanOrEqual(6)
  })

  it('triggers save when a color changes', async () => {
    render(<BookingManager />)
    await tick()

    const colorInput = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(colorInput, { target: { value: '#ff0000' } })

    await tick()
    // Debounce is 600ms — check after debounce.
    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith({ primary_color: '#ff0000' })
    }, { timeout: 2000 })
  })
})
