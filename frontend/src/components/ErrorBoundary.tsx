import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Captura errores de render para que un fallo (p. ej. datos inesperados) no
 * deje la app en blanco, sino una pantalla legible con opción de reintentar.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Error en la interfaz:", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div style={{
          maxWidth: 520, margin: "18vh auto", padding: "0 24px",
          textAlign: "center", fontFamily: "system-ui, sans-serif", color: "#c7cede",
        }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Algo ha fallado</h1>
          <p style={{ color: "#8a93a8", fontSize: 14, marginBottom: 20 }}>
            La interfaz encontró un error inesperado. Puedes recargar para intentarlo de nuevo.
          </p>
          <button
            onClick={() => location.reload()}
            style={{
              background: "#3dd6c4", color: "#0e1220", border: 0, borderRadius: 10,
              padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
          >
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
