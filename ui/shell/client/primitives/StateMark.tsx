// StateMark (369-UI-SPEC Component Inventory): a 12 px shape. Square is rust, circle is cobalt (the one
// element in the shell allowed a non-zero radius, drawn by base.css), triangle is ochre with a 1 px ink
// outline on paper and plain on ink, empty is paper-light with a 1 px ink border, line is the ochre
// progress line the saving button shows. Always aria-hidden: meaning lives in the words beside it.
export type MarkShape = 'square' | 'circle' | 'triangle' | 'empty' | 'line';
export type MarkSurface = 'paper' | 'ink';

export function StateMark({ shape, surface = 'paper' }: { shape: MarkShape; surface?: MarkSurface }) {
  return (
    <span className="sm" data-mark={shape} data-surface={surface === 'ink' ? 'ink' : undefined} aria-hidden="true">
      {shape === 'triangle' ? (
        <svg className="sm-tri" viewBox="0 0 15 18" focusable="false">
          <polygon points="0.5,0.5 14.5,9 0.5,17.5" />
        </svg>
      ) : null}
    </span>
  );
}
