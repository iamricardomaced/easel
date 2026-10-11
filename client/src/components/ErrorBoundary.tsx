import { Component, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="max-w-md text-sm text-gray-600">{this.state.error.message}</p>
        <p className="text-xs text-gray-400">Your last autosave is safe. Reload to continue.</p>
        <button className="rounded-lg bg-[#8b3dff] px-4 py-2 text-sm font-semibold text-white" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
