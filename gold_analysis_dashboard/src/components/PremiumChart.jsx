import { useState, useEffect } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, AlertCircle, Maximize2, Minimize2, ArrowLeft } from "lucide-react";

const PremiumChart = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isFullScreen, setIsFullScreen] = useState(false);

    useEffect(() => {
        fetch("/data.json")
            .then((res) => {
                if (!res.ok) throw new Error("Failed to load data");
                return res.json();
            })
            .then((jsonData) => {
                setData(jsonData);
                setLoading(false);
            })
            .catch((err) => {
                console.error(err);
                setError(err.message);
                setLoading(false);
            });
    }, []);

    const toggleFullScreen = () => setIsFullScreen(!isFullScreen);

    if (loading) return <div className="text-center p-10">Loading analysis data...</div>;
    if (error) return <div className="text-center p-10 text-red-500">Error: {error}</div>;

    const containerClass = isFullScreen
        ? "fixed inset-0 z-[100] w-screen h-screen bg-white p-1 md:p-2 flex flex-col overflow-hidden transition-all duration-300"
        : "w-full min-h-[600px] p-2 md:p-6 bg-white rounded-xl shadow-lg border border-gray-100 flex flex-col transition-all duration-300 relative";

    const chartHeightClass = isFullScreen
        ? "flex-1 w-full min-h-0"
        : "h-[450px] w-full shrink-0";

    return (
        <div className={containerClass}>
            {/* Header */}
            <div className={`shrink-0 flex justify-between items-start ${isFullScreen ? 'mb-2 px-2 pt-2' : 'mb-4'}`}>
                <div className="flex flex-col gap-1">
                    {isFullScreen ? (
                        <button
                            onClick={toggleFullScreen}
                            className="flex items-center gap-2 text-gray-600 font-bold px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors w-fit mb-1 text-xs"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </button>
                    ) : null}

                    <h2 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-yellow-600" />
                        Gold Futures Annualized Premium %
                    </h2>
                    {!isFullScreen && (
                        <p className="text-gray-500 text-sm">
                            Historical analysis of annualized rolling premium.
                        </p>
                    )}
                </div>

                <button
                    onClick={toggleFullScreen}
                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                    title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
                >
                    {isFullScreen ? <Minimize2 className="w-6 h-6" /> : <Maximize2 className="w-5 h-5" />}
                </button>
            </div>

            {/* Chart */}
            <div className={chartHeightClass}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorPremium" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ca8a04" stopOpacity={0.1} />
                                <stop offset="95%" stopColor="#ca8a04" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#166534" stopOpacity={0.1} />
                                <stop offset="95%" stopColor="#166534" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 12, fill: '#6b7280' }}
                            tickFormatter={(str) => {
                                const d = new Date(str);
                                return `${d.getFullYear()}`;
                            }}
                            minTickGap={50}
                        />
                        <YAxis
                            yAxisId="left"
                            dataKey="premium"
                            tick={{ fontSize: 12, fill: '#6b7280' }}
                            unit="%"
                        />
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            dataKey="price_near"
                            domain={['auto', 'auto']}
                            tick={{ fontSize: 12, fill: '#166534' }}
                            tickFormatter={(val) => `₹${val / 1000}k`}
                            axisLine={false}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            labelStyle={{ fontWeight: 'bold', color: '#1f2937', marginBottom: '8px', fontSize: '14px' }}
                            formatter={(value, name, props) => {
                                if (name === "premium") return [`${value}%`, 'Annualized Premium'];
                                if (name === "price_near") {
                                    // Construct Contract Name: e.g. 05AUG2025 -> GOLDAUG25FUT
                                    // props.payload contains the full data item
                                    const exp = props?.payload?.expiry_near;
                                    let label = 'Gold Price';
                                    if (exp && exp.length >= 9) {
                                        const mmm = exp.substring(2, 5);
                                        const yy = exp.substring(7, 9);
                                        label = `GOLD${mmm}${yy}FUT`;
                                    }
                                    return [`₹${value.toLocaleString()}`, label];
                                }
                                return [value, name];
                            }}
                            labelFormatter={(label) => {
                                const d = data.find(item => item.date === label);
                                if (!d) return label;
                                const dateObj = new Date(label);
                                const formattedDate = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

                                const formatExp = (expStr) => {
                                    if (!expStr || expStr.length < 9) return expStr;
                                    return `${expStr.substring(2, 5)} '${expStr.substring(7, 9)}`;
                                };

                                return (
                                    <div className="space-y-1">
                                        <p className="text-base text-gray-900">{formattedDate}</p>
                                        <div className="text-xs font-normal text-gray-500 flex flex-col gap-0.5 mt-1 border-t border-gray-100 pt-1">
                                            <div className="flex justify-between gap-4">
                                                <span>Near: {formatExp(d.expiry_near)}</span>
                                                <span className="font-mono text-gray-700">₹{d.price_near?.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between gap-4">
                                                <span>Far: {formatExp(d.expiry_far)}</span>
                                                <span className="font-mono text-gray-700">₹{d.price_far?.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        <Area
                            yAxisId="right"
                            type="monotone"
                            dataKey="price_near"
                            name="Gold Price"
                            stroke="#166534"
                            fill="url(#colorPrice)"
                            fillOpacity={1}
                            strokeWidth={1}
                        />
                        <Area
                            yAxisId="left"
                            type="monotone"
                            dataKey="premium"
                            name="Annualized Premium"
                            stroke="#ca8a04"
                            fillOpacity={1}
                            fill="url(#colorPremium)"
                            strokeWidth={2}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Methodology Footer - Hidden in Full Screen */}
            {!isFullScreen && (
                <div className="mt-6 flex items-start gap-3 bg-indigo-50/50 p-4 rounded-xl border border-indigo-50 text-xs text-slate-600 leading-relaxed shrink-0">
                    <AlertCircle className="w-4 h-4 mt-0.5 text-indigo-500 flex-shrink-0" />
                    <div>
                        <strong className="block text-indigo-900 mb-1">Rollover Methodology - 7 Day Rule</strong>
                        <p>
                            The chart tracks the premium of the <strong>Near Month</strong> contract relative to the <strong>Far Month</strong> contract.
                            To simulate a continuous perpetual position, we switch (roll over) from the Near contract to the Far contract exactly
                            <strong> 7 days before the Near contract expires</strong>. This avoids the volatility and liquidity risks often seen in the final week of expiry.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PremiumChart;
