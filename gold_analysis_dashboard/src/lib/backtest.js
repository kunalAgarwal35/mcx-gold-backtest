// Long-only rolling backtest of MCX GOLD (1 kg) futures over the rows in public/data.json.
//
// Each row carries the closes of two contracts: `near` (the one to hold) and `far` (the next one).
// process_analysis.py already moves `near` to the next contract once the nearest has fewer than
// 7 days left, so the held contract always appears in the row before it is dropped.
//
// Rolls sell the old contract and buy the new one at the SAME day's close. (Before 2026-11-25 the
// engine sold at the previous day's close and bought at today's, which skipped the held contract's
// move on every roll day.)

export const CONTRACT_MULTIPLIER = 100; // Rs per Rs 1/10 g move on a 1 kg lot
export const ROLL_DAYS = 7;
export const DEFAULT_HALVING_FACTOR = 50; // % of equity lost since the last resize
export const DEFAULT_MARGIN_CALL_PERCENT = 10; // exchange margin per lot, % of its notional

const DAY_MS = 24 * 60 * 60 * 1000;
const daysBetween = (fromIso, toIso) => Math.round((new Date(toIso) - new Date(fromIso)) / DAY_MS);

// Close of `contract` on `row`, or null when the row does not quote it.
const closeOf = (row, contract) => {
    if (row.expiry_near === contract) return row.price_near;
    if (row.expiry_far === contract) return row.price_far;
    return null;
};

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

/**
 * Run the backtest. Returns null when the window holds fewer than two rows, else
 * { stats, equitySeries, drawdownSeries, yoy, trades } with trades oldest first.
 */
export function simulateBacktest(fullData, config) {
    if (!fullData || fullData.length === 0) return null;
    const data = fullData.filter(d => d.date >= config.startDate && d.date <= config.endDate);
    if (data.length < 2) return null;

    let currentLots = config.initialLots;
    const halvingFactor = config.halvingFactor ?? DEFAULT_HALVING_FACTOR;
    const marginCallPercent = config.marginCallPercent ?? DEFAULT_MARGIN_CALL_PERCENT;
    const startPrice = data[0].price_near;
    const initialCapital = startPrice * CONTRACT_MULTIPLIER * currentLots * (config.initialMarginPercent / 100);

    let cash = initialCapital;
    let baselineCapital = initialCapital;
    let peakEquity = initialCapital;

    let held = data[0].expiry_near;           // contract held, e.g. "05Feb2014"
    let heldExpiry = data[0].expiry_near_date; // its expiry, "2014-02-05"
    let entryPrice = startPrice;               // average entry price of the open lots
    let lastClose = startPrice;
    let lastCloseDate = data[0].date;

    const equitySeries = [];
    const drawdownSeries = [];
    const trades = [];

    const roll = (date, sellPrice, buyPrice, newContract, newExpiry, note) => {
        const rawPnL = (sellPrice - entryPrice) * CONTRACT_MULTIPLIER * currentLots;
        const cost = config.transactionCost * currentLots;
        const netPnL = rawPnL - cost;
        cash += netPnL;
        trades.push({
            date,
            type: "Rollover",
            contracts: `${held} → ${newContract}`,
            sellPrice,
            buyPrice,
            lots: currentLots,
            grossPnL: rawPnL,
            cost,
            netPnL,
            equity: cash,
            note
        });
        held = newContract;
        heldExpiry = newExpiry;
        entryPrice = buyPrice;
    };

    // Sell `soldLots` at today's close: their P&L is booked to cash, so equity is unchanged.
    const sellLots = (soldLots, heldClose) => {
        const realised = (heldClose - entryPrice) * CONTRACT_MULTIPLIER * soldLots;
        cash += realised;
        currentLots -= soldLots;
        return realised;
    };

    // One trading day with an open position: roll if due, mark to market at the held contract's
    // close, then apply a margin call or a compounding resize. Returns the day's closing equity.
    const tradeDay = (today, next) => {
        let heldClose = closeOf(today, held);

        if (heldClose === null) {
            // Safety net: the row no longer quotes the held contract. The roll below should
            // always happen first, so this only fires on data the generator did not produce.
            roll(today.date, lastClose, today.price_near, today.expiry_near, today.expiry_near_date,
                `Held contract missing from data; sold at its ${lastCloseDate} close`);
            heldClose = today.price_near;
        } else if (today.expiry_near === held && today.expiry_far) {
            const daysToExpiry = daysBetween(today.date, heldExpiry);
            // Roll at today's close when within 7 days of expiry, or when the next row will no
            // longer quote the held contract (a gap in the data would otherwise strand it).
            const nextDropsHeld = next !== null && closeOf(next, held) === null;
            if (daysToExpiry <= ROLL_DAYS || nextDropsHeld) {
                const note = daysToExpiry <= ROLL_DAYS
                    ? `7-day rule (${daysToExpiry} days to expiry)`
                    : `Next quote ${next.date} drops ${held} (${daysToExpiry} days to expiry)`;
                roll(today.date, today.price_near, today.price_far, today.expiry_far, today.expiry_far_date, note);
                heldClose = today.price_far;
            }
        }
        lastClose = heldClose;
        lastCloseDate = today.date;

        // Mark to market at the held contract's own close
        const currentEquity = cash + (heldClose - entryPrice) * CONTRACT_MULTIPLIER * currentLots;

        // Margin call (daily, at the close; intraday breaches are not seen). The exchange margin
        // for a lot is marginCallPercent% of its notional. When equity cannot cover the margin on
        // the open lots, the broker cuts them to as many as equity covers, at today's close; when
        // it cannot cover one lot the position is closed and the account stays flat. 0 turns this off.
        const marginPerLot = marginCallPercent > 0
            ? heldClose * CONTRACT_MULTIPLIER * (marginCallPercent / 100)
            : 0;
        if (marginPerLot > 0 && currentEquity < currentLots * marginPerLot) {
            const lotsBefore = currentLots;
            const keptLots = currentEquity > 0 ? Math.floor(currentEquity / marginPerLot) : 0;
            const realised = sellLots(lotsBefore - keptLots, heldClose);
            if (currentEquity > 0) baselineCapital = currentEquity;
            trades.push({
                date: today.date,
                type: "Margin Call",
                contracts: keptLots > 0 ? `Lots cut ${lotsBefore} → ${keptLots}` : `Position closed (${lotsBefore} lot${lotsBefore === 1 ? '' : 's'})`,
                lots: keptLots,
                grossPnL: realised,
                netPnL: realised,
                equity: currentEquity,
                note: `Equity ${Math.round(currentEquity)} below margin ${Math.round(lotsBefore * marginPerLot)}`
            });
            return currentEquity;
        }

        // Compounding check (daily, at the close). Both rules measure against the equity at the
        // last resize (`baselineCapital`, the starting capital until the first one):
        //  - double the lots once equity has gained compoundingFactor% of it, if equity covers the
        //    margin on the doubled lots (otherwise wait). Added lots are bought at today's close,
        //    so the average entry moves and no past gain is credited to them.
        //  - halve the lots (whole lots, never below 1) once equity has lost halvingFactor% of it.
        // The baseline only ever moves to a positive equity: equity can still gap below zero
        // between two closes, and a % of a negative number would turn both rules upside down.
        // Neither resize charges transactionCost; that is charged per lot on each roll.
        if (!config.neverCompound && config.isCompounding) {
            if (config.compoundingFactor > 0 &&
                currentEquity - baselineCapital >= (config.compoundingFactor / 100) * baselineCapital) {
                if (currentEquity >= 2 * currentLots * marginPerLot) {
                    entryPrice = (entryPrice + heldClose) / 2;
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
            } else if (halvingFactor > 0 && currentLots > 1 &&
                baselineCapital - currentEquity >= (halvingFactor / 100) * baselineCapital) {
                const realised = sellLots(currentLots - Math.max(1, Math.floor(currentLots / 2)), heldClose);
                if (currentEquity > 0) baselineCapital = currentEquity;
                trades.push({
                    date: today.date,
                    type: "Compounding",
                    contracts: "Position Halved",
                    lots: currentLots,
                    grossPnL: realised,
                    netPnL: realised,
                    equity: currentEquity,
                    note: "Loss Limit Hit"
                });
            }
        }
        return currentEquity;
    };

    for (let i = 0; i < data.length; i++) {
        const today = data[i];
        const currentEquity = currentLots === 0
            ? cash // closed out by a margin call: flat for the rest of the window
            : tradeDay(today, i + 1 < data.length ? data[i + 1] : null);

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

    const finalEq = equitySeries[equitySeries.length - 1].equity;
    const totalRet = ((finalEq - initialCapital) / initialCapital) * 100;

    const startD = new Date(config.startDate);
    const endD = new Date(config.endDate);
    const years = Math.max(1, (endD - startD) / (DAY_MS * 365.25));
    // Equity can still gap below zero between two closes; report that as -100% a year.
    const cagr = finalEq > 0 ? (Math.pow(finalEq / initialCapital, 1 / years) - 1) * 100 : -100;

    const yoy = calculateYoY(equitySeries);
    const avgAnnualRet = yoy.reduce((acc, curr) => acc + parseFloat(curr.return), 0) / yoy.length;

    // Drawdown axis: keep the worst drawdown in the bottom 30% of the chart (minimum 30%).
    const maxDDValue = Math.max(...equitySeries.map(e => parseFloat(e.drawdown)));
    const drawdownAxisMax = maxDDValue > 0 ? Math.max(30, Math.ceil(maxDDValue / 0.3)) : 30;

    return {
        stats: {
            initialCapital,
            finalCapital: finalEq,
            totalReturn: totalRet,
            cagr,
            avgAnnualRet,
            maxDD: maxDDValue,
            maxLots: Math.max(...equitySeries.map(e => e.lots)),
            drawdownAxisMax
        },
        equitySeries,
        drawdownSeries,
        yoy,
        trades
    };
}
