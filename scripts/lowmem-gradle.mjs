/**
 * Reapply low-memory Gradle settings after `expo prebuild`.
 *
 *   npm run gradle:lowmem
 *
 * `expo prebuild` regenerates android/gradle.properties from the template and
 * discards anything written there — the same trap HANDOFF.md documents for
 * reactNativeArchitectures. Run this after every prebuild, before ./gradlew.
 *
 * Why it is needed: on an 8 GB machine the defaults get the Gradle daemon
 * killed partway through the C++ compile — by the kernel OOM killer on Linux
 * ("Out of memory: Killed process <pid> (java)" in dmesg), and by plain
 * allocation failure on Windows, where the daemon dies seconds after starting.
 * Two JVMs (Gradle plus a separate Kotlin daemon) plus one clang per core is
 * more than the box has.
 *
 * The Kotlin setting is the quietly important one: `in-process` avoids standing
 * up a second JVM entirely.
 *
 * Pair with a core cap so ninja spawns fewer parallel clang jobs — the JVM sizes
 * its native build from Runtime.availableProcessors():
 *
 *   Linux:   taskset -c 0-3 ./gradlew assembleRelease -PreactNativeArchitectures=x86_64
 *   Windows: ./gradlew assembleRelease "-PreactNativeArchitectures=..." --max-workers=2
 *
 * Supersedes scripts/lowmem-gradle.sh, which only ran on Linux.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const props = path.join(root, 'android', 'gradle.properties');

if (!existsSync(props)) {
  console.error(`no ${props} — run 'npx expo prebuild -p android' first`);
  process.exit(1);
}

const MANAGED = [
  'org.gradle.jvmargs',
  'org.gradle.parallel',
  'org.gradle.workers.max',
  'kotlin.compiler.execution.strategy',
];

const kept = readFileSync(props, 'utf8')
  .split(/\r?\n/)
  .filter((line) => !MANAGED.some((key) => new RegExp(`^\\s*${key.replace(/\./g, '\\.')}\\s*=`).test(line)));

// Trim trailing blank lines so repeated runs don't accumulate them.
while (kept.length && kept[kept.length - 1].trim() === '') kept.pop();

kept.push(
  '',
  '# --- low-memory build settings (scripts/lowmem-gradle.mjs) ---',
  'org.gradle.jvmargs=-Xmx1536m -XX:MaxMetaspaceSize=512m',
  'org.gradle.parallel=false',
  'org.gradle.workers.max=1',
  'kotlin.compiler.execution.strategy=in-process',
  '',
);

writeFileSync(props, kept.join('\n'), 'utf8');
console.log('applied low-memory settings to android/gradle.properties');
