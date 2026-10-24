/** City configuration is UI context, not a verified venue catalogue. */
export const siteConfig = {
  name: "Wisata Budaya",
  description:
    "Ruang untuk merencanakan perjalanan budaya dan kuliner dengan lebih sadar.",
  preview: true,
  city: {
    id: "palembang",
    name: "Palembang",
    region: "Sumatra Selatan",
    country: "Indonesia",
    timeZone: "Asia/Jakarta",
    currency: "IDR",
    locale: "id-ID",
  },
} as const;
