// Rule (Canon s11): a 2 px ink rule that draws left to right when a region enters, then the content rises 12 px,
// over 420 ms. Pure CSS animation on mount, so nothing is hidden if script fails; under reduced motion the
// final state shows at once (base.css). With no children it is the rule alone.
import type { ReactNode } from 'react';

export function Rule({ children }: { children?: ReactNode }) {
  return (
    <div className="reveal">
      <span className="reveal-rule" aria-hidden="true" />
      {children === undefined ? null : <div className="reveal-body">{children}</div>}
    </div>
  );
}
