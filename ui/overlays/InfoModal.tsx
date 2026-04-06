import React from "react";
import { Modal } from "./Modal";
import { Button } from "../actions/Button";

type InfoModalProps = {
  open: boolean;
  title: string;
  content: string;
  onClose: () => void;
  className?: string;
};

export function InfoModal({ open, title, content, onClose, className }: InfoModalProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      size="sm"
      className={className}
    >
      <div className="bo-modal-body" data-ui="info-modal-content">
        <p className="text-(--bo-text) text-sm leading-relaxed" data-ui="info-modal-text">
          {content}
        </p>
      </div>
      <div className="bo-modal-actions" data-ui="info-modal-actions">
        <Button onClick={onClose} data-ui="info-modal-close-btn">
          Cerrar
        </Button>
      </div>
    </Modal>
  );
}
