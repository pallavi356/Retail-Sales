# Retail Sales & Profit Analytics Dashboard

Interactive React dashboard for exploring retail revenue, profit, discounts, and product performance. The dashboard starts with generated sample data and also supports CSV uploads.

## Run locally

```bash
npm install
npm run host
```

Open http://127.0.0.1:5173 in your browser. The host command only binds to your own computer. Alternatively, `npm run dev` starts Vite with its default host settings. Create a production build with `npm run build`.

The project uses React, Recharts, Lucide, and Tailwind CSS. If you have just cloned the project, run `npm install` before starting the server.

## CSV data

Use the **Upload CSV Data** button to replace the sample data. CSV headers can include:

| Field | Accepted header names |
| --- | --- |
| Order ID | `id`, `order id` |
| Date | `date`, `order date` |
| Region | `region` |
| Category | `category` |
| Sub-category | `subcategory`, `sub-category` |
| Customer segment | `segment` |
| Sales | `sales`, `revenue` |
| Quantity | `quantity`, `qty` |
| Discount | `discount` |
| Profit | `profit` |

Fields not provided by the CSV receive dashboard defaults. Discount values should be decimals (for example, `0.15` for 15%).
