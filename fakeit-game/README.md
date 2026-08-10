# Find the Impostor 🎭

A free, offline party game of bluffing and deduction. Pass one device around a
group: everyone gets a secret word except the **impostor**, who has to fake it.
Give hints, argue, vote, and try to catch the faker.

An original browser remake of the classic social-deduction party game.

## How to play (fastest way)

1. Double-click **`play.html`** — it opens in your web browser. No install, no
   internet needed after it loads.
2. Tap **Play Now**.
3. Add 3-12 players, pick a word pack, choose 1 or 2 impostors.
4. Pass the device around: each player taps their card to see the secret word.
   One player instead sees "You're the Impostor."
5. Take turns giving one-word hints. The impostor bluffs.
6. Vote for who you think is faking, then reveal.
   - Catch an impostor -> **Crew wins**.
   - Impostor slips past -> **Impostor wins**.

## What's in this folder

| File | What it is |
|------|-----------|
| `play.html` | The whole game in one file. This is all you need to play. |
| `index.html` | Same game, but split across files (loads `words.js` + `game.js`). |
| `words.js` | The word packs (11 categories, ~200 words). |
| `game.js` | The game logic. |

To play, just open `play.html`. The other files are the editable source.

## Sharing it

- **Send the file:** WhatsApp / email `play.html` to someone; they double-click
  to play.
- **Host it:** drop these files on any static host (GitHub Pages, Netlify) and
  share the link.

## Tips

- Works great on a phone browser too - open `play.html` from your phone.
- Player names are remembered on the same device for next time.
- Try the **Spicy** pack for older players, or **Animals**/**Food** for kids.

Made for game nights. Have fun finding the impostor.
