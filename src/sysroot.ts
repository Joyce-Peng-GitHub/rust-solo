import * as cp from 'child_process';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

let cachedSysrootSrc: string | undefined = undefined;
let hasAttemptedSysroot = false;

export function getSysrootSrc(): string | undefined {
	if (hasAttemptedSysroot) {
		return cachedSysrootSrc;
	}
	hasAttemptedSysroot = true;

	let sysroot = '';

	try {
		sysroot = cp.execSync('rustc --print sysroot', { encoding: 'utf8' }).trim();
	} catch (e) {
		try {
			const cargoHome = process.env.CARGO_HOME || path.join(os.homedir(), '.cargo');
			const executable = os.platform() === 'win32' ? 'rustc.exe' : 'rustc';
			const rustcPath = path.join(cargoHome, 'bin', executable);

			sysroot = cp.execSync(`"${rustcPath}" --print sysroot`, { encoding: 'utf8' }).trim();
		} catch (fallbackError) {
			console.error("Rust Solo: Failed to find rust sysroot in PATH or default Cargo home.", fallbackError);
			return undefined;
		}
	}

	const sysrootSrc = path.join(sysroot, 'lib', 'rustlib', 'src', 'rust', 'library');
	if (fs.existsSync(sysrootSrc)) {
		cachedSysrootSrc = sysrootSrc;
		return sysrootSrc;
	}

	const legacySysrootSrc = path.join(sysroot, 'lib', 'rustlib', 'src', 'rust', 'src');
	if (fs.existsSync(legacySysrootSrc)) {
		cachedSysrootSrc = legacySysrootSrc;
		return legacySysrootSrc;
	}

	console.error(`Rust Solo: Found sysroot at ${sysroot}, but could not locate the 'src' directory inside it. Make sure you ran 'rustup component add rust-src'.`);
	return undefined;
}