import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** shown in the heading, e.g. "Pricing Desk" */
  area?: string;
  /** lets the user go back to a safe place instead of reloading */
  onReset?: () => void;
}

interface State {
  error: Error | null;
  info: string | null;
}

/**
 * Catches a crash in the tree below it. Without this, one bad record blanks the whole page and
 * the operator has no idea what happened. Here they get a readable message, the technical detail
 * on demand, and a way out that does not lose the rest of the app.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Caught by ErrorBoundary:', error, info);
    this.setState({ info: info.componentStack || null });
  }

  private reset = () => {
    this.setState({ error: null, info: null });
    this.props.onReset?.();
  };

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    const area = this.props.area ? ` in ${this.props.area}` : '';
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-600">Something broke</p>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-white">
            This screen stopped working{area}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-400">
            Nothing was lost — your documents are saved. Try again, and if it keeps happening, send
            the detail below so it can be fixed.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={this.reset}
              className="rounded-xl bg-red-700 px-5 py-3 text-[11px] font-black uppercase tracking-widest text-white transition-all hover:bg-red-800 active:scale-95"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.assign('/')}
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-[11px] font-black uppercase tracking-widest text-gray-200 transition-all hover:bg-white/10"
            >
              Back to home
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-[11px] font-black uppercase tracking-widest text-gray-200 transition-all hover:bg-white/10"
            >
              Reload the page
            </button>
          </div>

          <details className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
            <summary className="cursor-pointer text-[10px] font-black uppercase tracking-widest text-gray-500">
              Technical detail
            </summary>
            <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-gray-400">
              {error.message}
              {info ? `\n${info}` : ''}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
