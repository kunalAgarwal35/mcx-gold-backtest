
import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { Play, Activity, Calendar, DollarSign } from 'lucide-react';

const BacktestPanel = ({ fullData }) => {
    // --- Configuration State ---
    const [config, setConfig] = useState({
        startDate: '2014-01-01',
        endDate: new Date().toISOString().split('T')[0],
        initialLots: 1,
        initialMarginPercent: 12,
        transactionCost: 1800,
        compoundingFactor: 200,
        isCompounding: true,
        neverCompound: false
    });

    // --- Results State ---
    const [stats, setStats] = useState(null);
    const [equityCurve, setEquityCurve] = useState([]);
    const [drawdownCurve, setDrawdownCurve] = useState([]);
    const [yearlyReturns, setYearlyReturns] = useState([]);
    const [tradeLog, setTradeLog] = useState([]);

    // --- Backtest Engine ---
    const runBacktest = () => {
        if (!fullData || fullData.length === 0) return;

        // 1. Filter Data
        const data = fullData.filter(d => d.date >= config.startDate && d.date <= config.endDate);
        if (data.length < 2) return;

        const CONTRACT_MULTIPLIER = 100;

        // Initial setup
        let currentLots = config.initialLots;
        const startPrice = data[0].price_near;
        const contractValue = startPrice * CONTRACT_MULTIPLIER * currentLots;
        const initialCapital = contractValue * (config.initialMarginPercent / 100);

        let cash = initialCapital;
        let entryPrice = startPrice;
        let baselineCapital = initialCapital;
        let peakEquity = initialCapital;

        let equitySeries = [];
        let drawdownSeries = [];
        let trades = [];

        // Loop
        for (let i = 0; i < data.length; i++) {
            const today = data[i];
            const prev = i > 0 ? data[i - 1] : null;

            // Check Rollover
            if (prev && today.expiry_near !== prev.expiry_near) {
                const sellPrice = prev.price_near;
                const buyPrice = prev.price_far;

                // Trade: Sell Old -> Buy New
                const rawPnL = (sellPrice - entryPrice) * CONTRACT_MULTIPLIER * currentLots;
                const cost = config.transactionCost * currentLots;
                const netPnL = rawPnL - cost;

                cash += netPnL;
                entryPrice = buyPrice;

                // Log Trade
                trades.push({
                    date: today.date,
                    type: "Rollover",
                    contracts: `${prev.expiry_near} → ${today.expiry_near}`,
                    sellPrice: sellPrice,
                    buyPrice: buyPrice,
                    lots: currentLots,
                    grossPnL: rawPnL,
                    cost: cost,
                    netPnL: netPnL,
                    equity: cash
                });
            }

            // Mark to Market Equity
            const currentPrice = today.price_near;
            const unrealized = (currentPrice - entryPrice) * CONTRACT_MULTIPLIER * currentLots;
            const currentEquity = cash + unrealized;

            // Compounding Check (Daily)
            if (!config.neverCompound && config.isCompounding) {
                if (currentEquity - baselineCapital >= (config.compoundingFactor / 100) * baselineCapital) {
                    currentLots *= 2;
                    baselineCapital = currentEquity;
                    trades.push({
                        date: today.date,
                        type: "Compounding",
                        contracts: "Position Doubled",
                        lots: currentLots,
                        equity: currentEquity,
                        note: "Profit Target Hit"
                    });
                }
            }

            // Drawdown tracking
            if (currentEquity > peakEquity) peakEquity = currentEquity;
            const dd = peakEquity > 0 ? ((peakEquity - currentEquity) / peakEquity) * 100 : 0;

            equitySeries.push({
                date: today.date,
                equity: Math.round(currentEquity),
                lots: currentLots,
                drawdown: dd.toFixed(2)
            });
            drawdownSeries.push({ date: today.date, drawdown: dd.toFixed(2) });
        }

        // --- Final Stats Calculation ---
        if (equitySeries.length > 0) {
            const finalEq = equitySeries[equitySeries.length - 1].equity;
            const totalRet = ((finalEq - initialCapital) / initialCapital) * 100;

            // CAGR
            const startD = new Date(config.startDate);
            const endD = new Date(config.endDate);
            const years = Math.max(1, (endD - startD) / (1000 * 60 * 60 * 24 * 365.25));
            const cagr = (Math.pow(finalEq / initialCapital, 1 / years) - 1) * 100;

            // Yearly Returns
            const yoy = calculateYoY(equitySeries);
            const avgAnnualRet = yoy.reduce((acc, curr) => acc + parseFloat(curr.return), 0) / yoy.length;

            setStats({
                initialCapital,
                finalCapital: finalEq,
                totalReturn: totalRet,
                cagr,
                avgAnnualRet,
                maxDD: Math.max(...equitySeries.map(e => parseFloat(e.drawdown))),
                maxLots: Math.max(...equitySeries.map(e => e.lots))
            });
            setEquityCurve(equitySeries);
            setDrawdownCurve(drawdownSeries);
            setYearlyReturns(yoy);
            setTradeLog(trades.reverse());
        }
    };

    // Helper: YoY
    const calculateYoY = (series) => {
        const yearsMap = {};
        series.forEach(d => {
            const y = d.date.split('-')[0];
            if (!yearsMap[y]) yearsMap[y] = { start: d.equity, end: d.equity };
            yearsMap[y].end = d.equity;
        });
        const years = Object.keys(yearsMap).sort();
        const yoy = [];
        for (let i = 0; i < years.length; i++) {
            const y = years[i];
            let start = yearsMap[y].start;
            if (i > 0) start = yearsMap[years[i - 1]].end;
            const end = yearsMap[y].end;
            const ret = ((end - start) / start) * 100;
            yoy.push({ year: y, return: ret.toFixed(1) });
        }
        return yoy;
    };

    useEffect(() => { runBacktest(); }, [config, fullData]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setConfig(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : (name.includes('Date') ? value : parseFloat(value))
        }));
    };

    // --- Render ---
    if (!fullData) return null;

    return (
        <div className="flex flex-col gap-6 md:gap-10">
            {/* 1. Configuration Section (Refined & Cleaner) */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 md:px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-indigo-600" />
                        Backtest Configuration
                    </h2>
                    <button
                        onClick={runBacktest}
                        className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-sm transition-all active:scale-95 text-sm"
                    >
                        <Play className="w-4 h-4 fill-white" />
                        Run Simulation
                    </button>
                </div>

                <div className="p-4 md:p-6">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8">

                        {/* Time Period - Col Span 4 */}
                        <div className="md:col-span-4 flex flex-col gap-3">
                            <LabelRow label="Time Period" icon={<Calendar className="w-3.5 h-3.5 text-gray-400" />} />
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <span className="text-[10px] text-gray-400 font-semibold mb-1.5 block uppercase tracking-wider">Start Date</span>
                                    <InputField type="date" name="startDate" value={config.startDate} onChange={handleChange} />
                                </div>
                                <div>
                                    <div className="flex justify-between items-center mb-1.5">
                                        <span className="text-[10px] text-gray-400 font-semibold block uppercase tracking-wider">End Date</span>
                                        <button
                                            className="text-[10px] text-indigo-600 font-bold hover:text-indigo-800 tracking-wide transition-colors"
                                            onClick={() => setConfig({ ...config, endDate: new Date().toISOString().split('T')[0] })}
                                        >
                                            MAX
                                        </button>
                                    </div>
                                    <InputField type="date" name="endDate" value={config.endDate} onChange={handleChange} />
                                </div>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="hidden md:block w-px bg-gray-100 mx-auto" />

                        {/* Position Sizing - Col Span 3 */}
                        <div className="md:col-span-3 flex flex-col gap-3">
                            <LabelRow label="Position & Margin" icon={<DollarSign className="w-3.5 h-3.5 text-gray-400" />} />
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <span className="text-[10px] text-gray-400 font-semibold mb-1.5 block uppercase tracking-wider">Lots (1kg)</span>
                                    <InputField type="number" name="initialLots" value={config.initialLots} onChange={handleChange} />
                                </div>
                                <div>
                                    <span className="text-[10px] text-gray-400 font-semibold mb-1.5 block uppercase tracking-wider">Margin %</span>
                                    <InputField type="number" name="initialMarginPercent" value={config.initialMarginPercent} onChange={handleChange} />
                                </div>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="hidden md:block w-px bg-gray-100 mx-auto" />

                        {/* Compounding & Costs - Col Span 3 */}
                        <div className="md:col-span-3 flex flex-col gap-3">
                            <LabelRow label="Strategy Logic" icon={<Activity className="w-3.5 h-3.5 text-gray-400" />} />
                            <div className="space-y-3">
                                <div className="flex items-center justify-between h-10 px-1">
                                    <label htmlFor="neverCompound" className="flex items-center gap-2 cursor-pointer select-none group">
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${config.neverCompound ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white group-hover:border-indigo-400'}`}>
                                            {config.neverCompound && <div className="w-2 h-2 bg-white rounded-[1px]" />}
                                        </div>
                                        <span className="text-xs text-gray-600 font-medium">Never Compound</span>
                                    </label>
                                    <input
                                        type="checkbox"
                                        id="neverCompound"
                                        checked={config.neverCompound}
                                        onChange={(e) => setConfig({ ...config, neverCompound: e.target.checked, isCompounding: !e.target.checked })}
                                        className="hidden"
                                    />
                                </div>

                                {!config.neverCompound ? (
                                    <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg p-2 border border-gray-100">
                                        <span>Double Lots at</span>
                                        <input
                                            type="number"
                                            name="compoundingFactor"
                                            value={config.compoundingFactor}
                                            onChange={handleChange}
                                            className="w-12 border-b border-gray-300 focus:border-indigo-600 bg-transparent text-center outline-none font-bold text-gray-900 px-0.5"
                                        />
                                        <span>% Profit</span>
                                    </div>
                                ) : (
                                    <div className='text-[10px] text-gray-400 italic p-2'>Compounding disabled</div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            {/* 2. Results Section (Stats + Charts) */}
            {stats && (
                <div className="flex flex-col gap-6 md:gap-8">
                    {/* Hero Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
                        <StatCard label="Start Capital" value={`₹${(stats.initialCapital / 100000).toFixed(2)} L`} />
                        <StatCard label="Final Capital" value={`₹${(stats.finalCapital / 100000).toFixed(2)} L`} highlight />
                        <StatCard label="Total Return" value={`${stats.totalReturn.toFixed(0)}%`} color={stats.totalReturn >= 0 ? "text-green-600" : "text-red-500"} />
                        <StatCard label="CAGR" value={`${stats.cagr.toFixed(1)}%`} />
                        <StatCard label="Avg Annual" value={`${stats.avgAnnualRet.toFixed(1)}%`} subtitle="Arithmetic Mean" />
                        <StatCard label="Max Drawdown" value={`${stats.maxDD.toFixed(1)}%`} color="text-red-600" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                        {/* Main Charts */}
                        <div className="lg:col-span-2 bg-white p-3 md:p-6 rounded-xl border border-gray-200 shadow-sm min-h-[420px]">
                            <div className="flex justify-between items-center mb-6 px-1">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Equity Growth</h3>
                                <div className="text-xs font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                                    Current Lots: {equityCurve[equityCurve.length - 1]?.lots}
                                </div>
                            </div>
                            <ResponsiveContainer width="100%" height={340}>
                                <AreaChart data={equityCurve} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="eqGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                    <XAxis dataKey="date" tickFormatter={d => d.split('-')[0]} minTickGap={40} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} dy={10} />
                                    <YAxis tickFormatter={v => `${(v / 100000).toFixed(0)}L`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} dx={-10} />
                                    <RechartsTooltip
                                        contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        formatter={v => `₹${Math.round(v).toLocaleString()}`}
                                        labelStyle={{ color: '#6b7280', marginBottom: '4px', fontSize: '12px' }}
                                    />
                                    <Area type="monotone" dataKey="equity" stroke="#4f46e5" fill="url(#eqGradient)" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Side Stats (YoY) */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[420px]">
                            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Yearly Returns</h3>
                            </div>
                            <div className="flex-1 overflow-x-auto custom-scrollbar">
                                <div className="min-w-full inline-block align-middle">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-white sticky top-0 z-10 shadow-sm">
                                            <tr>
                                                <th className="py-3 pl-5 text-left text-xs text-gray-400 font-semibold uppercase whitespace-nowrap">Year</th>
                                                <th className="py-3 pr-5 text-right text-xs text-gray-400 font-semibold uppercase whitespace-nowrap">Return</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {yearlyReturns.map(y => (
                                                <tr key={y.year} className="hover:bg-gray-50/80 transition-colors">
                                                    <td className="py-2.5 pl-5 text-gray-600 font-medium whitespace-nowrap">{y.year}</td>
                                                    <td className={`py-2.5 pr-5 text-right font-bold whitespace-nowrap ${parseFloat(y.return) >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                                                        {parserSigned(y.return)}%
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. Trade Ledger */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-4 md:px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Trade Log</h3>
                            <span className="text-xs text-gray-400 font-medium">{tradeLog.length} Events Logged</span>
                        </div>
                        <div className="max-h-[400px] overflow-x-auto">
                            <div className="min-w-[600px] align-middle inline-block">
                                <table className="min-w-full text-sm text-center">
                                    <thead className="text-xs text-gray-400 uppercase bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th className="py-3 px-4 text-left font-semibold whitespace-nowrap">Date</th>
                                            <th className="py-3 px-4 font-semibold whitespace-nowrap">Type</th>
                                            <th className="py-3 px-4 font-semibold text-left whitespace-nowrap">Details</th>
                                            <th className="py-3 px-4 text-right font-semibold whitespace-nowrap">Prices (S / B)</th>
                                            <th className="py-3 px-4 text-right font-semibold whitespace-nowrap">Gross PnL</th>
                                            <th className="py-3 px-4 text-right font-semibold whitespace-nowrap">Net PnL</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {tradeLog.map((t, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50/50 transition-colors group">
                                                <td className="py-3 px-4 text-left font-medium text-gray-600 whitespace-nowrap">{t.date}</td>
                                                <td className="py-3 px-4 whitespace-nowrap">
                                                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide ${t.type === 'Compounding' ? 'bg-purple-50 text-purple-700 border border-purple-100' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                                                        {t.type}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-left text-gray-500 text-xs whitespace-nowrap">
                                                    <div>{t.contracts}</div>
                                                    {t.lots > 1 && <div className="text-[10px] text-gray-400 mt-0.5">Size: {t.lots} kg</div>}
                                                </td>
                                                <td className="py-3 px-4 text-right text-gray-500 text-xs font-mono whitespace-nowrap">
                                                    {t.sellPrice ? <div className="flex justify-end gap-2"><span>{t.sellPrice}</span><span className="text-gray-300">→</span><span className="text-gray-700 font-bold">{t.buyPrice}</span></div> : '-'}
                                                </td>
                                                <td className={`py-3 px-4 text-right font-medium text-xs whitespace-nowrap ${t.grossPnL > 0 ? 'text-emerald-600' : t.grossPnL < 0 ? 'text-rose-500' : 'text-gray-400'}`}>
                                                    {t.grossPnL ? `₹${Math.round(t.grossPnL).toLocaleString()}` : '-'}
                                                    {t.cost > 0 && <div className="text-[10px] text-gray-400 mt-0.5 font-normal">Cost: -{t.cost}</div>}
                                                </td>
                                                <td className={`py-3 px-4 text-right font-bold text-sm whitespace-nowrap ${t.netPnL > 0 ? 'text-emerald-600' : t.netPnL < 0 ? 'text-rose-500' : 'text-gray-400'}`}>
                                                    {t.netPnL ? `₹${Math.round(t.netPnL).toLocaleString()}` : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Components ---
const LabelRow = ({ label, icon }) => (
    <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs font-bold text-gray-700 uppercase tracking-widest">{label}</span>
    </div>
);

const InputField = (props) => (
    <input
        {...props}
        className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all bg-gray-50 focus:bg-white text-gray-900 font-medium placeholder-gray-400"
    />
);

const StatCard = ({ label, value, highlight, color = "text-gray-900", subtitle }) => (
    <div className={`p-4 md:p-5 rounded-xl border flex flex-col justify-between h-28 ${highlight ? 'bg-indigo-50/50 border-indigo-100 shadow-sm' : 'bg-white border-gray-100 hover:border-gray-200 transition-colors'}`}>
        <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">{label}</p>
        <div>
            <p className={`text-lg md:text-xl font-extrabold tracking-tight ${color}`}>{value}</p>
            {subtitle && <p className="text-[10px] text-gray-400 mt-1 font-medium">{subtitle}</p>}
        </div>
    </div>
);

const parserSigned = (val) => {
    const v = parseFloat(val);
    return v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1);
}

export default BacktestPanel;
