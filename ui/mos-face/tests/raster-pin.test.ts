import { expect, test } from 'claude-code/testing'

import { CREW, POSES, rasterCrew, rasterState } from '../hooks/face'
import { contextCanvas } from '../hooks/meter'

// Phase 380 plan 02 (T-380-04): sha256 pins of every drawn pixel grid, taken from the source
// BEFORE the type fix. A type fix must not change one pixel. These pins are never edited,
// with one recorded exception: the 84 state pins (R1) were taken again in plan 380-07, because
// the poses became the canon poses (mos-brand book e947a5d, identity/theo asset
// asset-fa8504998f.json) and the old poses were an older copy. The crew pins (R2) and the canvas
// pins (R3) are the original ones. The rest of this file is unchanged.
// Hash input: the JSON text of the raster output.

const SIZES = [8, 12, 16]
const TICKS = [0, 1, 2, 3]
const PERCENTS = [0, 1, 17, 50, 62, 80, 99, 100]

const PIN: Record<string, string> = {
  'state:found:0:8': '4c63f71795d3779fba6505bc36ab59f84cca9df757384d502b5a2d30756c1263',
  'state:found:0:12': '4e7843c5279c163f8439d3bdba540cf9d63aa9fce10e595897a0a907681ab112',
  'state:found:0:16': '4fc5f516f0cd9ac8272b015407ae613983995ece49bd3def3917733dd616e932',
  'state:found:1:8': '4c63f71795d3779fba6505bc36ab59f84cca9df757384d502b5a2d30756c1263',
  'state:found:1:12': '4e7843c5279c163f8439d3bdba540cf9d63aa9fce10e595897a0a907681ab112',
  'state:found:1:16': '4fc5f516f0cd9ac8272b015407ae613983995ece49bd3def3917733dd616e932',
  'state:found:2:8': '4c63f71795d3779fba6505bc36ab59f84cca9df757384d502b5a2d30756c1263',
  'state:found:2:12': '4e7843c5279c163f8439d3bdba540cf9d63aa9fce10e595897a0a907681ab112',
  'state:found:2:16': '4fc5f516f0cd9ac8272b015407ae613983995ece49bd3def3917733dd616e932',
  'state:found:3:8': '4c63f71795d3779fba6505bc36ab59f84cca9df757384d502b5a2d30756c1263',
  'state:found:3:12': '4e7843c5279c163f8439d3bdba540cf9d63aa9fce10e595897a0a907681ab112',
  'state:found:3:16': '4fc5f516f0cd9ac8272b015407ae613983995ece49bd3def3917733dd616e932',
  'state:handover:0:8': '27d14afefaf0694363df9b6d0da72d0df8a3b554c27f213d6d44dee35f8a063c',
  'state:handover:0:12': '9f82c8faa61bc266d514e19eaef67c1fa2c72a244f09ccd72097fd3c8caad6d7',
  'state:handover:0:16': 'd13c78720044bfda5d9ba6944b25aa9e0bc60d34198c51cfc011fb74ddb0590f',
  'state:handover:1:8': '27d14afefaf0694363df9b6d0da72d0df8a3b554c27f213d6d44dee35f8a063c',
  'state:handover:1:12': '9f82c8faa61bc266d514e19eaef67c1fa2c72a244f09ccd72097fd3c8caad6d7',
  'state:handover:1:16': 'd13c78720044bfda5d9ba6944b25aa9e0bc60d34198c51cfc011fb74ddb0590f',
  'state:handover:2:8': '27d14afefaf0694363df9b6d0da72d0df8a3b554c27f213d6d44dee35f8a063c',
  'state:handover:2:12': '9f82c8faa61bc266d514e19eaef67c1fa2c72a244f09ccd72097fd3c8caad6d7',
  'state:handover:2:16': 'd13c78720044bfda5d9ba6944b25aa9e0bc60d34198c51cfc011fb74ddb0590f',
  'state:handover:3:8': '27d14afefaf0694363df9b6d0da72d0df8a3b554c27f213d6d44dee35f8a063c',
  'state:handover:3:12': '9f82c8faa61bc266d514e19eaef67c1fa2c72a244f09ccd72097fd3c8caad6d7',
  'state:handover:3:16': 'd13c78720044bfda5d9ba6944b25aa9e0bc60d34198c51cfc011fb74ddb0590f',
  'state:listen:0:8': '1b503ad6424f72fa3c9dd7fc18ed0e3a5b4a12c04ca1be148f45da0af8214645',
  'state:listen:0:12': '3aa2cb181003604a59e0e7acf5d8e7fc525a657a448fe07c431d6c4a8f384cd9',
  'state:listen:0:16': '09384b6b70fe62b6552b05d1130d7c48aa9d6afd664314fa8872bfaeb1fe797e',
  'state:listen:1:8': '1b503ad6424f72fa3c9dd7fc18ed0e3a5b4a12c04ca1be148f45da0af8214645',
  'state:listen:1:12': '3aa2cb181003604a59e0e7acf5d8e7fc525a657a448fe07c431d6c4a8f384cd9',
  'state:listen:1:16': '09384b6b70fe62b6552b05d1130d7c48aa9d6afd664314fa8872bfaeb1fe797e',
  'state:listen:2:8': '1b503ad6424f72fa3c9dd7fc18ed0e3a5b4a12c04ca1be148f45da0af8214645',
  'state:listen:2:12': '3aa2cb181003604a59e0e7acf5d8e7fc525a657a448fe07c431d6c4a8f384cd9',
  'state:listen:2:16': '09384b6b70fe62b6552b05d1130d7c48aa9d6afd664314fa8872bfaeb1fe797e',
  'state:listen:3:8': '1b503ad6424f72fa3c9dd7fc18ed0e3a5b4a12c04ca1be148f45da0af8214645',
  'state:listen:3:12': '3aa2cb181003604a59e0e7acf5d8e7fc525a657a448fe07c431d6c4a8f384cd9',
  'state:listen:3:16': '09384b6b70fe62b6552b05d1130d7c48aa9d6afd664314fa8872bfaeb1fe797e',
  'state:none:0:8': 'cab92989059b81f03de0a1078cad37aefa4708b8e406d4c21dc6e5c3612ac651',
  'state:none:0:12': '81960482ab464952845b364e2d2a93cf829c1bafb4ffd1c6a30eb9f5c316e236',
  'state:none:0:16': '30154b8dd84182e9708e3908094b3e9bdbc21bd1bef6db19e08c85ba3f9231fa',
  'state:none:1:8': 'cab92989059b81f03de0a1078cad37aefa4708b8e406d4c21dc6e5c3612ac651',
  'state:none:1:12': '81960482ab464952845b364e2d2a93cf829c1bafb4ffd1c6a30eb9f5c316e236',
  'state:none:1:16': '30154b8dd84182e9708e3908094b3e9bdbc21bd1bef6db19e08c85ba3f9231fa',
  'state:none:2:8': 'cab92989059b81f03de0a1078cad37aefa4708b8e406d4c21dc6e5c3612ac651',
  'state:none:2:12': '81960482ab464952845b364e2d2a93cf829c1bafb4ffd1c6a30eb9f5c316e236',
  'state:none:2:16': '30154b8dd84182e9708e3908094b3e9bdbc21bd1bef6db19e08c85ba3f9231fa',
  'state:none:3:8': 'cab92989059b81f03de0a1078cad37aefa4708b8e406d4c21dc6e5c3612ac651',
  'state:none:3:12': '81960482ab464952845b364e2d2a93cf829c1bafb4ffd1c6a30eb9f5c316e236',
  'state:none:3:16': '30154b8dd84182e9708e3908094b3e9bdbc21bd1bef6db19e08c85ba3f9231fa',
  'state:refused:0:8': '50faea56832febdd6a45eef6508a7ca9acc66f2c8b5782b61d7d3328437d4bd1',
  'state:refused:0:12': '7c4c98c01abfc1b04b0789fe28ec19767b4f77976fa1db1dfe93fce5ee8b33b3',
  'state:refused:0:16': '1655d01ad548d5054a1bc6df1041d773df0d1ca39b1c1930a50f3a276e7763c0',
  'state:refused:1:8': '50faea56832febdd6a45eef6508a7ca9acc66f2c8b5782b61d7d3328437d4bd1',
  'state:refused:1:12': '7c4c98c01abfc1b04b0789fe28ec19767b4f77976fa1db1dfe93fce5ee8b33b3',
  'state:refused:1:16': '1655d01ad548d5054a1bc6df1041d773df0d1ca39b1c1930a50f3a276e7763c0',
  'state:refused:2:8': '50faea56832febdd6a45eef6508a7ca9acc66f2c8b5782b61d7d3328437d4bd1',
  'state:refused:2:12': '7c4c98c01abfc1b04b0789fe28ec19767b4f77976fa1db1dfe93fce5ee8b33b3',
  'state:refused:2:16': '1655d01ad548d5054a1bc6df1041d773df0d1ca39b1c1930a50f3a276e7763c0',
  'state:refused:3:8': '50faea56832febdd6a45eef6508a7ca9acc66f2c8b5782b61d7d3328437d4bd1',
  'state:refused:3:12': '7c4c98c01abfc1b04b0789fe28ec19767b4f77976fa1db1dfe93fce5ee8b33b3',
  'state:refused:3:16': '1655d01ad548d5054a1bc6df1041d773df0d1ca39b1c1930a50f3a276e7763c0',
  'state:rest:0:8': '19e23bf3c316f38c7f7d80c81710ceb87d51d88805f0993261220030299db52a',
  'state:rest:0:12': '69cf674a08cbc2acf312f97113734b90ae2c1ade769037878b300ea3e9bdc362',
  'state:rest:0:16': '6c21480bc83278f1862a2a787f205cc9943bab829ef5b5e8d126551ceef8dfb4',
  'state:rest:1:8': '19e23bf3c316f38c7f7d80c81710ceb87d51d88805f0993261220030299db52a',
  'state:rest:1:12': '69cf674a08cbc2acf312f97113734b90ae2c1ade769037878b300ea3e9bdc362',
  'state:rest:1:16': '6c21480bc83278f1862a2a787f205cc9943bab829ef5b5e8d126551ceef8dfb4',
  'state:rest:2:8': '19e23bf3c316f38c7f7d80c81710ceb87d51d88805f0993261220030299db52a',
  'state:rest:2:12': '69cf674a08cbc2acf312f97113734b90ae2c1ade769037878b300ea3e9bdc362',
  'state:rest:2:16': '6c21480bc83278f1862a2a787f205cc9943bab829ef5b5e8d126551ceef8dfb4',
  'state:rest:3:8': '19e23bf3c316f38c7f7d80c81710ceb87d51d88805f0993261220030299db52a',
  'state:rest:3:12': '69cf674a08cbc2acf312f97113734b90ae2c1ade769037878b300ea3e9bdc362',
  'state:rest:3:16': '6c21480bc83278f1862a2a787f205cc9943bab829ef5b5e8d126551ceef8dfb4',
  'state:search:0:8': '67d16168ea886143280a1a6228f879f288097634c4a9321f72e2351bdc1d9150',
  'state:search:0:12': '8ec61b2bf53fd1eebd891f1fd146c58dbbb8c37a722633c9c1b6b5e7da506feb',
  'state:search:0:16': '5ffe842dc1d3848f3b03968afff98224a70a5360cf4229ea061b862b6783859c',
  'state:search:1:8': '67d16168ea886143280a1a6228f879f288097634c4a9321f72e2351bdc1d9150',
  'state:search:1:12': '8dea8162c9940cb0077b80a446864f32fb31de878a57959261ce830fa7c2e526',
  'state:search:1:16': '8ad80a8b35918f181886f524cf7325a3e93f59f0ca558c1b524934c08c115af4',
  'state:search:2:8': '72c8377921f516cefa9382a0edae8bee96f2dabd801e1248d3b7637da72d8845',
  'state:search:2:12': '8dea8162c9940cb0077b80a446864f32fb31de878a57959261ce830fa7c2e526',
  'state:search:2:16': '5cee561c9a9bb94e78cd781d90f4963a12c454641a4504494924c42374b66463',
  'state:search:3:8': '72c8377921f516cefa9382a0edae8bee96f2dabd801e1248d3b7637da72d8845',
  'state:search:3:12': 'fb074d457b62c1c4e4413ebf6051b03ba55a3e54e1d7e8095f26cf7cd268ef3f',
  'state:search:3:16': '7d33e599b91fa38017a500ae149b0daab38c211e39bfde645cac291147003a54',
  'crew:challenge:8': 'b9f4d4bf5d218117efe8a072cc20744ce5ddc79041114c0d8891febbfa3d7384',
  'crew:challenge:12': '27226bf76aaa3b21d204bba5af3d476bf59501dddaa74f4a2ef500ed9e6b6ae2',
  'crew:challenge:16': 'be24d3505f3d7c69237a5bd8baf59ffd5087fb5d9285a8e9bc010616fb795ba0',
  'crew:perspectives:8': '208337b85647097337d918d774f501048dc657e78c32348f6c743a849ff70190',
  'crew:perspectives:12': 'e8358e3eac09ce3ca4f8024db837eedcb57b19421e35495a1d50fae130780a07',
  'crew:perspectives:16': '70f2aaf9a6ab7720433d7671f70521a77c1b17e954ea376baec7eb4fd8cc0bdc',
  'crew:connections:8': '12cd48b51a8252f9a84164438817ec3be9a903259cee7fc18da93cefc93647ee',
  'crew:connections:12': '89352c7ed3612f19a7096feeacd7510ed56036cce20b8f859a7ec15821b1da10',
  'crew:connections:16': '13792d2e77b55d2dc75a9e3e65a4db51b6fec856a2aa6b28caaf52579681296d',
  'crew:structure:8': '791f89c99bade9665e501ad70ffb9c6ceadd3372296c2804ea5613a59716bb8d',
  'crew:structure:12': '3c414acb024552a2e36293c0b437dfb5cd72c3db6205d54eb881e9526242b960',
  'crew:structure:16': '90d5b7e9242fa6282d44e363bf192e7f57bd81d00744c8649ef3e67891e585fb',
  'crew:intent:8': '67a7747a264e690e366e2fea7a0443316fcffee38134f693771a59e0480551a5',
  'crew:intent:12': '888ae073627989358caabc598c0451acea4d7e95115f692ddf5fa6041366ec6c',
  'crew:intent:16': '7f67c55e2cd4a205ee14585811221babfb47cbc29002715ec012d26d19051a8a',
  'crew:experiment:8': 'e38e1651b07c298cdcdbd57e19a36b72c629d795dd6faa796046046641bf2cae',
  'crew:experiment:12': '055fc79051ca7db97a0f049ea2102fe50ea5c7c868a90383bcbf4ee3958fd839',
  'crew:experiment:16': '82f7065683ff22222b60b35bfc97fac602a92b9e514ae92184c802866e6db0d3',
  'meter:wide:0': '33108a66e56e889f274986b6ba667d615994d88dc1148a7ba29ef679581c7189',
  'meter:compact:0': '2c4bb7dec20a2d182c277ee3f5cb3eacae720cd3d438fbc44dce8891cd40918a',
  'meter:wide:1': 'ff57d29d9506da2a110a6c0c96a1414e7c4031befc00e5f21f444afed9f409c5',
  'meter:compact:1': '5cc4c83bc284b09c3abff3afbc291b5fa35e842eede7cfbc3c1d67c2f693bf9f',
  'meter:wide:17': '6c68d7ba83241bb0dd737fc05d13dc5e6d1d1fcd90ae3e0bdd9202926fe2672c',
  'meter:compact:17': 'eca464cb382185c2e720b2d5539a24f7c161870c0ebab451191b0241f33c74b6',
  'meter:wide:50': 'bc2a096e48d4bf8949ab70350d788d233d183eda193512a9e2506609fbf5dffe',
  'meter:compact:50': 'c0fcdf1cb57841f26135d3e47f516ad3c04edccca2b2375918ec89416b30b6b9',
  'meter:wide:62': '655baee4203fff1d74f7509a74d15328b798f6a34c96ea18e39a8e2b1b60dc7e',
  'meter:compact:62': 'cbea16f95ffaca5af8293fd77f63b4cc5bedc3d9d13bc4b996634e99bd3284f3',
  'meter:wide:80': 'd23ebedfe8e7fcd2f3ffe95ecf3282499383ecf822b25ff2ccaa55917767c5b8',
  'meter:compact:80': '17ada5cde0b14edac849b1ccb224021b7ad3ca0ca6b43a0657235a1774892af5',
  'meter:wide:99': '22a915542954d969f44f94f111ac965bcff651e94047d2a475db9b2d7a1d1ca7',
  'meter:compact:99': '8135aa81f903c92f512eb2e7de4213c8c8c2224526c88841b2fda73318a56ea3',
  'meter:wide:100': 'ceb8ac7a29a0a3a04207423605608269caa2c095dfe1fc36d113f87c73cf52ae',
  'meter:compact:100': 'f40415970ad0551159d1fb07a16bec81b8eac409ec964cbc4d7a705047d10937',
  'meter:wide:undefined': '33108a66e56e889f274986b6ba667d615994d88dc1148a7ba29ef679581c7189',
  'meter:compact:undefined': '2c4bb7dec20a2d182c277ee3f5cb3eacae720cd3d438fbc44dce8891cd40918a',
}

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
}

async function mismatches(items: [string, string][]): Promise<string[]> {
  const bad: string[] = []
  for (const [key, text] of items) {
    const got = await sha256(text)
    if (PIN[key] !== got) bad.push(`${key} got ${got} want ${PIN[key] ?? 'none'}`)
  }
  return bad
}

test('R1: every pose, tick and size draws the pixels pinned in plan 380-07 (the canon poses)', async () => {
  const items: [string, string][] = []
  for (const key of Object.keys(POSES).sort()) {
    const pose = POSES[key as keyof typeof POSES]
    for (const tick of TICKS) for (const n of SIZES) {
      items.push([`state:${key}:${tick}:${n}`, JSON.stringify(rasterState(pose, tick, n))])
    }
  }
  expect(items.length).toBe(Object.keys(POSES).length * TICKS.length * SIZES.length)
  expect(await mismatches(items)).toEqual([])
})

test('R2: every crew face at every size draws the same pixels as before the type fix', async () => {
  const items: [string, string][] = []
  for (const role of CREW) {
    for (const n of SIZES) items.push([`crew:${role.id}:${n}`, JSON.stringify(rasterCrew(role, n))])
  }
  expect(items.length).toBe(CREW.length * SIZES.length)
  expect(await mismatches(items)).toEqual([])
})

test('R3: the context canvas, wide and compact, draws the same pixels as before the type fix', async () => {
  const items: [string, string][] = []
  for (const pct of PERCENTS) {
    items.push([`meter:wide:${pct}`, JSON.stringify(contextCanvas(pct, 32, 12))])
    items.push([`meter:compact:${pct}`, JSON.stringify(contextCanvas(pct, 32, 8))])
  }
  items.push(['meter:wide:undefined', JSON.stringify(contextCanvas(undefined, 32, 12))])
  items.push(['meter:compact:undefined', JSON.stringify(contextCanvas(undefined, 32, 8))])
  expect(items.length).toBe(PERCENTS.length * 2 + 2)
  expect(await mismatches(items)).toEqual([])
})
