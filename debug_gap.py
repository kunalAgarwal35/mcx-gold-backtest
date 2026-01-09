
import pandas as pd
import os

DIR = "gold_daily_ohlc"

def debug_gap():
    # Check 04APR2025
    f1 = os.path.join(DIR, "04APR2025.csv")
    if os.path.exists(f1):
        df1 = pd.read_csv(f1)
        print(f"--- {os.path.basename(f1)} ---")
        print(f"Rows: {len(df1)}")
        if not df1.empty:
            print(f"Min Date: {df1['Date'].min()}")
            print(f"Max Date: {df1['Date'].max()}")
            
    # Check 05JUN2025
    f2 = os.path.join(DIR, "05JUN2025.csv")
    if os.path.exists(f2):
        df2 = pd.read_csv(f2)
        print(f"\n--- {os.path.basename(f2)} ---")
        print(f"Rows: {len(df2)}")
        if not df2.empty:
            print(f"Min Date: {df2['Date'].min()}")
            print(f"Max Date: {df2['Date'].max()}")

if __name__ == "__main__":
    debug_gap()
