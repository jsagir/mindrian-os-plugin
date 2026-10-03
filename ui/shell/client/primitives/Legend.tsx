// Legend (UI-SPEC Five-Square State Language): the one line under every list that shows tile marks, with the
// real marks drawn inline. Its marks carry no data-tile: each is paired with its words in the same item.
const ITEMS: Array<{ tone: 'blue' | 'red' | 'yellow' | 'black' | 'white'; words: string }> = [
  { tone: 'blue', words: 'Proposed' },
  { tone: 'red', words: 'Challenged or fixed' },
  { tone: 'yellow', words: 'Contradiction' },
  { tone: 'black', words: 'Decision' },
  { tone: 'white', words: 'Empty or delivered' },
];

export function Legend() {
  return (
    <ul className="legend" aria-label="Legend">
      {ITEMS.map((item) => (
        <li className="legend-item" key={item.tone}>
          <span className="tile-mark" data-tone={item.tone} aria-hidden="true" />
          {item.words}
        </li>
      ))}
    </ul>
  );
}
