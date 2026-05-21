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
- Product detail opens as an in-page bottom sheet/modal; the old product detail route was removed.
- The cart is isolated by session + trip, not by email alone.
- The cart page is `My Tackle Box`, with item quantity controls, item-level remove, payment summary, `PAY NOW`, and `CONTINUE SHOPPING`.
- There is no full-cart clear button in the current UI.
- Local cart snapshots are cleared on logout and before a new login session is stored.
- After logout + new login, Shop Gears should start with a clean cart.
- Future attention: `Discount` and `Shipping` are currently fixed display values in the cart UI. If they become business rules, calculate them server-side before checkout.

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
