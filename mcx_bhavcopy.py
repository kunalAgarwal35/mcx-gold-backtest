"""
MCX India Bhavcopy Data Fetcher

This script fetches commodity-wise bhavcopy (price) data from MCX India website
using their internal API endpoint.

API Details (MCX moved the endpoint in 2026; the old POST to
backpage.aspx/GetCommoditywiseBhavCopy now returns 404):
- Endpoint: https://www.mcxindia.com/market-data/bhavcopy/GetCommoditywiseBhavCopy
- Method: GET, query params InstrumentName, Symbol, Expiry, fromDate, toDate
- Dates: DD/MM/YYYY in the request, MM/DD/YYYY in the response
- Akamai rejects plain `requests` (403 on every URL), so the session uses
  curl_cffi with Chrome TLS impersonation.
"""

try:
    from curl_cffi import requests
    _IMPERSONATE = {"impersonate": "chrome"}
except ImportError:  # falls back to plain requests, which Akamai blocks with 403
    import requests
    _IMPERSONATE = {}
import pandas as pd
from datetime import datetime, timedelta
from typing import Optional, List, Dict
import json
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class MCXBhavcopyFetcher:
    """Fetches bhavcopy data from MCX India"""
    
    BASE_URL = "https://www.mcxindia.com/market-data/bhavcopy/GetCommoditywiseBhavCopy"

    # Column order of the CSVs in gold_daily_ohlc/. gold-research's goldlab/raw.py checks this
    # header and reads the date from the second field, so it must not change.
    CSV_COLUMNS = [
        '__type', 'Date', 'Symbol', 'ExpiryDate', 'Open', 'High', 'Low', 'Close',
        'PreviousClose', 'Volume', 'VolumeInThousands', 'Value', 'OpenInterest',
        'DateDisplay', 'InstrumentName', 'StrikePrice', 'OptionType',
    ]
    
    # Common commodities and their symbols
    COMMODITIES = {
        'GOLD': 'GOLD',
        'SILVER': 'SILVER',
        'CRUDE': 'CRUDEOIL',
        'NATURALGAS': 'NATURALGAS',
        'COPPER': 'COPPER',
        'ZINC': 'ZINC',
        'LEAD': 'LEAD',
        'ALUMINIUM': 'ALUMINIUM',
        'NICKEL': 'NICKEL',
    }
    
    def __init__(self):
        """Initialize the fetcher with required headers"""
        if not _IMPERSONATE:
            logger.warning("curl_cffi is not installed; MCX (Akamai) will likely answer 403. "
                           "pip install -r requirements.txt")
        self.session = requests.Session(**_IMPERSONATE)
        # User-Agent and TLS fingerprint come from the impersonated browser; only the
        # XHR headers the bhavcopy page itself sends are set here.
        self.headers = {
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Content-Type': 'application/json',
            'Referer': 'https://www.mcxindia.com/market-data/bhavcopy',
            'X-Requested-With': 'XMLHttpRequest',
        }

    def fetch_data(
        self,
        symbol: str,
        expiry: str,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        instrument_name: str = "FUTCOM"
    ) -> Dict:
        """
        Fetch bhavcopy data for a specific commodity
        
        Args:
            symbol: Commodity symbol (e.g., 'GOLD', 'SILVER')
            expiry: Expiry date in format 'DDMMMYYYY' (e.g., '05DEC2025')
            from_date: Start date in format 'DD/MM/YYYY' (optional)
            to_date: End date in format 'DD/MM/YYYY' (optional)
            instrument_name: Instrument type (default: 'FUTCOM' for futures)
        
        Returns:
            Dictionary containing the API response
        """
        params = {
            "InstrumentName": instrument_name,
            "Symbol": symbol,
            "Expiry": expiry,
            "fromDate": from_date or "",
            "toDate": to_date or "",
        }

        logger.info(f"Fetching data for {symbol} - Expiry: {expiry}")
        logger.debug(f"Params: {json.dumps(params, indent=2)}")

        try:
            response = self.session.get(
                self.BASE_URL,
                params=params,
                headers=self.headers,
                timeout=30
            )
            response.raise_for_status()

            data = response.json()
            if not data.get('IsSuccess', True):
                raise ValueError(f"MCX returned IsSuccess=false: {data.get('Message')}")
            logger.info(f"Successfully fetched data for {symbol}")
            return data

        except Exception as e:
            logger.error(f"Error fetching data: {e}")
            raise
    
    def fetch_all_data(
        self,
        symbol: str,
        expiry: str,
        instrument_name: str = "FUTCOM"
    ) -> pd.DataFrame:
        """
        Fetch all data for a commodity (without date filtering)
        
        Args:
            symbol: Commodity symbol
            expiry: Expiry date in format 'DDMMMYYYY'
            instrument_name: Instrument type
        
        Returns:
            Pandas DataFrame with the data
        """
        data = self.fetch_data(symbol, expiry, instrument_name=instrument_name)
        return self._parse_response(data)
    
    def fetch_date_range(
        self,
        symbol: str,
        expiry: str,
        from_date: str,
        to_date: str,
        instrument_name: str = "FUTCOM"
    ) -> pd.DataFrame:
        """
        Fetch data for a specific date range
        
        Args:
            symbol: Commodity symbol
            expiry: Expiry date in format 'DDMMMYYYY'
            from_date: Start date in format 'DD/MM/YYYY'
            to_date: End date in format 'DD/MM/YYYY'
            instrument_name: Instrument type
        
        Returns:
            Pandas DataFrame with the data
        """
        data = self.fetch_data(
            symbol, expiry, from_date, to_date, instrument_name
        )
        return self._parse_response(data)
    
    def _parse_response(self, response_data: Dict) -> pd.DataFrame:
        """
        Parse the API response into a pandas DataFrame
        
        Args:
            response_data: Raw API response
        
        Returns:
            Pandas DataFrame with cleaned data
        """
        try:
            # New endpoint: {"IsSuccess", "Message", "Data": [...]}.
            # Old endpoint (gone): {"d": {"Data": [...]}}.
            data_list = response_data.get('Data')
            if data_list is None:
                data_list = (response_data.get('d') or {}).get('Data', [])

            if not data_list:
                logger.warning("No data found in response")
                return pd.DataFrame()

            # Convert to DataFrame
            df = pd.DataFrame(data_list)

            # Convert date columns. The new endpoint sends Date as MM/DD/YYYY; written out
            # as an ISO date like every existing CSV row.
            if 'Date' in df.columns:
                df['Date'] = pd.to_datetime(df['Date'], format='%m/%d/%Y')
            if 'DateDisplay' in df.columns:
                # Never parsed in the old files either (always empty); kept for the column layout.
                df['DateDisplay'] = pd.to_datetime(df['DateDisplay'], format='%d/%m/%Y', errors='coerce')

            # Keep the CSV layout of the files already on disk: the old response carried a
            # constant __type field and no sLTT field.
            if '__type' not in df.columns:
                df['__type'] = 'MCX.BL.Bhavcopy'
            missing = [c for c in self.CSV_COLUMNS if c not in df.columns]
            if missing:
                raise ValueError(f"MCX response is missing columns: {missing}")
            df = df[self.CSV_COLUMNS]
            
            # Convert numeric columns
            numeric_cols = ['Open', 'High', 'Low', 'Close', 'PreviousClose', 
                          'Volume', 'Value', 'OpenInterest']
            for col in numeric_cols:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors='coerce')
            
            logger.info(f"Parsed {len(df)} records")
            return df
            
        except Exception as e:
            logger.error(f"Error parsing response: {e}")
            raise
    
    def get_available_expiries(self, symbol: str) -> List[str]:
        """
        Note: This function requires scraping the website to get available expiries.
        For now, you need to manually provide the expiry date.
        
        Args:
            symbol: Commodity symbol
        
        Returns:
            List of available expiry dates (placeholder)
        """
        logger.warning("Auto-fetching expiries not yet implemented. Please provide expiry manually.")
        return []
    
    def export_to_csv(self, df: pd.DataFrame, filename: str):
        """
        Export DataFrame to CSV
        
        Args:
            df: DataFrame to export
            filename: Output CSV filename
        """
        df.to_csv(filename, index=False)
        logger.info(f"Data exported to {filename}")
    
    def export_to_excel(self, df: pd.DataFrame, filename: str):
        """
        Export DataFrame to Excel
        
        Args:
            df: DataFrame to export
            filename: Output Excel filename
        """
        df.to_excel(filename, index=False, engine='openpyxl')
        logger.info(f"Data exported to {filename}")


def main():
    """Example usage"""
    fetcher = MCXBhavcopyFetcher()
    
    # Example 1: Fetch all data for GOLD with specific expiry
    print("\n=== Example 1: Fetch all GOLD data for 05DEC2025 expiry ===")
    df_gold = fetcher.fetch_all_data(
        symbol='GOLD',
        expiry='05DEC2025'
    )
    print(df_gold.head())
    print(f"\nTotal records: {len(df_gold)}")
    
    # Example 2: Fetch data for a specific date range
    print("\n=== Example 2: Fetch GOLD data for date range ===")
    df_gold_range = fetcher.fetch_date_range(
        symbol='GOLD',
        expiry='05DEC2025',
        from_date='06/09/2025',
        to_date='06/12/2025'
    )
    print(df_gold_range)
    
    # Example 3: Export to CSV
    print("\n=== Example 3: Export to CSV ===")
    fetcher.export_to_csv(df_gold, 'gold_bhavcopy.csv')
    
    # Example 4: Fetch SILVER data
    print("\n=== Example 4: Fetch SILVER data ===")
    df_silver = fetcher.fetch_all_data(
        symbol='SILVER',
        expiry='05DEC2025'
    )
    print(df_silver.head())


if __name__ == "__main__":
    main()
