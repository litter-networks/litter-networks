import { Component, type ErrorInfo, type ReactNode } from 'react';
import styles from './ErrorBoundary.module.css';

type Props = {
  name: string;
  children: ReactNode;
};

type State = {
  hasError: boolean;
  message?: string;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.name}]`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className={styles.errorBoundary}>
          <span className={styles.title}>{this.props.name} failed to load.</span>
          <span className={styles.message}>{this.state.message ?? 'See console for details.'}</span>
        </div>
      );
    }
    return this.props.children;
  }
}
