// TileMark (D-11, deliverable 14): one of the five Larry squares followed by its written status. A tile
// never carries a state alone: `status` is required by the type and refused at run time. An empty status
// throws in development and renders nothing in production, so a bare coloured square can never reach a
// person. `data-tile` sits on the wrapper, whose accessible name is the status text (the mark is aria-hidden).
export type Tile = 'blue' | 'red' | 'yellow' | 'black' | 'white';

export type TileMarkProps = {
  tile: Tile;
  status: string;
};

export function TileMark({ tile, status }: TileMarkProps) {
  const words = typeof status === 'string' ? status.trim() : '';
  if (words === '') {
    if (process.env.NODE_ENV !== 'production') {
      throw new Error('TileMark: a tile never renders without its written status (D-11)');
    }
    return null;
  }
  return (
    <span className="tile" data-tile={tile}>
      <span className="tile-mark" data-tone={tile} aria-hidden="true" />
      <span className="tile-status">{words}</span>
    </span>
  );
}
