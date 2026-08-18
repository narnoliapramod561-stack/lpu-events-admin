import React from 'react';
import { CreateEventWizard } from '../superadmin/CreateEventWizard';

interface EventFormProps {
  editEventId?: string | null;
  onComplete: () => void;
  onCancel: () => void;
}

export const EventForm: React.FC<EventFormProps> = ({ editEventId, onComplete, onCancel }) => {
  return (
    <CreateEventWizard
      editEventId={editEventId}
      onComplete={onComplete}
      onCancel={onCancel}
    />
  );
};
