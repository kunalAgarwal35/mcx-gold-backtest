
from mcx_bhavcopy import MCXBhavcopyFetcher
import logging
import pandas as pd

logging.basicConfig(level=logging.INFO)

def test_dates():
    fetcher = MCXBhavcopyFetcher()
    
    # Target: 04APR2025 (Expiry)
    # Goal: Get data from Jan 4, 2025 to Apr 4, 2025
    
    print("--- Testing 04APR2025 ---")
    
    # Format A: DD/MM/YYYY
    # Start: 04/01/2025 (Jan 4)
    # End: 04/04/2025 (Apr 4)
    print("\nTest A: DD/MM/YYYY ('04/01/2025' - '04/04/2025')")
    try:
        df = fetcher.fetch_date_range(
            symbol='GOLD',
            expiry='04APR2025',
            from_date='04/01/2025',
            to_date='04/04/2025'
        )
        print(f"Result: {len(df)} records")
        if not df.empty:
            print("First Date:", df.iloc[0]['Date'])
            print("Last Date:", df.iloc[-1]['Date'])
    except Exception as e:
        print(f"Error: {e}")

    # Format B: MM/DD/YYYY
    # Start: 01/04/2025 (Jan 4)
    # End: 04/04/2025 (Apr 4)
    print("\nTest B: MM/DD/YYYY ('01/04/2025' - '04/04/2025')")
    try:
        df = fetcher.fetch_date_range(
            symbol='GOLD',
            expiry='04APR2025',
            from_date='01/04/2025',
            to_date='04/04/2025'
        )
        print(f"Result: {len(df)} records")
        if not df.empty:
            print("First Date:", df.iloc[0]['Date'])
            print("Last Date:", df.iloc[-1]['Date'])
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_dates()
