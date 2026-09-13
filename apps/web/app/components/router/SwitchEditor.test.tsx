import { render, screen } from '@testing-library/react'
import { SwitchEditor } from './SwitchEditor'
import { useQuery, useMutation } from 'convex/react'
import type { Id } from '@/convex/_generated/dataModel'

// Mock Convex
jest.mock('convex/react')

const mockUseQuery = useQuery as jest.Mock
const mockUseMutation = useMutation as jest.Mock

describe('SwitchEditor', () => {
  const mockSwitchId = 'switch123' as Id<"networkSwitches">
  const mockRouterId = 'router123' as Id<"routers">
  const mockOnClose = jest.fn()
  const mockOnSuccess = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders loading state when switch data is not available', () => {
    mockUseQuery.mockReturnValue(undefined)
    mockUseMutation.mockReturnValue({ withRetry: jest.fn() })

    render(
      <SwitchEditor
        switchId={mockSwitchId}
        routerId={mockRouterId}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    )

    expect(screen.getByText('Loading switch data...')).toBeInTheDocument()
  })
})
