// Captura errores de render de todo el árbol para evitar una pantalla en blanco.

import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Aquí se enviaría a un servicio de monitoreo (Sentry, etc.).
    console.error('Error no controlado en la UI:', error, info)
  }

  private handleReload = () => {
    window.location.assign('/')
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            textAlign: 'center',
            padding: '2rem 1rem',
          }}
        >
          <h1 style={{ margin: 0 }}>Algo salió mal</h1>
          <p style={{ color: '#888', margin: 0 }}>
            Ocurrió un error inesperado. Intenta recargar la aplicación.
          </p>
          <button onClick={this.handleReload}>Volver al inicio</button>
        </main>
      )
    }
    return this.props.children
  }
}
