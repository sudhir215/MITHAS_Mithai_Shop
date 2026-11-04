# MITHAS updated React website

Included:
- Larger mithai photos (300–340px product image panels) and a larger hero photo.
- Animated premium-style homepage using Framer Motion.
- Separate Our Story page at `/story`.
- Responsive navigation, cart drawer, quantity controls and WhatsApp checkout.
- Tailwind CSS 3 setup matching the supplied package versions.

Run:
```bash
npm install
npm run dev
```
Open the local URL printed by Vite (usually http://localhost:5173).

Before publishing:
1. Replace `WHATSAPP_NUMBER` in `src/App.jsx` with your WhatsApp number (country code + digits only).
2. Replace sample phone/address details in `Footer`.
3. Replace remote Unsplash images in `products` with your actual mithai photos when available.
4. The Story page deliberately uses neutral sample copy. Replace it with your real shop/family history. Do not publish unverified dates or claims.
5. Verify all sample prices and product descriptions.
