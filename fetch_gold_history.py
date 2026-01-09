"""
Script to fetch historical GOLD futures data from 2014 to present.
Generates CSV files for each expiry containing 90 days of daily OHLC data.
"""

import os
import time
import logging
import pandas as pd
from datetime import datetime, timedelta
from typing import List
from mcx_bhavcopy import MCXBhavcopyFetcher

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("historical_fetch.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

OUTPUT_DIR = "gold_daily_ohlc"

def get_validated_expiries() -> List[str]:
    """
    Returns the list of validated GOLD expiry dates extracted from MCX website.
    Filtered for 2014 onwards as per requirement.
    """
    all_expiries = [
        # 2026
        "04DEC2026", "27NOV2026", "30OCT2026", "05OCT2026", "25SEP2026", "31AUG2026", 
        "05AUG2026", "29JUL2026", "30JUN2026", "05JUN2026", "27MAY2026", "30APR2026", 
        "02APR2026", "24MAR2026", "27FEB2026", "05FEB2026", "27JAN2026",
        # 2025
        "31DEC2025", "05DEC2025", "26NOV2025", "31OCT2025", "03OCT2025", "23SEP2025", 
        "29AUG2025", "05AUG2025", "25JUL2025", "30JUN2025", "05JUN2025", "27MAY2025", 
        "30APR2025", "04APR2025", "26MAR2025", "28FEB2025", "05FEB2025", "27JAN2025",
        # 2024
        "31DEC2024", "05DEC2024", "26NOV2024", "04OCT2024", "24SEP2024", "05AUG2024", 
        "25JUL2024", "05JUN2024", "27MAY2024", "05APR2024", "26MAR2024", "05FEB2024", "24JAN2024",
        # 2023
        "05DEC2023", "24NOV2023", "05OCT2023", "26SEP2023", "04AUG2023", "26JUL2023", 
        "05JUN2023", "25MAY2023", "05APR2023", "27MAR2023", "03FEB2023", "24JAN2023",
        # 2022
        "05DEC2022", "24NOV2022", "05OCT2022", "26SEP2022", "05AUG2022", "27JUL2022", 
        "03JUN2022", "25MAY2022", "05APR2022", "25MAR2022", "04FEB2022", "25JAN2022",
        # 2021
        "03DEC2021", "24NOV2021", "05OCT2021", "24SEP2021", "05AUG2021", "27JUL2021", 
        "04JUN2021", "26MAY2021", "05APR2021", "25MAR2021", "05FEB2021", "27JAN2021",
        # 2020
        "04DEC2020", "25NOV2020", "05OCT2020", "23SEP2020", "05AUG2020", "27JUL2020", 
        "05JUN2020", "27MAY2020", "03APR2020", "27MAR2020", "05FEB2020", "29JAN2020",
        # 2019
        "05DEC2019", "27NOV2019", "04OCT2019", "26SEP2019", "05AUG2019", "29JUL2019", 
        "05JUN2019", "29MAY2019", "05APR2019", "27MAR2019", "05FEB2019", "29JAN2019",
        # 2018
        "05DEC2018", "28NOV2018", "05OCT2018", "26SEP2018", "03AUG2018", "27JUL2018", 
        "05JUN2018", "29MAY2018", "05APR2018", "27MAR2018", "05FEB2018", "29JAN2018",
        # 2017
        "05DEC2017", "28NOV2017", "05OCT2017", "04AUG2017", "05JUN2017", "05APR2017", "03FEB2017",
        # 2016
        "05DEC2016", "05OCT2016", "05AUG2016", "03JUN2016", "05APR2016", "05FEB2016",
        # 2015
        "04DEC2015", "05OCT2015", "05AUG2015", "05JUN2015", "03APR2015", "05FEB2015",
        # 2014
        "05DEC2014", "03OCT2014", "05AUG2014", "05JUN2014", "05APR2014", "05FEB2014"
    ]
    return all_expiries

def get_date_range(expiry_str: str) -> tuple[str, str]:
    """
    Calculate date range: Expiry date and 90 days prior.
    Returns strings in DD/MM/YYYY format.
    """
    expiry_date = datetime.strptime(expiry_str, "%d%b%Y")
    # Increased to 200 days to ensure Far Leg data availability for spread calculation
    start_date = expiry_date - timedelta(days=200)
    
    # Format for API: MM/DD/YYYY (US Format required by MCX)
    # Note: expiry_date is the "ToDate"
    to_date_str = expiry_date.strftime("%m/%d/%Y")
    from_date_str = start_date.strftime("%m/%d/%Y")
    
    return from_date_str, to_date_str

def fetch_and_save_history():
    """Main function to fetch and save historical data"""
    
    # 1. Create output directory
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        logger.info(f"Created directory: {OUTPUT_DIR}")
    
    # 2. Initialize fetcher
    fetcher = MCXBhavcopyFetcher()
    
    # 3. Get validated expiries
    expiries = get_validated_expiries()
    logger.info(f"Processing {len(expiries)} expiries from validated list")
    
    # 4. Process each expiry
    success_count = 0
    failure_count = 0
    
    for i, expiry in enumerate(expiries):
        # Refresh session periodically (every 10 requests) to avoid timeouts/blocks
        if i > 0 and i % 10 == 0:
            logger.info("Refreshing session...")
            fetcher = MCXBhavcopyFetcher()
            time.sleep(2)

        logger.info(f"Processing {i+1}/{len(expiries)}: {expiry}")
        
        output_file = os.path.join(OUTPUT_DIR, f"{expiry}.csv")
        
        # Skip if file already exists (simple resume logic)
        if os.path.exists(output_file):
            logger.info(f"File {output_file} already exists. Skipping.")
            continue
            
        try:
            from_date, to_date = get_date_range(expiry)
            
            logger.info(f"Fetching {expiry}: {from_date} to {to_date}")
            
            df = fetcher.fetch_date_range(
                symbol='GOLD',
                expiry=expiry,
                from_date=from_date,
                to_date=to_date
            )
            
            if not df.empty:
                fetcher.export_to_csv(df, output_file)
                logger.info(f"Saved {len(df)} records to {output_file}")
                success_count += 1
            else:
                logger.warning(f"No data found for {expiry}")
                failure_count += 1
                
            # Rate limiting - be kind to the API
            time.sleep(1.5)
            
        except Exception as e:
            logger.error(f"Failed to fetch {expiry}: {e}")
            failure_count += 1
            time.sleep(5) # Longer wait on error
            
    logger.info(f"Processing complete. Success: {success_count}, Failures: {failure_count}")

if __name__ == "__main__":
    fetch_and_save_history()
