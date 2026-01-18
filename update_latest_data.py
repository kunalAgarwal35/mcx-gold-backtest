"""
Script to update the latest OHLC data for recent expiries.
Fetches data up to today's date for active contracts.
"""

import os
import time
import logging
from datetime import datetime, timedelta
from mcx_bhavcopy import MCXBhavcopyFetcher

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

OUTPUT_DIR = "gold_daily_ohlc"

def get_recent_expiries():
    """Get recent expiries that might need updating (last 6 months)"""
    today = datetime.now()
    six_months_ago = today - timedelta(days=180)
    
    # Get all expiries from fetch_gold_history
    from fetch_gold_history import get_validated_expiries
    all_expiries = get_validated_expiries()
    
    recent_expiries = []
    for expiry_str in all_expiries:
        try:
            expiry_date = datetime.strptime(expiry_str, "%d%b%Y")
            # Include expiries from last 6 months and future expiries
            if expiry_date >= six_months_ago:
                recent_expiries.append(expiry_str)
        except:
            continue
    
    return sorted(recent_expiries, reverse=True)  # Most recent first

def update_expiry_data(expiry_str, fetcher):
    """Update data for a specific expiry up to today"""
    output_file = os.path.join(OUTPUT_DIR, f"{expiry_str}.csv")
    
    # Calculate date range: from 200 days before expiry to today (or expiry, whichever is earlier)
    expiry_date = datetime.strptime(expiry_str, "%d%b%Y")
    start_date = expiry_date - timedelta(days=200)
    end_date = min(expiry_date, datetime.now())
    
    from_date_str = start_date.strftime("%m/%d/%Y")
    to_date_str = end_date.strftime("%m/%d/%Y")
    
    logger.info(f"Updating {expiry_str}: {from_date_str} to {to_date_str}")
    
    try:
        df = fetcher.fetch_date_range(
            symbol='GOLD',
            expiry=expiry_str,
            from_date=from_date_str,
            to_date=to_date_str
        )
        
        if not df.empty:
            fetcher.export_to_csv(df, output_file)
            logger.info(f"Updated {output_file} with {len(df)} records")
            return True
        else:
            logger.warning(f"No data found for {expiry_str}")
            return False
    except Exception as e:
        logger.error(f"Error updating {expiry_str}: {e}")
        return False

def main():
    """Update latest data for recent expiries"""
    logger.info("Starting latest data update...")
    
    # Create output directory if needed
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
    
    # Get recent expiries
    recent_expiries = get_recent_expiries()
    logger.info(f"Found {len(recent_expiries)} recent expiries to update")
    
    # Initialize fetcher
    fetcher = MCXBhavcopyFetcher()
    
    # Update each expiry
    success_count = 0
    for i, expiry in enumerate(recent_expiries):
        if i > 0 and i % 10 == 0:
            logger.info("Refreshing session...")
            fetcher = MCXBhavcopyFetcher()
            time.sleep(2)
        
        if update_expiry_data(expiry, fetcher):
            success_count += 1
        
        time.sleep(1.5)  # Rate limiting
    
    logger.info(f"Update complete. Successfully updated {success_count}/{len(recent_expiries)} expiries")

if __name__ == "__main__":
    main()
