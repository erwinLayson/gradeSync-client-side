import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RequestAmendmentModal } from '../components/RequestAmendmentModal';
import * as amendmentApi from '../api/amendments';
import {
  getAmendmentStatusLabel,
  getAmendmentStatusBadgeClass,
  getAmendmentRecordTypeLabel,
} from '../constant/amendment';

vi.mock('../api/amendments', () => ({
  submitAmendmentRequest: vi.fn(),
}));

describe('RequestAmendmentModal component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    recordType: 'gradebook_score' as const,
    studentId: 101,
    studentName: 'Juan Dela Cruz',
    studentLrn: '123456789012',
    enrollmentId: 5,
    classSubjectId: 12,
    subjectName: 'Mathematics 10',
    classroomId: 3,
    classSection: 'Grade 10 - Emerald',
    quarter: 1,
    currentValueDisplay: 15,
  };

  it('does not render when isOpen is false', () => {
    render(<RequestAmendmentModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders student, subject, and currentValue details when open', () => {
    render(<RequestAmendmentModal {...defaultProps} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Request Record Amendment')).toBeInTheDocument();
    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
    expect(screen.getByText('LRN: 123456789012')).toBeInTheDocument();
    expect(screen.getByText('Mathematics 10')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('disables submit button until 10-char reason is entered', async () => {
    const user = userEvent.setup();
    render(<RequestAmendmentModal {...defaultProps} />);

    const submitBtn = screen.getByRole('button', { name: /Submit Amendment Request/i });
    expect(submitBtn).toBeDisabled();

    const reasonInput = screen.getByPlaceholderText(/Explain why this student's records require modification/i);

    // Type short reason (< 10 chars)
    await user.type(reasonInput, 'Error');
    expect(submitBtn).toBeDisabled();
    expect(screen.getByText(/5\/10 chars min/i)).toBeInTheDocument();

    // Complete reason to >= 10 chars
    await user.type(reasonInput, ' in scoring count');
    expect(screen.getByText(/22\/10 chars min/i)).toBeInTheDocument();
    expect(submitBtn).toBeEnabled();
  });

  it('submits amendment and calls onSuccess and onClose', async () => {
    const user = userEvent.setup();
    const mockCreated = {
      id: 99,
      requestNumber: 'AMD-2026-0001',
      requesterFacultyId: 2,
      enrollmentId: 5,
      classId: 3,
      quarter: 1,
      recordType: 'gradebook_score' as const,
      reason: 'Typo in test paper scoring',
      details: '{}',
      status: 'pending' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    vi.mocked(amendmentApi.submitAmendmentRequest).mockResolvedValueOnce({
      message: 'Amendment request submitted successfully',
      success: true,
      data: mockCreated,
    });

    render(<RequestAmendmentModal {...defaultProps} />);

    const reasonInput = screen.getByPlaceholderText(/Explain why this student's records require modification/i);
    const submitBtn = screen.getByRole('button', { name: /Submit Amendment Request/i });

    await user.type(reasonInput, 'Typo in test paper scoring');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(amendmentApi.submitAmendmentRequest).toHaveBeenCalledTimes(1);
    });

    expect(amendmentApi.submitAmendmentRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        recordType: 'gradebook_score',
        studentId: 101,
        enrollmentId: 5,
        quarter: 1,
        reason: 'Typo in test paper scoring',
      }),
    );

    expect(defaultProps.onSuccess).toHaveBeenCalledWith(mockCreated);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onClose when close icon or cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<RequestAmendmentModal {...defaultProps} />);

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelBtn);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});

describe('amendment constants and helpers', () => {
  it('returns appropriate labels and badges', () => {
    expect(getAmendmentStatusLabel('pending')).toBe('Pending Approval');
    expect(getAmendmentStatusLabel('approved')).toBe('Approved (Active)');
    expect(getAmendmentStatusLabel('in_progress')).toBe('In Progress');
    expect(getAmendmentRecordTypeLabel('gradebook_score')).toBe(
      'Gradebook Assessment Score',
    );
    expect(getAmendmentRecordTypeLabel('attendance')).toBe('Daily Attendance Record');

    const badgeClass = getAmendmentStatusBadgeClass('approved');
    expect(badgeClass).toContain('emerald');
  });
});
