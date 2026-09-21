import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from '@/components/ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders when open is true', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Start over"
        body="Clear?"
        cancelLabel="Keep"
        confirmLabel="Clear"
        onCancel={() => {}}
        onConfirm={() => {}}
      />
    );
    expect(screen.getByText('Start over')).toBeInTheDocument();
    expect(screen.getByText('Clear?')).toBeInTheDocument();
    expect(screen.getByText('Keep')).toBeInTheDocument();
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('is hidden when open is false', () => {
    render(
      <ConfirmDialog
        open={false}
        title="T"
        body="B"
        cancelLabel="C"
        confirmLabel="Y"
        onCancel={() => {}}
        onConfirm={() => {}}
      />
    );
    expect(screen.getByRole('alertdialog', { hidden: true })).toHaveAttribute('hidden');
  });

  it('calls onCancel when cancel clicked', () => {
    const onCancel = jest.fn();
    render(
      <ConfirmDialog
        open={true}
        title="Title"
        body="Body"
        cancelLabel="Cancel"
        confirmLabel="Confirm"
        onCancel={onCancel}
        onConfirm={() => {}}
      />
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm when confirm clicked', () => {
    const onConfirm = jest.fn();
    render(
      <ConfirmDialog
        open={true}
        title="Title"
        body="Body"
        cancelLabel="Cancel"
        confirmLabel="Confirm"
        onCancel={() => {}}
        onConfirm={onConfirm}
      />
    );
    fireEvent.click(screen.getByText('Confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
