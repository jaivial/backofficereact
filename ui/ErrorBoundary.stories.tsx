import type { Meta, StoryObj } from "@storybook/react";
import { ErrorBoundary } from "./ErrorBoundary";
import React from "react";

const meta = {
  title: "ui/ErrorBoundary",
  component: ErrorBoundary,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof ErrorBoundary>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Component that throws an error to simulate a rendering failure */
function ProblemChild({ message }: { message?: string }) {
  throw new Error(message ?? "Something went wrong");
}

/** Component that works normally */
function WorkingChild() {
  return (
    <div data-slot="errorBoundary.stories-div" style={{ padding: "16px", background: "#f0fdf4", borderRadius: "8px" }}>
      <p data-slot="errorBoundary.stories-p" style={{ color: "#166534", margin: 0 }}>Componente funcionando correctamente</p>
    </div>
  );
}

export const DefaultErrorFallback: Story = {
  name: "Default Error Fallback",
  render: () => (
    <ErrorBoundary page="test-page">
      <ProblemChild message="Error de ejemplo en la pagina de reservas" />
    </ErrorBoundary>
  ),
};

export const WithCustomFallback: Story = {
  name: "With Custom Fallback",
  render: () => (
    <ErrorBoundary
      page="dashboard"
      fallback={
        <div data-slot="errorBoundary.stories-div"
          style={{
            padding: "32px",
            background: "#fef2f2",
            borderRadius: "12px",
            textAlign: "center",
          }}
        >
          <h3 data-slot="errorBoundary.stories-h3" style={{ color: "#dc2626", margin: "0 0 8px" }}>Error personalizado</h3>
          <p data-slot="errorBoundary.stories-p" style={{ color: "#991b1b", margin: "0 0 16px" }}>
            Este es un mensaje de error personalizado definido por el usuario.
          </p>
          <button data-testid="accion-personalizada"
            style={{
              padding: "8px 16px",
              background: "#dc2626",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Accion personalizada
          </button>
        </div>
      }
    >
      <ProblemChild />
    </ErrorBoundary>
  ),
};

export const WithPageContext: Story = {
  name: "With Page Context",
  render: () => (
    <ErrorBoundary page="reservas">
      <ProblemChild message="Error al cargar las reservas" />
    </ErrorBoundary>
  ),
};

export const WithOnErrorCallback: Story = {
  name: "With OnError Callback",
  render: () => {
    const [errorLogged, setErrorLogged] = React.useState(false);

    return (
      <div data-slot="errorBoundary.stories-div" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <p data-slot="errorBoundary.stories-p" style={{ margin: 0 }}>
          El callback onError fue llamado: <strong>{errorLogged ? "Si" : "No"}</strong>
        </p>
        <ErrorBoundary
          page="inventario"
          onError={(error, errorInfo) => {
            console.log("Error capturado:", error.message);
            console.log("Info:", errorInfo);
            setErrorLogged(true);
          }}
        >
          <ProblemChild message="Error en inventario" />
        </ErrorBoundary>
      </div>
    );
  },
};

export const WorkingState: Story = {
  name: "Working State (No Error)",
  render: () => (
    <ErrorBoundary page="productos">
      <WorkingChild />
    </ErrorBoundary>
  ),
};

export const RetryFunctionality: Story = {
  name: "Retry Functionality",
  render: () => {
    const [shouldError, setShouldError] = React.useState(true);

    return (
      <div data-slot="errorBoundary.stories-div" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <p data-slot="errorBoundary.stories-p" style={{ margin: 0 }}>
          Haga clic en "Reintentar" para restaurar el estado normal.
        </p>
        <ErrorBoundary page="usuarios">
          {shouldError ? (
            <ProblemChild message="Error que puede ser recuperado" />
          ) : (
            <WorkingChild />
          )}
        </ErrorBoundary>
        <button data-testid="forzar-error-de-nuevo"
          onClick={() => setShouldError(true)}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: "1px solid #d1d5db",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Forzar error de nuevo
        </button>
      </div>
    );
  },
};
