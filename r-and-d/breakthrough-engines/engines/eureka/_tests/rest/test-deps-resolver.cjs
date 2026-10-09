'use strict';
const path = require('node:path'); const fs = require('node:fs'); const os = require('node:os');
const S = require('./_stubs.cjs'); const check = S.check;
const R = require(path.join(__dirname, '../../lib/core/eureka-deps-resolver.cjs'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eureka-deps-'));
function pkg(name, files) { const d = path.join(tmp, 'node_modules', name); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'package.json'), JSON.stringify({ name: name, main: 'index.js', version: '1.0.0' })); fs.writeFileSync(path.join(d, 'index.js'), files); }
pkg('good-pkg', 'module.exports = { ok: 1 };');
pkg('broken-pkg', 'throw new Error("native binding failed");');
pkg('needs-missing', 'require("does-not-exist-xyz"); module.exports = 1;');
fs.mkdirSync(path.join(tmp, 'node_modules', '@sc', 'p'), { recursive: true });
fs.writeFileSync(path.join(tmp, 'node_modules', '@sc', 'p', 'package.json'), '{"name":"@sc/p","main":"i.js"}');
fs.writeFileSync(path.join(tmp, 'node_modules', '@sc', 'p', 'i.js'), 'module.exports = "scoped";');

process.env.MINDRIAN_EUREKA_DEPS_ROOT = tmp;
check('root override', R.eurekaDepsRoot() === tmp);
process.env.MINDRIAN_EUREKA_DEPS_ROOT = path.relative(process.cwd(), tmp);
check('relative override resolved to absolute (2026)', path.isAbsolute(R.eurekaDepsRoot()) && R.eurekaDepsRoot() === tmp);
process.env.MINDRIAN_EUREKA_DEPS_ROOT = tmp;
check('good dep loads', (R.requireEurekaDep('good-pkg') || {}).ok === 1);
check('scoped dep loads', R.requireEurekaDep('@sc/p') === 'scoped');
check('missing dep -> null, no error recorded', R.requireEurekaDep('nope-nothing') === null && R.eurekaDepError('nope-nothing') === null);
check('broken dep -> null', R.requireEurekaDep('broken-pkg') === null);
const e = R.eurekaDepError('broken-pkg');
check('broken dep failure recorded (2026)', e && /native binding failed/.test(e.message), JSON.stringify(e));
check('transitive missing module recorded', R.requireEurekaDep('needs-missing') === null && R.eurekaDepError('needs-missing') && /does-not-exist-xyz/.test(R.eurekaDepError('needs-missing').message));
['../../etc/passwd', '/abs/path', './rel', '', null, undefined, 5, 'A_UPPER', 'x'.repeat(215)].forEach(function (bad) {
  check('rejects ' + String(bad).slice(0, 20), R.requireEurekaDep(bad) === null && R.eurekaDepInstalled(bad).installed === false && R.eurekaDepError(bad) === null);
});
const inst = R.eurekaDepInstalled('good-pkg');
check('installed probe side-dir', inst.installed && inst.where === 'side-dir' && inst.dir === path.join(tmp, 'node_modules', 'good-pkg'));
check('not installed probe', R.eurekaDepInstalled('absent-pkg').installed === false && R.eurekaDepInstalled('absent-pkg').where === null);
delete process.env.MINDRIAN_EUREKA_DEPS_ROOT;
process.env.HOME = tmp; delete process.env.USERPROFILE;
check('home chain fallback', R.eurekaDepsRoot() === path.join(tmp, '.mindrian', 'eureka-deps'));
fs.rmSync(tmp, { recursive: true, force: true });
S.done('test-deps-resolver');
