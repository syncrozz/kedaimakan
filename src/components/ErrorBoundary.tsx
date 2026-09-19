import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Shield } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
  }

  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleGoAdmin = () => {
    window.location.href = '/admin';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6 font-sans">
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 max-w-lg w-full p-8 text-center">
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold text-stone-900 mb-2">Ralat Paparan Aplikasi</h1>
            <p className="text-sm text-stone-600 mb-6 leading-relaxed">
              Sistem mendapati ralat semasa memuatkan komponen halaman ini. Sila muat semula atau kembali ke halaman utama.
            </p>
            {this.state.error?.message && (
              <div className="mb-6 p-3 bg-stone-100 rounded-lg text-left text-xs font-mono text-stone-700 overflow-x-auto border border-stone-200">
                {this.state.error.message}
              </div>
            )}
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-stone-900 text-white text-sm font-semibold rounded-xl hover:bg-stone-800 transition cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-4 h-4" />
                Muat Semula
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-stone-300 text-stone-700 text-sm font-semibold rounded-xl hover:bg-stone-100 transition cursor-pointer shadow-xs"
              >
                <Home className="w-4 h-4" />
                Laman Utama
              </button>
              <button
                type="button"
                onClick={this.handleGoAdmin}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-stone-300 text-stone-700 text-sm font-semibold rounded-xl hover:bg-stone-100 transition cursor-pointer shadow-xs"
              >
                <Shield className="w-4 h-4" />
                Konsol Admin
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
