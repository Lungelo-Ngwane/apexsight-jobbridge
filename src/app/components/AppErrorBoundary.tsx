import { Component,type ReactNode } from "react";
export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="mx-auto max-w-lg p-8" role="alert">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="my-4">Please reload the page to try again.</p>
      <button type="button" onClick={() => window.location.reload()} className="rounded border p-3">Reload page</button>
    </main>;
    return this.props.children;
  }
}
