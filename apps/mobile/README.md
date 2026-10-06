# Maison Mobile (Expo)

The native Maison shop: Expo SDK 55 + React Native 0.83 + Expo Router (typed routes) + TanStack Query, talking to the web app's `/api/mobile/v1/*` API through `@maison/shared` contracts.

## What's in the app

- **Browse & buy:** Home (branded hero, new-arrivals rail, shop-by-room rail), Shop (search, room/category/sort/price/in-stock filters, infinite scroll), Product (`product/[slug]`: gallery, specs, add-to-cart), Cart (guest device cart + signed-in server cart), Checkout (COD + Paystack webview, PRICE_CHANGED re-confirm), Orders + `orders/[id]` timeline, Account (Google sign-in, currency switch, contact card). Detail screens push inside their tab's stack, so the bottom tab bar stays visible throughout.
- **Design:** Maison editorial tokens — paper/ink/bronze, Fraunces display + Space Grotesk body (loaded via `expo-font` in `app/_layout.tsx`, families exported from `src/lib/theme.ts`). App icons/splash in `assets/images/` are generated from the brand MotifMark — the web component `apps/web/components/storefront/Editorial.tsx` plus `apps/web/public/favicon.svg`.

## Environment

Copy `apps/mobile/.env.example` → `apps/mobile/.env` if you don't have one:

```
EXPO_PUBLIC_API_URL=https://ashgrove.peterabah.com
```

- Default is the **prod API** — the release APK and normal `expo start` sessions work against it out of the box.
- The file is gitignored; only `EXPO_PUBLIC_*` values belong in it (they are inlined into the bundle).
- For local API development use `EXPO_PUBLIC_API_URL=http://localhost:4100` (see below).

## Dev loop

```bash
pnpm --filter @maison/mobile start          # expo start (Metro)
pnpm --filter @maison/mobile android        # expo run:android (debug build + install)
```

Local API on **:4100** (never 3000 — that port belongs to another worktree in this workspace):

```bash
pnpm --filter @maison/web dev -- -p 4100
# in another terminal, with EXPO_PUBLIC_API_URL=http://localhost:4100 in apps/mobile/.env
adb reverse tcp:4100 tcp:4100               # Android device/emulator reaches host :4100
pnpm --filter @maison/mobile start
```

`adb reverse` must be re-run after reconnecting a USB device or restarting the emulator.

## Google sign-in

Shopper auth is Better Auth with the `expo()` + `bearer()` plugins on the web instance (`apps/web/lib/auth.ts`). The app scheme is `maison`, and `trustedOrigins` already includes `maison://` (plus `exp://` origins in development), so **prod sign-in needs no extra configuration**. It works on device against the prod API; for local API testing the web server must be reachable from the device via `adb reverse` (above) and the Google OAuth client must accept the dev origin — see `docs/ARCHITECTURE.md` §9.

## Architecture map

```
app/
  _layout.tsx           fonts + splash hold, providers (QueryClient, Currency, CartSync), root Stack ((tabs) only)
  (tabs)/_layout.tsx    bottom tabs (Home, Shop, Cart, Orders, Account) + cart badge
  (tabs)/(home)/_layout.tsx    Home stack (PDP shared with Shop)
  (tabs)/(home)/index.tsx      Home: branded hero, new-arrivals rail, shop-by-room rail
  (tabs)/(shop)/_layout.tsx    Shop stack (PDP shared with Home)
  (tabs)/(shop)/shop.tsx       Catalog: FilterBar + ProductGrid (infinite query)
  (tabs)/(cart)/_layout.tsx    Cart stack (cart → checkout)
  (tabs)/(cart)/cart.tsx       Guest/server cart, qty steppers, summary
  (tabs)/(cart)/checkout.tsx   Address/zone/currency/payment + COD & Paystack flows
  (tabs)/(orders)/_layout.tsx  Orders stack (list → detail)
  (tabs)/(orders)/orders.tsx   Order history (sign-in required)
  (tabs)/(orders)/orders/[id].tsx  Order detail: timeline, cancellation, payment verify
  (tabs)/(account)/_layout.tsx Account stack
  (tabs)/(account)/account.tsx Google sign-in/out + currency
  (tabs)/(home,shop)/product/[slug].tsx  PDP shared by Home and Shop stacks
src/lib/
  api.ts                Typed fetch client for /api/mobile/v1 + ApiError/PRICE_CHANGED
  auth-client.ts        Better Auth Expo client (scheme maison, SecureStore)
  session.ts            useSession / signInWithGoogle / signOut
  cart.ts, guest-cart.ts  Unified cart hook: device cart for guests, server cart when signed in
  currency.tsx, query.ts, order-status.ts, theme.ts
src/components/         screen, product-card/grid/rail/gallery, filter-bar, add-to-cart, money, states…
```

## Release APK (Android)

Expo's default release signing signs with the generated **debug keystore** (`android/app/debug.keystore`) — fine for internal distribution, **not** for Play Store uploads (add a release keystore / EAS credentials before publishing).

```bash
cd apps/mobile
pnpm exec expo prebuild -p android --clean --no-install   # regenerates gitignored android/
cd android
JAVA_HOME=/home/peter/.gradle/jdks/eclipse_adoptium-17-amd64-linux/jdk-17.0.15+6 \
  ./gradlew :app:assembleRelease
```

- **JDK 17 is required.** The generated Gradle 9 setup uses the foojay toolchain resolver 0.5.0, which cannot use the ambient JDK 21; point `JAVA_HOME` at a Temurin 17 (verify the path above on your machine — `~/.gradle/jdks/` is where Gradle provisions it).
- Output: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`; the release build also copies the handover artifact to `apps/mobile/dist/maison-1.0.0.apk` (gitignored).
- The bundle inlines `EXPO_PUBLIC_API_URL` at build time, so rebuild after changing `.env`.
