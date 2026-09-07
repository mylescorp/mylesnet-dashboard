import { render, screen } from '@testing-library/react'
import { SwitchHistory } from './SwitchHistory'
import { useQuery } from 'convex/react'
import type { Id } from '../../../convex/_generated/dataModel'

// Mock Convex
jest.mock('convex/react')

const mockUseQuery = useQuery as jest.Mock

describe('SwitchHistory', () => {
  const mockSwitchId = 'switch123' as Id<"networkSwitches">
  const mockRouterId = 'router123' as Id<"routers">
  const mockOnClose = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders loading state when switch data is not available', () => {
    mockUseQuery.mockReturnValue(undefined)

    render(
      <SwitchHistory
        switchId={mockSwitchId}
        routerId={mockRouterId}
        onClose={mockOnClose}
      />
    )

    expect(screen.getByText('Loading switch data...')).toBeInTheDocument()
  })

  it('renders switch modal with close button', () => {
    mockUseQuery.mockReturnValue(undefined)

    render(
      <SwitchHistory
        switchId={mockSwitchId}
        routerId={mockRouterId}
        onClose={mockOnClose}
      />
    )

    expect(screen.getByLabelText('Close')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    mockUseQuery.mockReturnValue(undefined)

    render(
      <SwitchHistory
        switchId={mockSwitchId}
        routerId={mockRouterId}
        onClose={mockOnClose}
      />
    )

    const closeButton = screen.getByLabelText('Close')
    closeButton.click()

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })
})
