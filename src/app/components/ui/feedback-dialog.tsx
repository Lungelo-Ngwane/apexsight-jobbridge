"use client";

import { useCallback, useState } from "react";
import { Button } from "@/app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";

type FeedbackDialogState = {
  open: boolean;
  title: string;
  description: string;
};

const DEFAULT_STATE: FeedbackDialogState = {
  open: false,
  title: "",
  description: "",
};

export function useFeedbackDialog() {
  const [feedback, setFeedback] = useState<FeedbackDialogState>(DEFAULT_STATE);

  const showFeedback = useCallback((title: string, description: string) => {
    setFeedback({
      open: true,
      title,
      description,
    });
  }, []);

  const setOpen = useCallback((open: boolean) => {
    setFeedback((prev) => ({ ...prev, open }));
  }, []);

  return { feedback, showFeedback, setFeedbackOpen: setOpen };
}

interface FeedbackDialogProps {
  open: boolean;
  title: string;
  description: string;
  onOpenChange: (open: boolean) => void;
}

export function FeedbackDialog({ open, title, description, onOpenChange }: FeedbackDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
