"""
Script to process aggregated daily OHLC data for Gold Futures and calculate
Annualized % Premium.

Logic:
1. Load all CSVs from `gold_daily_ohlc/`
2. Aggregate into a single DataFrame
3. For each trading date:
   - Identify active expiries
   - Select Nearest (E1) and Next Nearest (E2)
   - Apply 7-day rollover rule: If (E1 - Date) < 7 days, shift to E2 & E3
   - Calculate Premium: (Close(E2) - Close(E1)) / Close(E1)
   - Annualize: Premium * (365 / (E2_Date - E1_Date)) * 100
4. Export to `gold_analysis_dashboard/public/data.json`
"""

import os
import glob
import json
import logging
import pandas as pd
from datetime import datetime, timedelta

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

INPUT_DIR = "gold_daily_ohlc"
OUTPUT_FILE = os.path.join("gold_analysis_dashboard", "public", "data.json")

def load_data():
    """Load all CSV files into a single DataFrame"""
    all_files = glob.glob(os.path.join(INPUT_DIR, "*.csv"))
    df_list = []
    
    logger.info(f"Found {len(all_files)} files in {INPUT_DIR}")
    
    for filename in all_files:
        try:
            df = pd.read_csv(filename)
            # Ensure required columns exist
            if 'Date' not in df.columns or 'ExpiryDate' not in df.columns or 'Close' not in df.columns:
                logger.warning(f"Skipping {filename}: Missing required columns")
                continue
                
            # Standardize date format
            # The CSVs have 'Date' as YYYY-MM-DD (from pandas to_csv default) or similar
            # We need standard datetime objects
            df['Date'] = pd.to_datetime(df['Date'])
            df['ExpiryDate'] = pd.to_datetime(df['ExpiryDate'], format='%d%b%Y') 
            
            # Keep only relevant columns
            df = df[['Date', 'ExpiryDate', 'Close']]
            df_list.append(df)
            
        except Exception as e:
            logger.error(f"Error reading {filename}: {e}")
            
    if not df_list:
        raise ValueError("No valid data files loaded")
        
    combined_df = pd.concat(df_list, ignore_index=True)
    logger.info(f"Loaded {len(combined_df)} total records")
    return combined_df

def calculate_premium(df):
    """Calculate annualized premium daily"""
    
    results = []
    
    # Get unique trading dates sorted
    unique_dates = sorted(df['Date'].unique())
    logger.info(f"Processing {len(unique_dates)} trading dates")
    
    # Pre-group by date for faster access
    groups = df.groupby('Date')
    
    for current_date in unique_dates:
        # Get all records for this date
        try:
            daily_data = groups.get_group(current_date)
        except KeyError:
            continue
            
        # Filter expiries that are in the future (or today)
        # Convert daily_data['ExpiryDate'] to datetime if not already (it should be)
        valid_expiries = daily_data[daily_data['ExpiryDate'] >= current_date].sort_values('ExpiryDate')
        
        if len(valid_expiries) < 2:
            continue
            
        # Get sorted expiry records
        expiries_list = valid_expiries.to_dict('records')
        
        # Initial Selection: Nearest (E1) and Next Nearest (E2)
        e1 = expiries_list[0]
        e2 = expiries_list[1]
        
        # Check 7-day rollover rule
        days_to_expiry_1 = (e1['ExpiryDate'] - current_date).days
        
        # Rule: skip nearest if expiry is just one week away (< 7 days)
        # User said: "except when the expiry is just one week away, if that is the case we will skip to next and the next next"
        if days_to_expiry_1 < 7:
            if len(expiries_list) < 3:
                # Not enough expiries to roll over
                continue
            e1 = expiries_list[1]
            e2 = expiries_list[2]
            
        # Calculate Premium
        p1 = e1['Close']
        p2 = e2['Close']
        
        if p1 == 0:  # Avoid division by zero
            continue
            
        price_diff = p2 - p1
        
        # Expiry difference in days
        expiry_diff_days = (e2['ExpiryDate'] - e1['ExpiryDate']).days
        
        if expiry_diff_days == 0:
            continue
            
        # Normalized Annualized Premium (User Formula)
        # premium = x / y = price_diff / p1
        # normalized = (365 / days_diff) * premium * 100
        
        raw_premium = price_diff / p1
        annualized_premium = (365 / expiry_diff_days) * raw_premium * 100
        
        results.append({
            "date": current_date.strftime('%Y-%m-%d'),
            "premium": round(annualized_premium, 2),
            "price_near": p1,
            "price_far": p2,
            "expiry_near": e1['ExpiryDate'].strftime('%d%b%Y'),
            "expiry_far": e2['ExpiryDate'].strftime('%d%b%Y'),
            "expiry_near_date": e1['ExpiryDate'].strftime('%Y-%m-%d'),  # Add expiry date for backtest validation
            "expiry_far_date": e2['ExpiryDate'].strftime('%Y-%m-%d')
        })
        
    return results

def main():
    try:
        # Load and Process
        df = load_data()
        results = calculate_premium(df)
        
        # Check output dir
        os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
        
        # Save to JSON
        with open(OUTPUT_FILE, 'w') as f:
            json.dump(results, f, indent=2)
            
        logger.info(f"Successfully saved analysis data to {OUTPUT_FILE}")
        logger.info(f"Total data points: {len(results)}")
        
    except Exception as e:
        logger.error(f"Processing failed: {e}")

if __name__ == "__main__":
    main()
