
import os
import glob
import pandas as pd

DIR = "gold_daily_ohlc"

def generate_coverage_report():
    files = glob.glob(os.path.join(DIR, "*.csv"))
    # Extract expiries: 05FEB2024.csv -> 05FEB2024
    expiries = [os.path.basename(f).replace('.csv', '') for f in files]
    
    # Parse into (Year, Month)
    parsed = []
    for e in expiries:
        # Format: DDMMMYYYY (e.g. 05FEB2024)
        try:
            month_str = e[2:5]
            year_str = e[5:]
            parsed.append((int(year_str), month_str))
        except:
            pass
            
    # Define standard loop
    months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
    start_year = 2014
    end_year = 2026
    
    print(f"{'YEAR':<6} {' '.join([m[:3] for m in months])}")
    print("-" * 60)
    
    for year in range(start_year, end_year + 1):
        row = f"{year:<6} "
        for month in months:
            # Check if this month exists in parsed for this year
            exists = (year, month) in parsed
            marker = "YES" if exists else " . "
            row += f"{marker:<4}"
        print(row)

if __name__ == "__main__":
    generate_coverage_report()
