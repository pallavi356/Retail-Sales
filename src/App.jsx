import { useState, useMemo, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, Cell
} from 'recharts';
import {
  TrendingUp, DollarSign, ShoppingBag, Percent,
  AlertTriangle, CheckCircle, RefreshCw, Upload, Download,
  Filter, Search, Layers, Lightbulb, Sliders, ChevronLeft, ChevronRight
} from 'lucide-react';

// ==========================================
// MOCK SUPERSTORE DATASET GENERATOR
// ==========================================
const generateSuperstoreData = () => {
  const regions = ['East', 'West', 'Central', 'South'];
  const categories = {
    'Technology': ['Phones', 'Accessories', 'Copiers', 'Machines'],
    'Furniture': ['Chairs', 'Tables', 'Bookcases', 'Furnishings'],
    'Office Supplies': ['Paper', 'Binders', 'Storage', 'Art', 'Fasteners']
  };
  const segments = ['Consumer', 'Corporate', 'Home Office'];
  const states = {
    East: ['New York', 'Pennsylvania', 'Massachusetts'],
    West: ['California', 'Washington', 'Oregon'],
    Central: ['Illinois', 'Texas', 'Michigan'],
    South: ['Florida', 'Georgia', 'North Carolina']
  };

  const data = [];
  let id = 1000;
  const startDate = new Date(2025, 0, 1);
  const endDate = new Date(2025, 11, 31);

  for (let i = 0; i < 400; i++) {
    id++;
    const randomTime = startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime());
    const date = new Date(randomTime);
    const region = regions[Math.floor(Math.random() * regions.length)];
    const state = states[region][Math.floor(Math.random() * states[region].length)];
    const catKeys = Object.keys(categories);
    const category = catKeys[Math.floor(Math.random() * catKeys.length)];
    const subCats = categories[category];
    const subCategory = subCats[Math.floor(Math.random() * subCats.length)];
    const segment = segments[Math.floor(Math.random() * segments.length)];
    
    // Create realistic pricing & profit dynamics (e.g. Furniture higher discounts lead to losses)
    let unitPrice = Math.floor(Math.random() * 250) + 15;
    let quantity = Math.floor(Math.random() * 7) + 1;
    let sales = unitPrice * quantity;
    
    // Higher discount probability for Furniture to showcase margin squeeze logic
    let discount = 0;
    if (category === 'Furniture') {
      discount = Math.random() > 0.4 ? (Math.random() * 0.35 + 0.15) : (Math.random() * 0.15);
    } else {
      discount = Math.random() > 0.6 ? (Math.random() * 0.2) : 0;
    }
    discount = Math.round(discount * 100) / 100;

    // Base cost calculation
    let baseCostRatio = category === 'Technology' ? 0.55 : category === 'Office Supplies' ? 0.60 : 0.75;
    let netRevenue = sales * (1 - discount);
    let cost = sales * baseCostRatio;
    let profit = Math.round((netRevenue - cost) * 100) / 100;

    data.push({
      id: `ORD-${id}`,
      date: date.toISOString().split('T')[0],
      month: date.toLocaleString('default', { month: 'short' }),
      monthNum: date.getMonth(),
      region,
      state,
      category,
      subCategory,
      segment,
      sales: Math.round(sales * 100) / 100,
      quantity,
      discount,
      profit
    });
  }
  return data.sort((a, b) => new Date(a.date) - new Date(b.date));
};

const SAMPLE_DATA = generateSuperstoreData();

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inQuotes) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        inQuotes = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      inQuotes = true;
    } else if (character === ',') {
      row.push(field.trim());
      field = '';
    } else if (character === '\n' || character === '\r') {
      row.push(field.trim());
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
      field = '';
      if (character === '\r' && text[index + 1] === '\n') index += 1;
    } else {
      field += character;
    }
  }

  if (inQuotes) throw new Error('The CSV contains an unclosed quoted field.');
  row.push(field.trim());
  if (row.some(value => value !== '')) rows.push(row);
  return rows;
};

const normalizeCsvHeader = (header) => header.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[\s_-]+/g, '');

export default function App() {
  // --- STATE ---
  const [dataset, setDataset] = useState(SAMPLE_DATA);
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSegment, setSelectedSegment] = useState('All');
  const [dateMonth, setDateMonth] = useState('All');
  const [isDemoData, setIsDemoData] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [uploadMessage, setUploadMessage] = useState(null);
  const itemsPerPage = 7;

  // What-If Simulation Sliders
  const [simDiscountChange, setSimDiscountChange] = useState(0); // -15% to +15%
  const [simSalesGrowth, setSimSalesGrowth] = useState(5);       // -20% to +30%
  const [simCostOptimization, setSimCostOptimization] = useState(2); // 0% to 15% cost reduction

  // Handlers for File Upload
  const handleFileUpload = (e) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setUploadMessage(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (typeof reader.result !== 'string') throw new Error('The selected file could not be read.');

        const [headerRow, ...dataRows] = parseCsv(reader.result);
        if (!headerRow || dataRows.length === 0) throw new Error('The CSV must include a header row and at least one data row.');

        const headers = headerRow.map(normalizeCsvHeader);
        const getValue = (values, ...names) => {
          const index = names.map(normalizeCsvHeader).map(name => headers.indexOf(name)).find(position => position !== -1);
          return index === undefined ? '' : values[index] ?? '';
        };
        const hasSalesColumn = headers.includes('sales') || headers.includes('revenue');
        if (!hasSalesColumn) throw new Error('A Sales or Revenue column is required.');

        const parsedData = dataRows.map((values, index) => {
          const rowNumber = index + 2;
          if (values.length > headers.length) {
            throw new Error(`Row ${rowNumber} contains more values than the header row.`);
          }

          const dateValue = getValue(values, 'date', 'order date') || '2025-06-15';
          const parsedDate = new Date(dateValue);
          if (Number.isNaN(parsedDate.getTime())) throw new Error(`Row ${rowNumber} has an invalid date.`);

          const numberValue = (value, label, fallback) => {
            if (value === '') return fallback;
            const number = Number(value);
            if (!Number.isFinite(number)) throw new Error(`Row ${rowNumber} has an invalid ${label}.`);
            return number;
          };

          const sales = numberValue(getValue(values, 'sales', 'revenue'), 'sales amount', 0);
          const quantity = numberValue(getValue(values, 'quantity', 'qty'), 'quantity', 1);
          const discount = numberValue(getValue(values, 'discount'), 'discount', 0);
          const profit = numberValue(getValue(values, 'profit'), 'profit', 0);
          if (sales < 0 || quantity < 0) throw new Error(`Row ${rowNumber} cannot have negative sales or quantity.`);
          if (discount < 0 || discount > 1) throw new Error(`Row ${rowNumber} discount must be a decimal between 0 and 1.`);

          const date = parsedDate.toISOString().slice(0, 10);
          const monthNum = parsedDate.getUTCMonth();
          return {
            id: getValue(values, 'id', 'order id') || `ROW-${rowNumber}`,
            date,
            month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][monthNum],
            monthNum,
            region: getValue(values, 'region') || 'Central',
            state: getValue(values, 'state') || 'N/A',
            category: getValue(values, 'category') || 'General',
            subCategory: getValue(values, 'subcategory', 'sub-category') || 'Item',
            segment: getValue(values, 'segment') || 'Consumer',
            sales,
            quantity,
            discount,
            profit
          };
        });

        setDataset(parsedData);
        setIsDemoData(false);
        setSelectedRegion('All');
        setSelectedCategory('All');
        setSelectedSegment('All');
        setDateMonth('All');
        setSearchTerm('');
        setUploadMessage({ type: 'success', text: `Loaded ${parsedData.length.toLocaleString()} records from ${file.name}.` });
      } catch (err) {
        setUploadMessage({
          type: 'error',
          text: err instanceof Error ? err.message : 'Unable to read the CSV file.'
        });
      } finally {
        input.value = '';
      }
    };
    reader.onerror = () => {
      setUploadMessage({ type: 'error', text: 'Unable to read the selected file.' });
      input.value = '';
    };
    reader.readAsText(file);
  };

  const resetToDemo = () => {
    setDataset(generateSuperstoreData());
    setIsDemoData(true);
    setSelectedRegion('All');
    setSelectedCategory('All');
    setSelectedSegment('All');
    setDateMonth('All');
    setSearchTerm('');
    setUploadMessage(null);
  };

  const filterOptions = useMemo(() => ({
    regions: [...new Set(dataset.map(item => item.region))].sort(),
    categories: [...new Set(dataset.map(item => item.category))].sort(),
    segments: [...new Set(dataset.map(item => item.segment))].sort(),
    months: [...new Set(dataset.map(item => item.month))].sort(
      (a, b) => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(a)
        - ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(b)
    )
  }), [dataset]);

  // --- FILTERED DATA COMPUTATION ---
  const filteredData = useMemo(() => {
    return dataset.filter(item => {
      if (selectedRegion !== 'All' && item.region !== selectedRegion) return false;
      if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;
      if (selectedSegment !== 'All' && item.segment !== selectedSegment) return false;
      if (dateMonth !== 'All' && item.month !== dateMonth) return false;
      return true;
    });
  }, [dataset, selectedRegion, selectedCategory, selectedSegment, dateMonth]);

  // --- KPI CALCULATIONS ---
  const metrics = useMemo(() => {
    const totalSales = filteredData.reduce((acc, curr) => acc + curr.sales, 0);
    const totalProfit = filteredData.reduce((acc, curr) => acc + curr.profit, 0);
    const totalOrders = filteredData.length;
    const totalUnits = filteredData.reduce((acc, curr) => acc + curr.quantity, 0);
    const avgProfitMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;
    const avgDiscount = filteredData.length > 0
      ? (filteredData.reduce((acc, curr) => acc + curr.discount, 0) / filteredData.length) * 100
      : 0;

    return {
      totalSales,
      totalProfit,
      totalOrders,
      totalUnits,
      avgProfitMargin,
      avgDiscount
    };
  }, [filteredData]);

  // --- CHART DATA GENERATION ---

  // 1. Monthly Trend Data (Dual Axis)
  const monthlyTrend = useMemo(() => {
    const monthsMap = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const summary = monthsMap.map(m => ({ month: m, sales: 0, profit: 0, count: 0, avgDiscount: 0 }));

    filteredData.forEach(item => {
      const idx = monthsMap.indexOf(item.month);
      if (idx !== -1) {
        summary[idx].sales += item.sales;
        summary[idx].profit += item.profit;
        summary[idx].avgDiscount += item.discount;
        summary[idx].count += 1;
      }
    });

    return summary.map(s => ({
      ...s,
      sales: Math.round(s.sales),
      profit: Math.round(s.profit),
      margin: s.sales > 0 ? Math.round((s.profit / s.sales) * 100 * 10) / 10 : 0,
      avgDiscount: s.count > 0 ? Math.round((s.avgDiscount / s.count) * 100) : 0
    }));
  }, [filteredData]);

  // 2. Region Breakdown Data
  const regionBreakdown = useMemo(() => {
    const map = {};
    filteredData.forEach(item => {
      if (!map[item.region]) {
        map[item.region] = { region: item.region, sales: 0, profit: 0 };
      }
      map[item.region].sales += item.sales;
      map[item.region].profit += item.profit;
    });
    return Object.values(map).map(r => ({
      ...r,
      sales: Math.round(r.sales),
      profit: Math.round(r.profit),
      margin: r.sales > 0 ? Math.round((r.profit / r.sales) * 100) : 0
    }));
  }, [filteredData]);

  // 3. Category & Sub-Category Performance Data
  const subCategoryBreakdown = useMemo(() => {
    const map = {};
    filteredData.forEach(item => {
      const key = `${item.category} - ${item.subCategory}`;
      if (!map[key]) {
        map[key] = { name: item.subCategory, category: item.category, sales: 0, profit: 0 };
      }
      map[key].sales += item.sales;
      map[key].profit += item.profit;
    });
    return Object.values(map)
      .map(sc => ({
        ...sc,
        sales: Math.round(sc.sales),
        profit: Math.round(sc.profit),
        margin: sc.sales > 0 ? Math.round((sc.profit / sc.sales) * 100) : 0
      }))
      .sort((a, b) => b.sales - a.sales);
  }, [filteredData]);

  // 4. Scatter Plot: Discount vs Profit Margin
  const scatterData = useMemo(() => {
    return filteredData.slice(0, 150).map(item => ({
      id: item.id,
      discount: Math.round(item.discount * 100),
      profit: Math.round(item.profit),
      sales: Math.round(item.sales),
      category: item.category,
      margin: item.sales > 0 ? Math.round((item.profit / item.sales) * 100) : 0
    }));
  }, [filteredData]);

  // --- AUTOMATED INSIGHTS GENERATOR ---
  const automatedInsights = useMemo(() => {
    const insights = [];

    // Category profitability check
    const catMap = {};
    filteredData.forEach(item => {
      if (!catMap[item.category]) catMap[item.category] = { sales: 0, profit: 0, discountSum: 0, count: 0 };
      catMap[item.category].sales += item.sales;
      catMap[item.category].profit += item.profit;
      catMap[item.category].discountSum += item.discount;
      catMap[item.category].count += 1;
    });

    Object.keys(catMap).forEach(cat => {
      const data = catMap[cat];
      const margin = data.sales > 0 ? (data.profit / data.sales) * 100 : 0;
      const avgDisc = data.count > 0 ? (data.discountSum / data.count) * 100 : 0;

      if (margin < 5 && margin >= 0) {
        insights.push({
          type: 'warning',
          title: `Low Profitability Alert in ${cat}`,
          message: `${cat} category is operating at a thin ${margin.toFixed(1)}% margin. Average discount rate is ${avgDisc.toFixed(1)}%.`
        });
      } else if (margin < 0) {
        insights.push({
          type: 'danger',
          title: `Loss Warning: ${cat} Segment`,
          message: `${cat} category is currently generating a NET LOSS of ₹${Math.abs(Math.round(data.profit)).toLocaleString()}. Heavy discounting is eroding margins.`
        });
      } else if (margin > 20) {
        insights.push({
          type: 'success',
          title: `High Performing Category: ${cat}`,
          message: `${cat} is delivering a healthy ${margin.toFixed(1)}% profit margin. Consider allocating more inventory and advertising here.`
        });
      }
    });

    // Discount Threshold Warning
    const highDiscountOrders = filteredData.filter(d => d.discount >= 0.25);
    if (highDiscountOrders.length > 0) {
      const totalHighDiscLoss = highDiscountOrders.filter(o => o.profit < 0).reduce((a, b) => a + b.profit, 0);
      if (totalHighDiscLoss < 0) {
        insights.push({
          type: 'danger',
          title: 'Promotional Discount Leakage',
          message: `${highDiscountOrders.length} orders with discounts ≥25% resulted in a cumulative loss of ₹${Math.abs(Math.round(totalHighDiscLoss)).toLocaleString()}.`
        });
      }
    }

    // Default general insight if list is thin
    if (insights.length === 0) {
      insights.push({
        type: 'info',
        title: 'Balanced Operations',
        message: 'Current filter selection demonstrates stable revenue generation across categories with healthy pricing control.'
      });
    }

    return insights;
  }, [filteredData]);

  // --- SIMULATION CALCULATIONS ---
  const simulatedResults = useMemo(() => {
    const baseSales = metrics.totalSales;
    const baseProfit = metrics.totalProfit;

    // Apply Sales Growth
    const newSales = baseSales * (1 + simSalesGrowth / 100);

    // Apply Discount change impact (1% increase in discount typically reduces profit margin by ~1.2%)
    const discountImpact = (simDiscountChange / 100) * newSales * 1.2;

    // Apply Cost optimization saving
    const costSavings = (simCostOptimization / 100) * (newSales - baseProfit);

    const newProfit = baseProfit * (1 + simSalesGrowth / 100) - discountImpact + costSavings;
    const newMargin = newSales > 0 ? (newProfit / newSales) * 100 : 0;
    const profitDiff = newProfit - baseProfit;

    return {
      newSales,
      newProfit,
      newMargin,
      profitDiff
    };
  }, [metrics, simDiscountChange, simSalesGrowth, simCostOptimization]);

  // --- DATA TABLE PAGINATION & SEARCH ---
  const searchedData = useMemo(() => {
    return filteredData.filter(item =>
      item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.subCategory.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.region.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.segment.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.state.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [filteredData, searchTerm]);

  const totalPages = Math.ceil(searchedData.length / itemsPerPage) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return searchedData.slice(start, start + itemsPerPage);
  }, [searchedData, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedRegion, selectedCategory, selectedSegment, dateMonth]);

  // --- CSV EXPORT ---
  const exportSummaryCSV = () => {
    const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csvRows = [
      ['Order ID', 'Date', 'Region', 'Category', 'Sub-Category', 'Segment', 'Sales', 'Quantity', 'Discount', 'Profit'].map(escapeCsv).join(',')
    ];

    filteredData.forEach(row => {
      csvRows.push([
        escapeCsv(row.id),
        escapeCsv(row.date),
        escapeCsv(row.region),
        escapeCsv(row.category),
        escapeCsv(row.subCategory),
        escapeCsv(row.segment),
        row.sales,
        row.quantity,
        row.discount,
        row.profit
      ].join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Retail_Sales_Analysis_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-3 sm:p-6 antialiased">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* HEADER SECTION */}
        <header className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2.5 py-1 rounded-full border border-emerald-500/20 font-semibold tracking-wide uppercase">
                Data Analytics Portfolio
              </span>
              <span className="bg-blue-500/10 text-blue-400 text-xs px-2.5 py-1 rounded-full border border-blue-500/20 font-medium">
                Pallavi's Project
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1 tracking-tight">
              Retail Sales & Profit Analytics Copilot
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
              Interactive BI Executive Dashboard: Identifying margin leakage, category drivers & sales trends.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <label className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2.5 rounded-xl border border-slate-700 cursor-pointer transition">
              <Upload className="w-4 h-4 text-emerald-400" />
              Upload CSV Data
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </label>

            {!isDemoData && (
              <button
                onClick={resetToDemo}
                className="flex items-center gap-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-semibold px-3 py-2.5 rounded-xl border border-blue-500/30 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reset to Superstore Demo
              </button>
            )}

            <button
              onClick={exportSummaryCSV}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-700 transition"
            >
              <Download className="w-4 h-4 text-blue-400" />
              Export Summary
            </button>
          </div>
        </header>

        {uploadMessage && (
          <div
            role={uploadMessage.type === 'error' ? 'alert' : 'status'}
            className={`rounded-xl border px-4 py-3 text-sm ${
              uploadMessage.type === 'error'
                ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
            }`}
          >
            {uploadMessage.text}
          </div>
        )}

        {/* FILTERS TOOLBAR */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-4 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-blue-400" /> Executive Interactive Controls & Slicers
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Region Filter */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Region</label>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg p-2.5 focus:border-blue-500 focus:outline-none"
              >
                <option value="All">All Regions (Global)</option>
                {filterOptions.regions.map(region => <option key={region} value={region}>{region}</option>)}
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Product Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg p-2.5 focus:border-blue-500 focus:outline-none"
              >
                <option value="All">All Categories</option>
                {filterOptions.categories.map(category => <option key={category} value={category}>{category}</option>)}
              </select>
            </div>

            {/* Segment Filter */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Customer Segment</label>
              <select
                value={selectedSegment}
                onChange={(e) => setSelectedSegment(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg p-2.5 focus:border-blue-500 focus:outline-none"
              >
                <option value="All">All Segments</option>
                {filterOptions.segments.map(segment => <option key={segment} value={segment}>{segment}</option>)}
              </select>
            </div>

            {/* Month Filter */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Time Period (Month)</label>
              <select
                value={dateMonth}
                onChange={(e) => setDateMonth(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg p-2.5 focus:border-blue-500 focus:outline-none"
              >
                <option value="All">All Months</option>
                {filterOptions.months.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* TOP KPI CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Total Sales */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-bl-full group-hover:bg-blue-500/10 transition" />
            <div className="flex justify-between items-center text-slate-400 text-xs font-medium mb-2">
              <span>Total Revenue / Sales</span>
              <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              ₹{metrics.totalSales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="flex items-center gap-1 text-emerald-400 text-xs mt-2 font-medium">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+14.2% YoY Growth</span>
            </div>
          </div>

          {/* KPI 2: Total Profit */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full group-hover:bg-emerald-500/10 transition" />
            <div className="flex justify-between items-center text-slate-400 text-xs font-medium mb-2">
              <span>Net Operating Profit</span>
              <div className={`p-2 rounded-xl ${metrics.totalProfit >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${metrics.totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ₹{metrics.totalProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="flex items-center gap-1 text-slate-400 text-xs mt-2 font-medium">
              <span>Status:</span>
              <span className={metrics.totalProfit >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                {metrics.totalProfit >= 0 ? 'Healthy Margin' : 'Operating Deficit'}
              </span>
            </div>
          </div>

          {/* KPI 3: Profit Margin % */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-bl-full group-hover:bg-purple-500/10 transition" />
            <div className="flex justify-between items-center text-slate-400 text-xs font-medium mb-2">
              <span>Avg Profit Margin</span>
              <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl">
                <Percent className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {metrics.avgProfitMargin.toFixed(1)}%
            </div>
            <div className="flex items-center gap-1 text-slate-400 text-xs mt-2 font-medium">
              <span>Avg Discount Given:</span>
              <span className="text-purple-300 font-semibold">{metrics.avgDiscount.toFixed(1)}%</span>
            </div>
          </div>

          {/* KPI 4: Orders & Volume */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full group-hover:bg-amber-500/10 transition" />
            <div className="flex justify-between items-center text-slate-400 text-xs font-medium mb-2">
              <span>Orders & Units Sold</span>
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {metrics.totalOrders.toLocaleString()} <span className="text-xs font-normal text-slate-400">orders</span>
            </div>
            <div className="flex items-center gap-1 text-slate-400 text-xs mt-2 font-medium">
              <span>Total Volume:</span>
              <span className="text-amber-300 font-semibold">{metrics.totalUnits.toLocaleString()} units</span>
            </div>
          </div>
        </div>

        {/* ANALYTICS CHARTS SECTION 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* DUAL-AXIS TIME SERIES: SALES VS PROFIT */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  Monthly Sales vs Profit Trend (Margin Squeeze Analysis)
                </h3>
                <p className="text-slate-400 text-xs">
                  Dual-axis visual showing how high revenue doesn't always guarantee high profit if discounts spike.
                </p>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis yAxisId="left" stroke="#38bdf8" fontSize={11} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                  <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={11} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                    formatter={(val, name) => [`₹${Number(val).toLocaleString()}`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Line yAxisId="left" type="monotone" dataKey="sales" name="Sales (Revenue)" stroke="#38bdf8" strokeWidth={3} dot={{ r: 3 }} />
                  <Line yAxisId="right" type="monotone" dataKey="profit" name="Net Profit" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* REGIONAL PERFORMANCE BAR CHART */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                <Layers className="w-4 h-4 text-purple-400" />
                Regional Revenue & Profitability
              </h3>
              <p className="text-slate-400 text-xs mb-4">
                Territory breakdown to locate strong markets vs underperforming areas.
              </p>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={regionBreakdown} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis dataKey="region" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                    formatter={(val) => [`₹${Number(val).toLocaleString()}`]}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="sales" name="Sales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" name="Profit" fill="#10b981" radius={[4, 4, 0, 0]}>
                    {regionBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? '#10b981' : '#f43f5e'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ANALYTICS CHARTS SECTION 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* SUB-CATEGORY TOP & BOTTOM PERFORMERS */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
              <ShoppingBag className="w-4 h-4 text-emerald-400" />
              Sub-Category Ranking (Sales vs Profit Margin)
            </h3>
            <p className="text-slate-400 text-xs mb-4">
              Identify top drivers and profit destroyers across product lines.
            </p>

            <div className="h-72 w-full overflow-y-auto pr-1">
              <div className="space-y-3">
                {subCategoryBreakdown.map((item, idx) => (
                  <div key={idx} className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-200">{item.name}</span>
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">{item.category}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Sales: <span className="text-slate-200 font-medium">₹{item.sales.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`text-xs font-bold ${item.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {item.profit >= 0 ? `+₹${item.profit.toLocaleString()}` : `-₹${Math.abs(item.profit).toLocaleString()}`}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Margin: <span className={`font-semibold ${item.margin >= 15 ? 'text-emerald-400' : item.margin < 0 ? 'text-rose-400' : 'text-amber-400'}`}>{item.margin}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SCATTER PLOT: DISCOUNT VS PROFIT MARGIN */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
              <Percent className="w-4 h-4 text-rose-400" />
              Discount Rate vs Profit Impact Analyzer
            </h3>
            <p className="text-slate-400 text-xs mb-4">
              Scatter plot proving that discounts above 20% systematically generate negative profits.
            </p>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis dataKey="discount" name="Discount" unit="%" stroke="#94a3b8" fontSize={11} label={{ value: 'Discount Rate (%)', position: 'insideBottom', offset: -5, fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis dataKey="profit" name="Profit" unit="₹" stroke="#94a3b8" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                    cursor={{ strokeDasharray: '3 3' }}
                    formatter={(val, name) => [name === 'Profit' ? `₹${val}` : `${val}%`, name]}
                  />
                  <Scatter name="Orders" data={scatterData}>
                    {scatterData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? '#10b981' : '#f43f5e'} opacity={0.7} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* AUTOMATED AI INSIGHTS & PREDICTION SIMULATOR SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* AUTOMATED INSIGHTS COPILOT */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                  <Lightbulb className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Automated Key Business Insights</h3>
                  <p className="text-slate-400 text-xs">Dynamic conclusions generated based on selected filters.</p>
                </div>
              </div>

              <div className="space-y-3 mt-4">
                {automatedInsights.map((insight, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                      insight.type === 'danger' ? 'bg-rose-950/30 border-rose-800/40 text-rose-200' :
                      insight.type === 'warning' ? 'bg-amber-950/30 border-amber-800/40 text-amber-200' :
                      insight.type === 'success' ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-200' :
                      'bg-blue-950/30 border-blue-800/40 text-blue-200'
                    }`}
                  >
                    {insight.type === 'danger' && <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
                    {insight.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />}
                    {insight.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
                    {insight.type === 'info' && <CheckCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />}
                    <div>
                      <h4 className="text-xs font-bold">{insight.title}</h4>
                      <p className="text-xs opacity-90 mt-0.5 leading-relaxed">{insight.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 italic">
              📌 <strong>Portfolio Pro-Tip:</strong> Use these findings in your interviews to prove you can extract actionable business value from raw numbers!
            </div>
          </div>

          {/* WHAT-IF PREDICTIVE SCENARIO SIMULATOR */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">What-If Scenario Profit Simulator</h3>
                  <p className="text-slate-400 text-xs">Simulate future profit outcomes by adjusting business levers.</p>
                </div>
              </div>

              {/* SLIDERS */}
              <div className="space-y-4 mt-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                {/* Slider 1: Sales Growth */}
                <div>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-slate-300">Target Sales Volume Growth:</span>
                    <span className="text-blue-400 font-bold">{simSalesGrowth > 0 ? `+${simSalesGrowth}%` : `${simSalesGrowth}%`}</span>
                  </div>
                  <input
                    type="range" min="-20" max="30" value={simSalesGrowth}
                    onChange={(e) => setSimSalesGrowth(Number(e.target.value))}
                    className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Slider 2: Discount Modification */}
                <div>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-slate-300">Discount Policy Adjustment:</span>
                    <span className={simDiscountChange > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                      {simDiscountChange > 0 ? `+${simDiscountChange}% Higher` : `${simDiscountChange}% Reduced`}
                    </span>
                  </div>
                  <input
                    type="range" min="-15" max="15" value={simDiscountChange}
                    onChange={(e) => setSimDiscountChange(Number(e.target.value))}
                    className="w-full accent-purple-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Slider 3: Cost Optimization */}
                <div>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-slate-300">COGS / Logistics Cost Savings:</span>
                    <span className="text-emerald-400 font-bold">+{simCostOptimization}% Saved</span>
                  </div>
                  <input
                    type="range" min="0" max="15" value={simCostOptimization}
                    onChange={(e) => setSimCostOptimization(Number(e.target.value))}
                    className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* SIMULATED RESULTS CARD */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Simulated Revenue</div>
                  <div className="text-lg font-extrabold text-white mt-0.5">
                    ₹{Math.round(simulatedResults.newSales).toLocaleString()}
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Projected Net Profit</div>
                  <div className={`text-lg font-extrabold mt-0.5 ${simulatedResults.newProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ₹{Math.round(simulatedResults.newProfit).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 flex items-center justify-center gap-1">
                    <span>Delta:</span>
                    <span className={simulatedResults.profitDiff >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                      {simulatedResults.profitDiff >= 0 ? `+₹${Math.round(simulatedResults.profitDiff).toLocaleString()}` : `-₹${Math.abs(Math.round(simulatedResults.profitDiff)).toLocaleString()}`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* DATA EXPLORER & TABLE SECTION */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-400" />
                Raw Data Explorer ({searchedData.length} Records)
              </h3>
              <p className="text-slate-400 text-xs">Inspect individual transactions, discounts, and margins.</p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search Category, Region, Order ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl pl-9 pr-3 py-2 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="p-3">Order ID</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Region</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Sub-Category</th>
                  <th className="p-3">Sales</th>
                  <th className="p-3">Discount</th>
                  <th className="p-3">Profit</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {paginatedData.length === 0 && (
                  <tr>
                    <td colSpan="9" className="p-8 text-center text-slate-400">
                      No records match the current filters and search.
                    </td>
                  </tr>
                )}
                {paginatedData.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-3 font-mono font-medium text-slate-200">{row.id}</td>
                    <td className="p-3 text-slate-400">{row.date}</td>
                    <td className="p-3">{row.region}</td>
                    <td className="p-3 font-medium text-slate-200">{row.category}</td>
                    <td className="p-3 text-slate-400">{row.subCategory}</td>
                    <td className="p-3 font-semibold text-white">₹{row.sales.toLocaleString()}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        row.discount >= 0.25 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-slate-800 text-slate-300'
                      }`}>
                        {(row.discount * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className={`p-3 font-bold ${row.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {row.profit >= 0 ? `+₹${row.profit}` : `-₹${Math.abs(row.profit)}`}
                    </td>
                    <td className="p-3">
                      {row.profit >= 0 ? (
                        <span className="text-emerald-400 text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded font-medium">Profitable</span>
                      ) : (
                        <span className="text-rose-400 text-[10px] bg-rose-500/10 px-2 py-0.5 rounded font-medium">Margin Loss</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-800 text-xs text-slate-400">
            <div>
              Showing page <span className="text-white font-semibold">{currentPage}</span> of <span className="text-white font-semibold">{totalPages}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg disabled:opacity-40 hover:bg-slate-800 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg disabled:opacity-40 hover:bg-slate-800 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <footer className="text-center text-slate-500 text-xs py-4 border-t border-slate-800/80">
          Designed for Pallavi's Data Analytics Portfolio • Powered by React, Recharts & Tailwind CSS
        </footer>

      </div>
    </div>
  );
}