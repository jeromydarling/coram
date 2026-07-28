/**
 * NarrativeErrorBoundary — Graceful error boundary for overlay layers.
 *
 * WHAT: Catches render errors in children and shows a calm fallback.
 * WHERE: Wrapping Compass, Providence, Restoration overlays in GardenPulsePage.
 * WHY: Prevents a single broken overlay from crashing the entire ecosystem view.
 */
import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** Name shown in console for debugging */
  layerName?: string;
}

interface State {
  hasError: boolean;
}

export class NarrativeErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn(
      `[CROS] ${this.props.layerName ?? 'Overlay'} layer encountered an error and was silenced:`,
      error.message,
    );
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
