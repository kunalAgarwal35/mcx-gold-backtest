
import os
import time
import logging
from fetch_gold_history import get_validated_expiries, get_date_range
from mcx_bhavcopy import MCXBhavcopyFetcher

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

OUTPUT_DIR = "gold_daily_ohlc"

def audit_and_fetch_missing():
    expiries = get_validated_expiries()
    missing_expiries = []
    
    logger.info(f"Auditing {len(expiries)} expected expiries...")
    
    # 1. Audit
    for expiry in expiries:
        file_path = os.path.join(OUTPUT_DIR, f"{expiry}.csv")
        
        # Check if file exists
        if not os.path.exists(file_path):
            logger.warning(f"MISSING: {expiry}")
            missing_expiries.append(expiry)
            continue
            
        # Check file size (files < 2KB are essentially empty/headers only)
        # A valid file with 90 days of data is typically > 9KB
        size = os.path.getsize(file_path)
        if size < 2048:
            logger.warning(f"INCOMPLETE: {expiry} (Size: {size} bytes)")
            missing_expiries.append(expiry)
            # Delete incomplete file so we can clean write
            try:
                os.remove(file_path)
            except:
                pass

    logger.info(f"Audit Complete. Found {len(missing_expiries)} missing/incomplete expiries.")
    
    if not missing_expiries:
        logger.info("No missing data found. Analysis is up to date.")
        return

    # 2. Fetch Missing
    logger.info("Starting recovery fetch for missing expiries...")
    fetcher = MCXBhavcopyFetcher()
    
    for i, expiry in enumerate(missing_expiries):
        # Refresh session every 10 requests
        if i > 0 and i % 10 == 0:
            logger.info("Refreshing session...")
            fetcher = MCXBhavcopyFetcher()
            time.sleep(2)
            
        logger.info(f"Recovering {i+1}/{len(missing_expiries)}: {expiry}")
        output_file = os.path.join(OUTPUT_DIR, f"{expiry}.csv")
        
        try:
            from_date, to_date = get_date_range(expiry)
            logger.info(f"Fetching range: {from_date} to {to_date}")
            
            df = fetcher.fetch_date_range(
                symbol='GOLD',
                expiry=expiry,
                from_date=from_date,
                to_date=to_date
            )
            
            if not df.empty:
                fetcher.export_to_csv(df, output_file)
                logger.info(f"Success: Saved {len(df)} records for {expiry}")
            else:
                logger.warning(f"Failed: No data returned for {expiry}")
                
            time.sleep(1.5)
            
        except Exception as e:
            logger.error(f"Error fetching {expiry}: {e}")
            time.sleep(2)

if __name__ == "__main__":
    audit_and_fetch_missing()
