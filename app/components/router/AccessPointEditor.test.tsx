import { render, screen } from '@testing-library/react'
import { AccessPointEditor } from './AccessPointEditor'
import { useQuery, useMutation } from 'convex/react'
import type { Id } from '../../../convex/_generated/dataModel'

// Mock Convex
jest.mock('convex/react')

const mockUseQuery = useQuery as jest.Mock
const mockUseMutation = useMutation as jest.Mock

describe('AccessPointEditor', () => {
  const mockRouterId = 'router123' as Id<"routers">
  const mockOnClose = jest.fn()
  const mockOnSuccess = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders create form when no access point ID is provided', () => {
    mockUseQuery.mockReturnValue([])
    mockUseMutation.mockReturnValue({ withRetry: jest.fn() })

    render(
      <AccessPointEditor
        routerId={mockRouterId}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    )

    expect(screen.getByRole('heading', { name: 'Create Access Point' })).toBeInTheDocument()
  })
})
