import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

export default function VisitDateDialog({ open, title, description, onConfirm, onClose }) {
  const [date, setDate] = useState(undefined);

  useEffect(() => {
    if (open) setDate(undefined);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="flex justify-center">
          <Calendar mode="single" selected={date} onSelect={setDate} locale={pl} className="rounded-md border" />
        </div>
        <DialogFooter>
          <Button disabled={!date} onClick={() => onConfirm(format(date, 'yyyy-MM-dd'))}>Zapisz</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}