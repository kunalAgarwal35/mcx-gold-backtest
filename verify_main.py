
import os
import glob
import pandas as pd
import logging

logging.basicConfig(level=logging.INFO)
DIR = "gold_daily_ohlc"

def verify_main_contracts():
    files = glob.glob(os.path.join(DIR, "*.csv"))
    expiries = [os.path.basename(f).replace('.csv', '') for f in files]
    
    # Standard Main Months: Feb, Apr, Jun, Aug, Oct, Dec
    # We want to check coverage for last few years
    years = ['2023', '2024', '2025']
    months = ['FEB', 'APR', 'JUN', 'AUG', 'OCT', 'DEC']
    
    missing_main = []
    present_main = []
    
    print("--- Verifying Main Contracts (Feb, Apr, Jun, Aug, Oct, Dec) ---")
    
    for year in years:
        for month in months:
            # Find any expiry matching Month+Year
            # e.g. *APR2024*
            matches = [e for e in expiries if month in e and year in e]
            
            if matches:
                # Check absolute size
                valid_matches = []
                for m in matches:
                    size = os.path.getsize(os.path.join(DIR, f"{m}.csv"))
                    if size > 2000:
                        valid_matches.append(f"{m} ({size} b)")
                
                if valid_matches:
                    present_main.append(f"{month} {year}: {valid_matches}")
                else:
                    missing_main.append(f"{month} {year} (Files exist but small: {matches})")
            else:
                missing_main.append(f"{month} {year}")

    print("\n--- Present ---")
    for p in present_main:
        print(p)
        
    print("\n--- MISSING MAIN ---")
    for m in missing_main:
        print(m)

if __name__ == "__main__":
    verify_main_contracts()
