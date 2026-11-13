import { Component, type ReactNode } from 'react';
/** A failed renderer must never take the customer's controls or choices with it. */
export class PreviewBoundary extends Component<{children: ReactNode; route?: boolean}, {failed: boolean}> {
  state = {failed: false};
  static getDerivedStateFromError() { return {failed: true}; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="preview-error" role="alert"><h2>Preview unavailable</h2><p>The interactive model couldn’t load. Your ring options are retained while this page stays open.</p>{this.props.route ? <a href="#">Return to Terra Ring</a> : <button className="btn-secondary" onClick={() => this.setState({failed:false})}>Retry preview</button>}</div>;
  }
}
