import { expect, test } from 'claude-code/testing'

import { CREW, POSES, rasterCrew, rasterState } from '../hooks/face'
import { contextCanvas } from '../hooks/meter'

// Phase 380 plan 02 (T-380-04): sha256 pins of every drawn pixel grid, taken from the source
// BEFORE the type fix. A type fix must not change one pixel. These pins are never edited.
// Hash input: the JSON text of the raster output.

const SIZES = [8, 12, 16]
const TICKS = [0, 1, 2, 3]
const PERCENTS = [0, 1, 17, 50, 62, 80, 99, 100]

const PIN: Record<string, string> = {
  'state:found:0:8': '29d7a28a81a2144f20f0917d26bd05a25391d09384d4028cbc89ef2820e39d74',
  'state:found:0:12': 'bd667900a7ff5cf83bab3655dd54aebedcdefbc202aa78b4e1f21ab73ba1d97f',
  'state:found:0:16': '7fe125f5171019ff7f75019f486d181702b69e1e1b74f7823ca0f742bb6f882e',
  'state:found:1:8': '29d7a28a81a2144f20f0917d26bd05a25391d09384d4028cbc89ef2820e39d74',
  'state:found:1:12': 'bd667900a7ff5cf83bab3655dd54aebedcdefbc202aa78b4e1f21ab73ba1d97f',
  'state:found:1:16': '7fe125f5171019ff7f75019f486d181702b69e1e1b74f7823ca0f742bb6f882e',
  'state:found:2:8': '29d7a28a81a2144f20f0917d26bd05a25391d09384d4028cbc89ef2820e39d74',
  'state:found:2:12': 'bd667900a7ff5cf83bab3655dd54aebedcdefbc202aa78b4e1f21ab73ba1d97f',
  'state:found:2:16': '7fe125f5171019ff7f75019f486d181702b69e1e1b74f7823ca0f742bb6f882e',
  'state:found:3:8': '29d7a28a81a2144f20f0917d26bd05a25391d09384d4028cbc89ef2820e39d74',
  'state:found:3:12': 'bd667900a7ff5cf83bab3655dd54aebedcdefbc202aa78b4e1f21ab73ba1d97f',
  'state:found:3:16': '7fe125f5171019ff7f75019f486d181702b69e1e1b74f7823ca0f742bb6f882e',
  'state:handover:0:8': '27d14afefaf0694363df9b6d0da72d0df8a3b554c27f213d6d44dee35f8a063c',
  'state:handover:0:12': 'cfefb060d32d3f0d214bcac64efc920d85dee9ea6685fb034f8a15110cb5716a',
  'state:handover:0:16': '692e44bb8aa6215a20225f7574f79f92de766585ecf7bd79e74880bad55b8d84',
  'state:handover:1:8': '27d14afefaf0694363df9b6d0da72d0df8a3b554c27f213d6d44dee35f8a063c',
  'state:handover:1:12': 'cfefb060d32d3f0d214bcac64efc920d85dee9ea6685fb034f8a15110cb5716a',
  'state:handover:1:16': '692e44bb8aa6215a20225f7574f79f92de766585ecf7bd79e74880bad55b8d84',
  'state:handover:2:8': '27d14afefaf0694363df9b6d0da72d0df8a3b554c27f213d6d44dee35f8a063c',
  'state:handover:2:12': 'cfefb060d32d3f0d214bcac64efc920d85dee9ea6685fb034f8a15110cb5716a',
  'state:handover:2:16': '692e44bb8aa6215a20225f7574f79f92de766585ecf7bd79e74880bad55b8d84',
  'state:handover:3:8': '27d14afefaf0694363df9b6d0da72d0df8a3b554c27f213d6d44dee35f8a063c',
  'state:handover:3:12': 'cfefb060d32d3f0d214bcac64efc920d85dee9ea6685fb034f8a15110cb5716a',
  'state:handover:3:16': '692e44bb8aa6215a20225f7574f79f92de766585ecf7bd79e74880bad55b8d84',
  'state:listen:0:8': '5e57a6a418cae0814c5a78c1df80beac7bf7417ae7e4d7d980d6d6e3a8bbccf9',
  'state:listen:0:12': '7df3cecf24a549ea66166ef16190ef1bdf0b27080dbba2fee0fe97be596a13f0',
  'state:listen:0:16': '778aef9e30d0df4b8dc0f66834dbde63ee43b3c44441056af1b3fe626a33bd39',
  'state:listen:1:8': '5e57a6a418cae0814c5a78c1df80beac7bf7417ae7e4d7d980d6d6e3a8bbccf9',
  'state:listen:1:12': '7df3cecf24a549ea66166ef16190ef1bdf0b27080dbba2fee0fe97be596a13f0',
  'state:listen:1:16': '778aef9e30d0df4b8dc0f66834dbde63ee43b3c44441056af1b3fe626a33bd39',
  'state:listen:2:8': '5e57a6a418cae0814c5a78c1df80beac7bf7417ae7e4d7d980d6d6e3a8bbccf9',
  'state:listen:2:12': '7df3cecf24a549ea66166ef16190ef1bdf0b27080dbba2fee0fe97be596a13f0',
  'state:listen:2:16': '778aef9e30d0df4b8dc0f66834dbde63ee43b3c44441056af1b3fe626a33bd39',
  'state:listen:3:8': '5e57a6a418cae0814c5a78c1df80beac7bf7417ae7e4d7d980d6d6e3a8bbccf9',
  'state:listen:3:12': '7df3cecf24a549ea66166ef16190ef1bdf0b27080dbba2fee0fe97be596a13f0',
  'state:listen:3:16': '778aef9e30d0df4b8dc0f66834dbde63ee43b3c44441056af1b3fe626a33bd39',
  'state:none:0:8': '431b81845fa7c9b4f8a09f54bb199a6cecb816035fdeca73be50d50a47c30a78',
  'state:none:0:12': 'd480cfc481a00d4f1f2b77252fb1e6aa1e5aa302095b52d647b8b468867e3d0f',
  'state:none:0:16': 'af3db0896de30e6a370b95405fa9bd7073744ed261a6b74e7c5dd125f204b008',
  'state:none:1:8': '431b81845fa7c9b4f8a09f54bb199a6cecb816035fdeca73be50d50a47c30a78',
  'state:none:1:12': 'd480cfc481a00d4f1f2b77252fb1e6aa1e5aa302095b52d647b8b468867e3d0f',
  'state:none:1:16': 'af3db0896de30e6a370b95405fa9bd7073744ed261a6b74e7c5dd125f204b008',
  'state:none:2:8': '431b81845fa7c9b4f8a09f54bb199a6cecb816035fdeca73be50d50a47c30a78',
  'state:none:2:12': 'd480cfc481a00d4f1f2b77252fb1e6aa1e5aa302095b52d647b8b468867e3d0f',
  'state:none:2:16': 'af3db0896de30e6a370b95405fa9bd7073744ed261a6b74e7c5dd125f204b008',
  'state:none:3:8': '431b81845fa7c9b4f8a09f54bb199a6cecb816035fdeca73be50d50a47c30a78',
  'state:none:3:12': 'd480cfc481a00d4f1f2b77252fb1e6aa1e5aa302095b52d647b8b468867e3d0f',
  'state:none:3:16': 'af3db0896de30e6a370b95405fa9bd7073744ed261a6b74e7c5dd125f204b008',
  'state:refused:0:8': 'b051857caf9626dcd2195c66eb39092b01e9325cd299935d3edeb141dc52075a',
  'state:refused:0:12': 'ab77151ca4001a36dc23356eee44e52f662f9004c07e3aaa4ace8a5d1c0edc1f',
  'state:refused:0:16': 'f4472228bd825ac117f9cb7291ae50f4e23291de11f5bbeda6552ae88706e0a0',
  'state:refused:1:8': 'b051857caf9626dcd2195c66eb39092b01e9325cd299935d3edeb141dc52075a',
  'state:refused:1:12': 'ab77151ca4001a36dc23356eee44e52f662f9004c07e3aaa4ace8a5d1c0edc1f',
  'state:refused:1:16': 'f4472228bd825ac117f9cb7291ae50f4e23291de11f5bbeda6552ae88706e0a0',
  'state:refused:2:8': 'b051857caf9626dcd2195c66eb39092b01e9325cd299935d3edeb141dc52075a',
  'state:refused:2:12': 'ab77151ca4001a36dc23356eee44e52f662f9004c07e3aaa4ace8a5d1c0edc1f',
  'state:refused:2:16': 'f4472228bd825ac117f9cb7291ae50f4e23291de11f5bbeda6552ae88706e0a0',
  'state:refused:3:8': 'b051857caf9626dcd2195c66eb39092b01e9325cd299935d3edeb141dc52075a',
  'state:refused:3:12': 'ab77151ca4001a36dc23356eee44e52f662f9004c07e3aaa4ace8a5d1c0edc1f',
  'state:refused:3:16': 'f4472228bd825ac117f9cb7291ae50f4e23291de11f5bbeda6552ae88706e0a0',
  'state:rest:0:8': 'dc04e40997e924b89633bb9ef5dff26a150823d6563be8572f2e91c781848dd2',
  'state:rest:0:12': '0987033cffc05429931b750b0f680d05c2a1e5096dc133fa8ca5aa5466722b4a',
  'state:rest:0:16': 'd326979ff2765b7fabe2a2edb8f55adfe51b774ad3f93dc915730b35d563e1b1',
  'state:rest:1:8': 'dc04e40997e924b89633bb9ef5dff26a150823d6563be8572f2e91c781848dd2',
  'state:rest:1:12': '0987033cffc05429931b750b0f680d05c2a1e5096dc133fa8ca5aa5466722b4a',
  'state:rest:1:16': 'd326979ff2765b7fabe2a2edb8f55adfe51b774ad3f93dc915730b35d563e1b1',
  'state:rest:2:8': 'dc04e40997e924b89633bb9ef5dff26a150823d6563be8572f2e91c781848dd2',
  'state:rest:2:12': '0987033cffc05429931b750b0f680d05c2a1e5096dc133fa8ca5aa5466722b4a',
  'state:rest:2:16': 'd326979ff2765b7fabe2a2edb8f55adfe51b774ad3f93dc915730b35d563e1b1',
  'state:rest:3:8': 'dc04e40997e924b89633bb9ef5dff26a150823d6563be8572f2e91c781848dd2',
  'state:rest:3:12': '0987033cffc05429931b750b0f680d05c2a1e5096dc133fa8ca5aa5466722b4a',
  'state:rest:3:16': 'd326979ff2765b7fabe2a2edb8f55adfe51b774ad3f93dc915730b35d563e1b1',
  'state:search:0:8': 'ae333093c2b8d0b4a59143557b3f93b4937e084f4641783ad0293f3304372fca',
  'state:search:0:12': '87c4e027f156b5470bee4cc279a350bafef8abbeb76dbdee3f49f1705a1b99b3',
  'state:search:0:16': 'd85d141de6d66d858619c064aad0553e23fb7cd0cdeecec2b1d4f2c8fd986964',
  'state:search:1:8': '3630e28c976717519ddfa901c9193b090e43ab75e7372239cdaa7b07d3b66fa9',
  'state:search:1:12': '87c4e027f156b5470bee4cc279a350bafef8abbeb76dbdee3f49f1705a1b99b3',
  'state:search:1:16': 'f31c6465cdba78cfea227bcd1c16327db9e755fa33b262e13d8ae3fbd6c6233b',
  'state:search:2:8': '3630e28c976717519ddfa901c9193b090e43ab75e7372239cdaa7b07d3b66fa9',
  'state:search:2:12': '8f57be4034cf959947401c0416b94f238efeb34cacc68ef956f70866ef0aaa6f',
  'state:search:2:16': 'f31c6465cdba78cfea227bcd1c16327db9e755fa33b262e13d8ae3fbd6c6233b',
  'state:search:3:8': '3630e28c976717519ddfa901c9193b090e43ab75e7372239cdaa7b07d3b66fa9',
  'state:search:3:12': '8f57be4034cf959947401c0416b94f238efeb34cacc68ef956f70866ef0aaa6f',
  'state:search:3:16': '8557c9aa68ccb631ba1dc5866eb72109d839a6965de2ba7cff53df918bee024d',
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

test('R1: every pose, tick and size draws the same pixels as before the type fix', async () => {
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
