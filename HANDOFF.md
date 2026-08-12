# Handoff — moving Kinetic to Linux

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

## NOT verified ❌ — this is the actual job on Linux

Nothing has ever run on real Android hardware or an emulator. The Windows
emulator crashed on boot every time (see Traps). Outstanding:

1. **Cold launch on a device** — watch `adb logcat` for a native or JS crash.
   Everything above is bundler- and browser-level; none of it proves the app
   starts on Android.
2. **Permission flow** — the two-step foreground → "Allow all the time" prompt.
   Android 11+ suppresses the background prompt if both are requested at once;
   the code asks in sequence (`src/store/tracker.ts` → `prepare`). Confirm the
   pre-run chip reports the granted level correctly.
3. **A full run** — start, accumulate, pause, resume, finish, save, and check it
   appears in Activity with sane splits. Use `node scripts/emu-run.mjs` to feed a
   synthetic route via `adb emu geo fix`.
4. **Background recording** — the headline feature, entirely unproven. Start a
   run, send the app home (`adb shell input keyevent KEYCODE_HOME`), lock the
   screen (`keyevent 26`), keep injecting fixes, and confirm the ongoing
   notification persists and the track keeps growing.
5. **Process-death recovery** — `adb shell am force-stop app.kinetic.running`
   mid-run, relaunch, and confirm `restore()` drops you back into the live run.
6. **GPS filtering** — `isPlausible()` in `src/lib/geo.ts` rejects fixes with
   accuracy > 35 m, movement < 1.2 m, or implied speed > 12 m/s. **An emulator
   cannot test this**: injected coordinates are perfect and never trip it. Only a
   real phone outdoors exercises it.

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
