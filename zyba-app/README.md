This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Zyba App Notes

This app contains the authenticated traveler experience for Zyba Outdoors.

Important project documentation:

- `../SHOP_GEARS_DOCUMENTATION.md`: Shop Gears architecture, Products API mapping, cart/session rules, Stripe checkout flow, UI updates, and fixed issues.
- `AGENTS.md`: local agent rule requiring the bundled Next.js docs to be checked before code changes.

### Shop Gears Current Behavior

- Products come from the Zoho CRM `Products` module.
- Product separation/filtering is driven by the `Category` Pick List from the CRM.
- Product listing only shows records with `Product_Active=true`.
- Product cards show a green `ESSENTIAL` badge when the CRM boolean field `Essential` is checked.
- Product detail opens as an in-page bottom sheet/modal; the old product detail route was removed.
- The cart is isolated by session + trip, not by email alone.
- The cart page is `My Tackle Box`, with item quantity controls, item-level remove, payment summary, `PAY NOW`, and `CONTINUE SHOPPING`.
- Sales Order creation after Stripe approval uses the Zoho `Product Orders` layout and must finish before the approved animation appears.
- If a traveler returns from Stripe without paying, the app treats it as an incomplete checkout, keeps the cart editable, and does not show technical pending/unpaid status text.
- Starting a new `PAY NOW` attempt expires the prior open Stripe Checkout Session for the same logged-in traveler before creating a new session.
- There is no full-cart clear button in the current UI.
- Local cart snapshots are cleared on logout and before a new login session is stored.
- After logout + new login, Shop Gears should start with a clean cart.
- Future attention: `Discount` and `Shipping` are currently fixed display values in the cart UI. If they become business rules, calculate them server-side before checkout.

### App Cache Policy

The authenticated frontend calls the local `/api/*` proxy with `cache: "no-store"` for app data. The main API reduction happens in the Catalyst backend before calling Zoho.

Current backend cache defaults:

- Traveler/Profile: 5 minutes.
- My Trips and My Orders: 3 minutes.
- Trip Details, Flights, Full Itinerary, Hotels, Hotel Details, and Transfer: 5 minutes.
- Products and Shop Gears product details/categories: 2 minutes.
- Documents/Requirements: intentionally bypasses the Trip Details cache so accepting document terms is reflected immediately.
- Zoho record cache is invalidated when the app updates a record through `zohoUpdateRecord`.
- Cart and checkout state use Catalyst Cache with longer TTLs because they are session/trip state, not Zoho read-cache.

Login and OTP:

- OTP request and verify calls use `cache: "no-store"`.
- OTP resend has a 60 second cooldown and a backend limit of 5 requests per email in 15 minutes.
- Login stores only `zyba_session_token` in `localStorage`; logout removes it and clears local cart snapshots.
- The default customer login path is `/login`, using email OTP.

### App Store Review Login

For App Store review only, the app keeps a hidden alternate route at `/apple-review-login`.
This route is not linked from the customer UI. It calls `POST /auth/apple-review/login`
in the Catalyst backend and creates a normal session for the configured Apple review
account.

Decision:

- Customers use OTP at `/login`.
- Apple Review can use `/apple-review-login` with credentials supplied only in App Review notes.
- The Apple review password is configured with `APPLE_REVIEW_LOGIN_PASSWORD` in Catalyst, not committed in source.
- The temporary Apple review route should be disabled or removed after App Store approval and before broad customer launch.

Required Catalyst variables for the review route:

- `APPLE_REVIEW_LOGIN_EMAIL`
- `APPLE_REVIEW_LOGIN_PASSWORD`
- `APPLE_REVIEW_ZOHO_ACCOUNT_ID`
- `APPLE_REVIEW_ZOHO_ACCOUNT_NAME`

Common empty-state copy:

- Documents, Flights/Itinerary, Hotels, and Transfer show: `This information is not available yet, but we're working on it. You'll receive a notification as soon as it's ready.`

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
