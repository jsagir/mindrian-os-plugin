import { expect, test } from 'claude-code/testing'

import { loadFaceAsset, rasterFace } from '../hooks/theo-face'
import { ASSET_TEXT } from './face-fixture'

// Phase 380 plan 12 (D-10, MOD380-09, G4): sha256 pins of the canon Theo faces, 11 states at
// the sizes 6, 8, 12 and 16 (44 pins), taken from the new source (hooks/theo-face.ts drawing the
// copied canon asset) after its first green run. These pins are never edited. They replace, for the
// canon faces, the old plan 380-02 pins of the older drawing (those stay in raster-pin.test.ts
// until plan 380-13 swaps the panel; the change is a deliberate visual change, not a refactor).
// Hash input: the JSON text of the grid.

const SIZES = [6, 8, 12, 16]

const PIN: Record<string, string> = {
  'face:rest:6': 'c37ce6f030b8b416c4f510728df499c4300c17fdc7ce7e99f20b4154d8187cf9',
  'face:rest:8': '19e23bf3c316f38c7f7d80c81710ceb87d51d88805f0993261220030299db52a',
  'face:rest:12': '69cf674a08cbc2acf312f97113734b90ae2c1ade769037878b300ea3e9bdc362',
  'face:rest:16': '958795c70668193530a1cae0b5777bfef05807b4eb9bddb05054342ef8e5d263',
  'face:listen:6': 'bf8beda6adbaf5476818e5a4b3b129576efcf01a753f700e0c3a61710592bd8e',
  'face:listen:8': '1b503ad6424f72fa3c9dd7fc18ed0e3a5b4a12c04ca1be148f45da0af8214645',
  'face:listen:12': '3aa2cb181003604a59e0e7acf5d8e7fc525a657a448fe07c431d6c4a8f384cd9',
  'face:listen:16': 'ece3aad9d8f3761028356a3e10d6723a8b82643ce0a06675e7cbec2007562d03',
  'face:search:6': 'bcb2919eed9807c45b8cdce559fac7af7472316d5a1f2ccb806dcab83f1bcc15',
  'face:search:8': '7d8f32aa375bbb15e2b3b411b820f79cfa6ce2cf27fbc5700d7a6f6b62f2675c',
  'face:search:12': 'e858bbdc2c3f51d8a0cae6b39c644d0ce1cb2a1a4ac7780bd8dc71d2a5b0dcbb',
  'face:search:16': 'a59bc10ff9396d3aea78093ad387c214dd5ebb69f603514df29d9316e43abdca',
  'face:found:6': '76779cec7b7972bb06596bfe92829a0fb9c48118a85301d0dd0000809228f689',
  'face:found:8': '4c63f71795d3779fba6505bc36ab59f84cca9df757384d502b5a2d30756c1263',
  'face:found:12': '4e7843c5279c163f8439d3bdba540cf9d63aa9fce10e595897a0a907681ab112',
  'face:found:16': '13d6d9b37b37f4e68ab0e9944de8de6ab206e584bc079f7739056b35e4dd2d9b',
  'face:challenge:6': 'dec798333fd2faa315ae38f61b171c68b1bcf1fc2e0abe69ad7ed072e9fbeb5f',
  'face:challenge:8': '5ffea011a42488e578a81d94b75d0b6745076bb2f5af715ebc51c0b442931100',
  'face:challenge:12': '97a15ea4ded27319fef6f38869b40fc5f433ab16d4585bd69c16a7eda7b08436',
  'face:challenge:16': '36b46e34501ccfb6c80eed887c2e1966b028d7458e92aa9a500a6e3c6bd18046',
  'face:contradiction:6': '19208eff9cac7f35a46efdd6a0a3d0f8ed5eae5c66533757420cc5e9eab58de2',
  'face:contradiction:8': '954910dc72b2eb907877e49126ca1c746fbd52848fc1643479092a84286810f3',
  'face:contradiction:12': 'bd6a1bed7a34c0384123ae0b4f23a73fa211981ac62fc00bdae24d3df416ef44',
  'face:contradiction:16': '909a642af42ba2b55130845f9627a9acb31afbf7ac15e44ce9a4f0f6e24b562c',
  'face:reframe:6': '33d26e62090acdd5c4ed479956e4cffbf3f983be963f08587d7f63fd91a3f402',
  'face:reframe:8': 'eff75a06b155a52e15f6e16728652c9043bf695159925ecc1645f5557f953989',
  'face:reframe:12': '88db7f9625065aa0b82af5fff5262e05099edc753c6b3855bcb309d09fed1f3b',
  'face:reframe:16': '3897537ccd29b8174ee3081f7ea56d9b9694b03149790c2a246c4d36e0095082',
  'face:limit:6': '3f68d1a3bbe60c5563c713cb45e6bcd5bcf06bcee140ffa631d9051cae56ad31',
  'face:limit:8': '6b7e1c7168ad7ae30417b6fb3adb10534626f1b05906cca0d9031cf0663d7275',
  'face:limit:12': '81960482ab464952845b364e2d2a93cf829c1bafb4ffd1c6a30eb9f5c316e236',
  'face:limit:16': 'b3a2e0fb5a73cf1d707656e7399dcb39aa29bd74aaf9a38683d1d9a0ab181e62',
  'face:decision:6': '71f087e08954b844a39f5e0a7d108491011da8c800ceca9c6f2a0e64f72baf99',
  'face:decision:8': '980d349600c6ef472639fecbec05d378b1a25863ad80468663f1ff5677d39782',
  'face:decision:12': '787774aa3efd32c5c61a050d8c2456a42e8f20b6c77626550398c3deaa28be8c',
  'face:decision:16': '10f72d84de587729f78e9ef9df480dcbe04074c0b73a678a67fb963000b9cf61',
  'face:boundary:6': 'a0441198e73bfd0c205796edce922ba3cb6167a41017240735743d53a0cdc71b',
  'face:boundary:8': '930cafbda617f1e144ffb9e83b88da1d2ea649ebfe46523f64e58fb7b82fd4d9',
  'face:boundary:12': '466e93d924353b1fbf7f2406d0cf33920e4c567882176733e933dfb71ce49346',
  'face:boundary:16': '7e70a1e48d8de9a2f750ed1a3fecf3b825e75a421df5389c9f6cc589f84ad51e',
  'face:handover:6': '2443b9fac934d876c5b0f800f82e9201a76433803d088f1dff3fc0433ccce6df',
  'face:handover:8': '0111cc34c9fc292f5b0f664d1a5c9db1c7c60a975d6418f8e4c033d6d0965308',
  'face:handover:12': '09825dbb5fb0cf3f251ecb9bd851ad8c35535bf6c02ada18e45f1523db7ca3b1',
  'face:handover:16': '2e165d0b2ed563d6658199959664800116537f09a3e01e7510a1c050d32d5515',
}

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)

  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
}

test('G4 pins: every canon state at every size draws the pixels pinned in plan 380-12', async () => {
  const asset = loadFaceAsset(ASSET_TEXT)
  expect(asset).not.toBeNull()
  const bad: string[] = []
  let total = 0
  for (const one of asset?.states ?? []) {
    for (const n of SIZES) {
      total += 1
      const key = `face:${one.id}:${n}`
      const got = await sha256(JSON.stringify(rasterFace(asset as never, one.id, n)))
      if (PIN[key] !== got) bad.push(`${key} got ${got} want ${PIN[key] ?? 'none'}`)
    }
  }
  expect(total).toBe(44)
  expect(Object.keys(PIN).length).toBe(44)
  expect(bad).toEqual([])
})
