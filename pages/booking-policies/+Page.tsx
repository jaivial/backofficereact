import React from "react";
import { usePageContext } from "vike-react/usePageContext";
import { AlertCircle, ArrowLeft, FileText } from "lucide-react";
import type { Data } from "./+data";

export default function Page() {
  const pageContext = usePageContext();
  const { policies, brandName, updatedDate, error } = pageContext.data as Data;

  if (error || !policies) {
    return (
      <div className="bo-publicPage" data-ui="booking-policies">
        <div className="bo-publicPageCard bo-publicPageCard--wide" data-slot="booking-policies-publicPageCard--wide">
          <div className="bo-publicPageAlert bo-publicPageAlert--danger" data-slot="booking-policies-publicPageAlert--danger">
            <AlertCircle size={20}>
            <span data-slot="booking-policies-cas">{error || "Error al cargar las políticas."}</span>
          </div>
          <a href="/" className="bo-publicPageBtn bo-publicPageBtn--accent" data-testid="booking-policies-back-home-error">
            <ArrowLeft size={18}>
            Volver al inicio
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="bo-publicPage" data-ui="booking-policies">
      <div className="bo-publicPageCard bo-publicPageCard--wide" data-slot="booking-policies-publicPageCard--wide">
        <div className="bo-publicPagePoliciesHeader" data-slot="booking-policies-publicPagePoliciesHeader">
          <div className="bo-publicPageIcon bo-publicPageIcon--accent" data-slot="booking-policies-publicPageIcon--accent">
            <FileText size={24}>
          </div>
          <h1 className="bo-publicPageTitle" data-slot="booking-policies-publicPageTitle">Condiciones de Reserva y Políticas</h1>
          <p className="bo-publicPageSub" data-slot="booking-policies-publicPageSub">{brandName}</p>
        </div>
        <div
          className="bo-publicPagePoliciesContent"
          data-slot="policies"
          dangerouslySetInnerHTML={{ __html: policies }}
        />
        {updatedDate && (
          <p className="bo-publicPageNote" data-slot="booking-policies-publicPageNote">Fecha de última actualización: {updatedDate}</p>
        )}
        <a href="/" className="bo-publicPageBtn bo-publicPageBtn--accent" data-testid="booking-policies-back-home">
          <ArrowLeft size={18}>
          Volver al inicio
        </a>
      </div>
    </div>
  );
}
