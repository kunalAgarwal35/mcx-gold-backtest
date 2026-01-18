# Rollover Issue Fix - Summary

## Problem Identified

The backtest was performing rollovers **after** expiry dates, which is incorrect. Analysis revealed:
- **55 rollovers** were happening 30-35 days **after** the expiry date
- Only **17 rollovers** were happening **before** expiry (correct behavior)
- **0 rollovers** on the expiry date itself

### Root Cause

1. In `process_analysis.py`, expired contracts are filtered out: `valid_expiries = daily_data[daily_data['ExpiryDate'] >= current_date]`
2. When a contract expires, it disappears from the data
3. The next trading day, `expiry_near` changes to the next available contract
4. The backtest logic in `BacktestPanel.jsx` was triggering rollovers whenever `expiry_near` changed, without checking if the expiry date had passed
5. This resulted in rollovers happening 30+ days after expiry, which is incorrect

### Example of the Problem

- Contract expires on: **2014-02-05**
- Next trading day with data: **2014-03-07** (30 days later)
- Backtest sees `expiry_near` changed from `05Feb2014` to `05Apr2014`
- Backtest performs rollover on **2014-03-07** (30 days AFTER expiry) ❌

## Solution Implemented

### 1. Added Expiry Date Fields to Data

**File:** `process_analysis.py`
- Added `expiry_near_date` and `expiry_far_date` fields to the JSON output
- These fields contain the expiry date in `YYYY-MM-DD` format for easy date comparison

```python
results.append({
    "date": current_date.strftime('%Y-%m-%d'),
    "premium": round(annualized_premium, 2),
    "price_near": p1,
    "price_far": p2,
    "expiry_near": e1['ExpiryDate'].strftime('%d%b%Y'),
    "expiry_far": e2['ExpiryDate'].strftime('%d%b%Y'),
    "expiry_near_date": e1['ExpiryDate'].strftime('%Y-%m-%d'),  # NEW
    "expiry_far_date": e2['ExpiryDate'].strftime('%Y-%m-%d')    # NEW
})
```

### 2. Fixed Backtest Rollover Logic

**File:** `gold_analysis_dashboard/src/components/BacktestPanel.jsx`

**Before:**
```javascript
if (prev && today.expiry_near !== prev.expiry_near) {
    // Always rollover when expiry_near changes
}
```

**After:**
```javascript
if (prev && today.expiry_near !== prev.expiry_near) {
    const prevExpiryDate = prev.expiry_near_date || null;
    const todayDate = new Date(today.date);
    
    let shouldRollover = true;
    if (prevExpiryDate) {
        const expiryDate = new Date(prevExpiryDate);
        // Only rollover if today <= expiry date (before or on expiry)
        shouldRollover = todayDate <= expiryDate;
    }
    
    if (shouldRollover) {
        // Perform rollover
    }
}
```

### Key Changes:
- Check if expiry date information is available
- Only rollover if `today <= expiry_date` (before or on expiry)
- Block rollovers that would happen after expiry
- Maintain backward compatibility if expiry date info is missing

## Verification Results

After implementing the fix:

✅ **0 rollovers** happening after expiry (was 55)
✅ **17 rollovers** happening before expiry (correct)
✅ **55 rollovers** now blocked (the problematic ones)

### Verification Script Output:
```
Total expiry_near changes detected: 72
  - Would rollover AFTER expiry: 0 [SHOULD BE 0] ✅
  - Would rollover ON expiry date: 0 [OK]
  - Would rollover BEFORE expiry: 17 [OK] ✅
  - Rollovers BLOCKED (after expiry): 55 [FIXED!] ✅
```

## Files Modified

1. `process_analysis.py` - Added expiry date fields to JSON output
2. `gold_analysis_dashboard/src/components/BacktestPanel.jsx` - Fixed rollover logic to check expiry dates
3. `gold_analysis_dashboard/public/data.json` - Regenerated with expiry date fields

## Testing

Run the verification script to confirm the fix:
```bash
python verify_backtest_rollovers.py
```

## Notes

- The 7-day rollover rule in `process_analysis.py` ensures contracts are switched before expiry when there are < 7 days remaining
- The backtest now correctly handles rollovers that should happen before expiry
- Rollovers after expiry are now blocked, preventing incorrect trade execution
- The fix maintains backward compatibility with data that doesn't have expiry date fields
