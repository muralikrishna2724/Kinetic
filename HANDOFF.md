# Handoff — moving Kinetic to Linux

> **Update 2026-08-13, v1.0.2.** Everything under "NOT verified" has now been run
> on an Android emulator (API 36, x86_64, KVM) — the emulator work this document
> called for. Items 1-5 pass; item 6 remains impossible here. Three further bugs
> surfaced, all of which needed a real Android runtime to see, and all of which
> are fixed. See "Emulator run, v1.0.2" below.
>
> **Update 2026-08-12, v1.0.1.** The v1.0.0 APK was tested on two real Samsungs
> and failed on both. Both bugs are fixed; read "Field failures" below before
> anything else, because they show exactly which assumptions in this document
> were worth nothing.

## Field failures found on real hardware (v1.0.0)

**1. Would not install on a 32-bit phone (Android 10).** The APK was built
`arm64-v8a` only, on the stated assumption that arm64 covers every phone since
~2016. That assumption was wrong for a real device in this user's hands. Release
APKs now build `armeabi-v7a,arm64-v8a`.

**2. Crash loop on first run (Android 16).** Granting location still reported the
permission as missing, then the app crashed and crash-looped on every launch.
Three compounding causes, all fixed:

- Background location was **mandatory with no fallback**. On Android 11+ the
  "Allow all the time" request opens app settings rather than a dialog, so an
  ordinary grant leaves it denied — and `startLocationUpdatesAsync` then throws.
- `start()` persisted the active-run buffer **before** confirming location had
  started, so that throw left an unstartable run on disk.
- `restore()` then called `startLocationUpdatesAsync` **unguarded during app
  hydration** on every launch. Android 12+ forbids starting a foreground service
  from a cold start, so this crashed every single time, permanently.

The lesson worth carrying: everything in "Verified" below was true and none of it
caught this. A typecheck, a clean bundle and a browser walkthrough do not
exercise Android permissions, foreground services, or process lifecycle. **The
emulator work in this document is not optional polish — it is the first thing
that would have caught either bug.**

Written 2026-08-12 on Windows, for whoever picks this up on the Linux side.
Read this before touching anything; it records what is verified, what is *not*,
and the traps that already cost time once.

## Where the project stands

Kinetic is a GPS run tracker (Expo SDK 57 / React Native 0.86, expo-router,
TypeScript strict, zustand). Feature-complete for v1: home, activity, stats,
profile, live tracking, run detail, dark/light theming, and **background
recording** that survives the screen turning off and the app being swiped away.

Architecture notes live in [README.md](README.md) — especially the background
recording section, which explains why the in-progress run lives in AsyncStorage
rather than in memory.

## Verified ✅

- `npx tsc --noEmit` clean.
- Production Android bundle builds (1794 modules) and a release APK installs.
- Every screen rendered and walked in a browser via `npx expo start --web`, in
  **both** light and dark themes: home, activity, stats, profile, run detail,
  and the run screen's permission-denied path. No console errors.
- Splits arithmetic reconciles against total moving time on seeded data.
- Seeded demo runs land within 0.1% of their target distances.
- Final APK manifest contains `ACCESS_BACKGROUND_LOCATION`,
  `FOREGROUND_SERVICE_LOCATION`, and `expo.modules.location.services.LocationTaskService`.
- The Reanimated worklets Babel transform *is* applied despite there being no
  `babel.config.js` — `__workletHash` appears 35 times in the shipped bundle.
  (`babel-preset-expo` auto-detects it in SDK 57.)

### v1.0.1 crash-loop fixes, verified behaviourally

Not by inspection — by injecting the poisoned state into `localStorage` on the
web build and reloading, which drives the same `restore()` path the phone did:

- An **interrupted run** (recent `kinetic.active.meta.v1`) now boots cleanly,
  restores, routes to `/run` and shows the live view with the degraded-mode
  notice. This is the exact state that crash-looped v1.0.0 on every launch.
- A **stale run** (13 h old) is dropped, both buffer keys are cleared, and the
  app lands on Home.
- A **failed start** (permission denied) leaves `kinetic.active.meta.v1` null —
  nothing is persisted, so there is no half-started run for the next launch to
  choke on.

Still unproven on Android: the foreground service itself, the real permission
dialogs, and the notification. Web cannot exercise any of those.

## Emulator run, v1.0.2 ✅ — items 1-5 now verified on Android

Run on a `kinetic_test` AVD (API 36, `google_apis`, x86_64, KVM, headless).
**The Windows boot-death did not reproduce** — it boots in about 16 s and stays
up, which is what the move to Linux was for.

1. **Cold launch** ✅ `Status: ok`, 770 ms, `ReactNativeJS: Running "main"`,
   empty crash buffer, seeded demo history renders.
2. **Permission flow** ✅ Foreground dialog first; the background request opens
   the system Location page rather than a dialog, as Android 12+ does. The
   pre-run chip was checked **both ways**: "Records with the screen off" when
   granted, "Screen must stay on — allow location 'all the time'" when refused.
3. **A full run** ✅ 2.50 km saved and listed in Activity. Pause froze distance
   *and* clock across 25 s while fixes kept arriving, proving the task drops
   fixes while `segmentStartedAt` is null. Splits summed to 404.2 s = the exact
   GPS span, and split metres to 2501.0 m = the exact distance.
4. **Background recording** ✅ With the screen `Asleep` and the app on the
   launcher, the track grew 25 → 124 points at ~1 Hz with the ongoing
   notification alive throughout; the UI caught up via `syncFromStorage` on
   return. **This is the headline feature, working, on Android.**
5. **Process-death recovery** ✅ `am force-stop` mid-run, relaunch, and the run
   resumes *and keeps recording* — 148 → 170 points after the kill, service
   foreground again. (It did not, before the bug in §3 below was fixed.)
6. **GPS filtering** ❌ Still impossible here, exactly as predicted — injected
   coordinates are perfect and never trip `isPlausible()`. **Needs a real phone
   outdoors.** This is now the only item on the list that a laptop cannot reach.

### Bugs the emulator found (all fixed in v1.0.2)

None of these were reachable from a typecheck, a bundle, or the web build —
the same lesson as the v1.0.0 field failures, one layer further in.

1. **Crash on every single run start.** `RECEIVE_BOOT_COMPLETED` was never
   declared, but `expo-task-manager` schedules a *persisted* JobScheduler job to
   deliver location batches, and a persisted job requires it. The first fix
   after `start()` threw `IllegalArgumentException: Requested job cannot be
   persisted...` inside `TaskBroadcastReceiver` and took the process down.
   Note **`beginRecording()`'s try/catch cannot help here** — the throw happens
   later, on the main thread, in a broadcast receiver. This hits the *preferred*
   path hardest: with "Allow all the time" granted the service starts, then dies.
2. **The ongoing notification was never shown.** `POST_NOTIFICATIONS` was not
   declared or requested, so on `targetSdk 36` the appop sat at
   `POST_NOTIFICATION: ignore` and the shade stayed empty. Recording worked, but
   with no sign a run was live and no tap-to-return — the one affordance that
   stops a run being swiped away. Now requested in `prepare()`, deliberately
   *before* the background-location request, which navigates away to settings.
3. **Silent data loss after process death — the worst of the three.**
   `beginRecording()` short-circuits on `hasStartedLocationUpdatesAsync()`, which
   still answers `true` after a kill because TaskManager persists the task
   registration. So `reattach()` reported mode `'background'`, set no notice, and
   never restarted the service: **the UI showed RECORDING while nothing was
   recorded.** Measured at 419 points frozen while fixes kept arriving. Worse
   than a crash, because it looks like it is working. `reattach()` now forces a
   `stopLocationUpdatesAsync()` first to clear the stale registration.

### Known-imperfect, deliberately not changed

- **Splits and moving time measure different things and diverge on a real run.**
  Splits come from GPS timestamps; moving time is wall clock minus pauses. A
  measured run: 502 s moving vs 404 s of splits. The gap is 159 s of idle after
  the last fix (counted by moving time, not splits) minus a 60 s pause (counted
  by splits, not moving time). The "splits reconcile" line under Verified was
  measured on *seeded* data, which contains no pauses — that is why it held.
- **A pause inflates distance if you travel during it.** The resume chord was
  measured at **351.7 m over 60.2 s = 5.84 m/s implied** — comfortably under the
  12 m/s gate, so `isPlausible()` accepts it and the straight line is added to
  the total. Pause, take a bus, resume, and the ride is in your run. Fixing this
  means breaking the track across a pause rather than joining it.

## Traps that already cost time

- **`npm install` needs `--legacy-peer-deps`** — a `react-dom`/`react` clash in
  the transitive tree. For Expo's installer the flag needs a passthrough:
  `npx expo install <pkg> -- --legacy-peer-deps`. A plain legacy install once
  silently pruned `react-native-worklets` and broke the Metro bundle.
- **Build one ABI.** `expo prebuild` generates all four
  (`armeabi-v7a,arm64-v8a,x86,x86_64`) and the New Architecture compiles every
  module's C++ once per ABI. Four ABIs ran past 30 minutes; `arm64-v8a` alone
  built in **2m 1s**. Use `x86_64` for an emulator, `arm64-v8a` for a phone.

  **Always pass it on the command line**, never rely on `android/gradle.properties`:

  ```bash
  ./gradlew assembleRelease -PreactNativeArchitectures=x86_64
  ```

  `android/` is generated and gitignored, so `expo prebuild --clean` regenerates
  `gradle.properties` from the template and silently discards any pin written
  there. The CLI flag is the only setting that survives a prebuild. (In
  PowerShell the comma needs quoting — `"-PreactNativeArchitectures=a,b"` — or it
  parses as an array and fails with `MissingArgument`. Not an issue in bash.)
- **Build `armeabi-v7a` too, for phones.** A 32-bit Android 10 Samsung could not
  install an arm64-only APK at all ("packaged native code did not match any of
  the ABIs supported by the system"). `arm64-v8a` alone is fine for an emulator
  target and for modern phones, but not a safe default for real devices.
- **On an 8 GB Linux box the OOM killer eats the build.** With 12 cores, AGP
  spawns ~12 parallel clang jobs; add a 2 GB Gradle daemon and a separate Kotlin
  daemon and the kernel kills something. It took the Gradle daemon twice
  (`Out of memory: Killed process <pid> (java)` in `journalctl -k`) and, once,
  qemu itself when a build ran alongside the emulator. Two mitigations, both
  needed:

  ```bash
  bash scripts/lowmem-gradle.sh   # after EVERY prebuild — prebuild wipes it
  cd android && taskset -c 0-3 ./gradlew assembleRelease -PreactNativeArchitectures=x86_64
  ```

  `taskset` is the load-bearing half: the JVM sizes the native build from
  `Runtime.availableProcessors()`, which honours the affinity mask, so capping
  cores caps the compilers. With both, x86_64 builds in a reliable ~6m 20s.
  **Never build with the emulator running** — the 8 GB warning below is real.
- **`scripts/emu-run.mjs` has no retry.** Any transient adb hiccup — including
  `adb root`, which restarts adbd — kills the whole route injection mid-run with
  `error: no emulator detected`. It also still hardcodes a Windows adb path;
  override with the `ADB` env var.
- **The Windows emulator is unusable on that machine** — boots to
  `sys.boot_completed=1`, then dies instantly (exit 5, crashpad dialog).
  Reproduced headless at 1536 MB and 1024 MB. Not OOM; the log ends cleanly at
  "Boot completed". This is why we moved to Linux — expect it to just work under
  KVM.
- **8 GB RAM total.** On Windows, ~6 GB was gone before anything started. Do not
  run Gradle and the emulator at the same time; they thrash. On Linux there is
  far more headroom, but still prefer serial.

## Getting set up

```bash
bash scripts/setup-linux.sh
```

Installs JDK 21, the Android SDK (platform 36, build-tools 36, NDK 27.1), the
emulator and a `kinetic_test` AVD, and wires up your shell. It will reuse the
`android-36` system image from the mounted Windows partition if it finds one,
saving ~1.5 GB.

**Copy the source to a native Linux filesystem — do not build on the NTFS
mount.** `node_modules` over ntfs-3g is painfully slow and breaks symlinks and
permissions. Copy the source only; these are Windows-specific or generated and
must be recreated:

```
node_modules/     platform-specific binaries — reinstall
android/          generated by `expo prebuild` — regenerate
.expo/  dist/     build output
```

Then:

```bash
npm install --legacy-peer-deps
npx expo prebuild -p android --clean
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=x86_64
```

## No USB cable

There is no cable suitable for USB debugging, which is why testing moved to an
emulator. If one turns up, a physical phone is strictly better — it is the only
way to test real GPS drift, doze, and OEM background-killing (Xiaomi, Samsung,
Oppo, Vivo and OnePlus kill foreground services aggressively; that is the most
likely real-world failure mode for background recording).

The APK can still be sideloaded without a cable by copying it to the phone via
cloud storage — good enough for manual testing, just not for `logcat`.
