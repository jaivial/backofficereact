import React, { useCallback, useEffect, useState } from "react";
import { MessageSquare, Send, Edit2, Trash2, X, Clock, User } from "lucide-react";
import { useToasts } from "../../../../ui/feedback/useToasts";
import type { InvoiceComment, InvoiceCommentInput, InvoiceCommentUpdateInput } from "../../../../api/types";
import { createClient } from "../../../../api/client";

type CommentsPanelProps = {
  invoiceId: number;
  currentUserId: number;
  api?: ReturnType<typeof createClient>;
};

export function CommentsPanel({ invoiceId, currentUserId, api }: CommentsPanelProps) {
  const { pushToast } = useToasts();
  const [comments, setComments] = useState<InvoiceComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [showAllComments, setShowAllComments] = useState(false);

  // Use provided API or create a new one
  const client = api || createClient({ baseUrl: "" });

  // Fetch comments on mount
  useEffect(() => {
    if (!invoiceId) return;

    const fetchComments = async () => {
      setLoading(true);
      try {
        const res = await client.invoices.getComments(invoiceId);
        if (res.success) {
          setComments(res.comments || []);
        } else {
          pushToast({
            kind: "error",
            title: "Error",
            message: "No se pudieron cargar los comentarios",
          });
        }
      } catch (err) {
        pushToast({
          kind: "error",
          title: "Error",
          message: err instanceof Error ? err.message : "Error desconocido",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchComments();
  }, [invoiceId, client, pushToast]);

  // Handle add new comment
  const handleAddComment = useCallback(async () => {
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    try {
      const input: InvoiceCommentInput = { content: newComment.trim() };
      const res = await client.invoices.addComment(invoiceId, input);

      if (res.success && res.comment) {
        setComments((prev) => [res.comment!, ...prev]);
        setNewComment("");
        pushToast({
          kind: "success",
          title: "Comentario añadido",
          message: "El comentario se ha añadido correctamente",
        });
      } else {
        pushToast({
          kind: "error",
          title: "Error",
          message: res.message || "No se pudo añadir el comentario",
        });
      }
    } catch (err) {
      pushToast({
        kind: "error",
        title: "Error",
        message: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setSubmitting(false);
    }
  }, [newComment, submitting, client, invoiceId, pushToast]);

  // Handle start editing
  const handleStartEdit = useCallback((comment: InvoiceComment) => {
    setEditingCommentId(comment.id);
    setEditContent(comment.content);
  }, []);

  // Handle cancel editing
  const handleCancelEdit = useCallback(() => {
    setEditingCommentId(null);
    setEditContent("");
  }, []);

  // Handle save edit
  const handleSaveEdit = useCallback(async (commentId: number) => {
    if (!editContent.trim() || submitting) return;

    setSubmitting(true);
    try {
      const input: InvoiceCommentUpdateInput = { content: editContent.trim() };
      const res = await client.invoices.updateComment(invoiceId, commentId, input);

      if (res.success && res.comment) {
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? res.comment! : c))
        );
        setEditingCommentId(null);
        setEditContent("");
        pushToast({
          kind: "success",
          title: "Comentario actualizado",
          message: "El comentario se ha actualizado correctamente",
        });
      } else {
        pushToast({
          kind: "error",
          title: "Error",
          message: res.message || "No se pudo actualizar el comentario",
        });
      }
    } catch (err) {
      pushToast({
        kind: "error",
        title: "Error",
        message: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setSubmitting(false);
    }
  }, [editContent, submitting, client, invoiceId, pushToast]);

  // Handle delete comment
  const handleDeleteComment = useCallback(async (commentId: number) => {
    if (!window.confirm("¿Estás seguro de que quieres eliminar este comentario?")) {
      return;
    }

    setSubmitting(true);
    try {
      const res = await client.invoices.deleteComment(invoiceId, commentId);

      if (res.success) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        pushToast({
          kind: "success",
          title: "Comentario eliminado",
          message: "El comentario se ha eliminado correctamente",
        });
      } else {
        pushToast({
          kind: "error",
          title: "Error",
          message: res.message || "No se pudo eliminar el comentario",
        });
      }
    } catch (err) {
      pushToast({
        kind: "error",
        title: "Error",
        message: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setSubmitting(false);
    }
  }, [client, invoiceId, pushToast]);

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Hace un momento";
    if (diffMins < 60) return `Hace ${diffMins} minuto${diffMins > 1 ? "s" : ""}`;
    if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? "s" : ""}`;
    if (diffDays < 7) return `Hace ${diffDays} día${diffDays > 1 ? "s" : ""}`;

    return date.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Check if user can edit/delete a comment (their own comments)
  const canModify = (comment: InvoiceComment) => comment.user_id === currentUserId;

  // Displayed comments (show max 5 initially)
  const displayedComments = showAllComments ? comments : comments.slice(0, 5);
  const hasMoreComments = comments.length > 5;

  return (
    <div className="bo-commentsPanel">
      <div className="bo-commentsPanelHeader">
        <h3 className="bo-commentsPanelTitle">
          <MessageSquare size={18} />
          Comentarios
          {comments.length > 0 && (
            <span className="bo-commentsPanelCount">({comments.length})</span>
          )}
        </h3>
        <p className="bo-commentsPanelSubtitle">
          Los comentarios son internos y no se incluyen en el PDF
        </p>
      </div>

      {/* Add new comment form */}
      <div className="bo-commentsPanelAdd">
        <div className="bo-commentsPanelAddForm">
          <textarea
            className="bo-textarea bo-commentsPanelTextarea"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Añadir un comentario..."
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                handleAddComment();
              }
            }}
          />
          <button
            type="button"
            className="bo-btn bo-btn--primary bo-btn--sm bo-commentsPanelSubmit"
            onClick={handleAddComment}
            disabled={!newComment.trim() || submitting}
          >
            <Send size={14} />
            Comentar
          </button>
        </div>
      </div>

      {/* Comments list */}
      <div className="bo-commentsPanelList">
        {loading ? (
          <div className="bo-commentsPanelEmpty">
            <p>Cargando comentarios...</p>
          </div>
        ) : comments.length === 0 ? (
          <div className="bo-commentsPanelEmpty">
            <MessageSquare size={24} className="bo-commentsPanelEmptyIcon" />
            <p>No hay comentarios todavía</p>
            <p className="bo-mutedText">Sé el primero en añadir un comentario</p>
          </div>
        ) : (
          <>
            {displayedComments.map((comment) => (
              <div key={comment.id} className="bo-commentItem">
                {editingCommentId === comment.id ? (
                  // Editing mode
                  <div className="bo-commentEdit">
                    <textarea
                      className="bo-textarea bo-commentEditTextarea"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={2}
                    />
                    <div className="bo-commentEditActions">
                      <button
                        type="button"
                        className="bo-btn bo-btn--ghost bo-btn--sm"
                        onClick={handleCancelEdit}
                        disabled={submitting}
                      >
                        <X size={14} />
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="bo-btn bo-btn--primary bo-btn--sm"
                        onClick={() => handleSaveEdit(comment.id)}
                        disabled={!editContent.trim() || submitting}
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  // Display mode
                  <>
                    <div className="bo-commentHeader">
                      <div className="bo-commentAuthor">
                        <User size={14} />
                        <span className="bo-commentAuthorName">{comment.user_name}</span>
                      </div>
                      <div className="bo-commentDate">
                        <Clock size={12} />
                        <span>{formatDate(comment.created_at)}</span>
                        {comment.updated_at && (
                          <span className="bo-commentEdited">(editado)</span>
                        )}
                      </div>
                    </div>
                    <div className="bo-commentContent">{comment.content}</div>
                    {canModify(comment) && (
                      <div className="bo-commentActions">
                        <button
                          type="button"
                          className="bo-btn bo-btn--ghost bo-btn--sm"
                          onClick={() => handleStartEdit(comment)}
                          title="Editar comentario"
                        >
                          <Edit2 size={14} />
                          Editar
                        </button>
                        <button
                          type="button"
                          className="bo-btn bo-btn--ghost bo-btn--sm bo-btn--danger"
                          onClick={() => handleDeleteComment(comment.id)}
                          title="Eliminar comentario"
                        >
                          <Trash2 size={14} />
                          Eliminar
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}

            {hasMoreComments && !showAllComments && (
              <button
                type="button"
                className="bo-btn bo-btn--ghost bo-btn--sm bo-commentsPanelShowMore"
                onClick={() => setShowAllComments(true)}
              >
                Ver {comments.length - 5} comentarios más
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
