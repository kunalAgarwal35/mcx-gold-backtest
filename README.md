# MCX India Bhavcopy Automation

Automate fetching of commodity bhavcopy (OHLC price data) from MCX India website for backtesting and analysis.

## 🎯 Features

- ✅ Fetch historical OHLC data for any MCX commodity
- ✅ Support for date range filtering
- ✅ Export to CSV and Excel formats
- ✅ Clean, structured pandas DataFrame output
- ✅ Built-in error handling and logging
- ✅ Easy-to-use Python API

## 📋 API Details

### Endpoint Information

**URL:** `https://www.mcxindia.com/backpage.aspx/GetCommoditywiseBhavCopy`

**Method:** `POST`

**Headers:**
```
Accept: application/json, text/javascript, */*; q=0.01
Content-Type: application/json
X-Requested-With: XMLHttpRequest
```

**Request Payload:**
```json
{
  "Symbol": "GOLD",
  "Expiry": "05DEC2025",
  "FromDate": "06/09/2025",
  "ToDate": "06/12/2025",
  "InstrumentName": "FUTCOM"
}
```

**Response Structure:**
```json
{
  "d": {
    "Data": [
      {
        "Date": "/Date(1733356200000)/",
        "DateDisplay": "05/12/2025",
        "Open": "77950.00",
        "High": "78120.00",
        "Low": "77715.00",
        "Close": "77890.00",
        "PreviousClose": "77805.00",
        "Volume": "1543",
        "Value": "1684.65 Crore",
        "OpenInterest": "12345",
        "Symbol": "GOLD",
        "ExpiryDate": "05DEC2025",
        "InstrumentName": "FUTCOM",
        "StrikePrice": "",
        "OptionType": ""
      }
    ],
    "Summary": {
      "Count": 5,
      "AsOn": "/Date(1733356200000)/"
    }
  }
}
```

## 🚀 Installation

1. **Clone or download this repository**

2. **Install dependencies:**
```bash
pip install -r requirements.txt
```

## 💡 Usage

### Basic Example

```python
from mcx_bhavcopy import MCXBhavcopyFetcher

# Initialize the fetcher
fetcher = MCXBhavcopyFetcher()

# Fetch all data for GOLD with specific expiry
df = fetcher.fetch_all_data(
    symbol='GOLD',
    expiry='05DEC2025'
)

print(df)
```

### Fetch Data for Date Range

```python
# Fetch data between specific dates
df = fetcher.fetch_date_range(
    symbol='GOLD',
    expiry='05DEC2025',
    from_date='06/09/2025',  # DD/MM/YYYY format
    to_date='06/12/2025'
)

print(df)
```

### Export Data

```python
# Export to CSV
fetcher.export_to_csv(df, 'gold_bhavcopy.csv')

# Export to Excel
fetcher.export_to_excel(df, 'gold_bhavcopy.xlsx')
```

### Multiple Commodities

```python
# Available commodity symbols
commodities = ['GOLD', 'SILVER', 'CRUDEOIL', 'NATURALGAS', 'COPPER']

for commodity in commodities:
    df = fetcher.fetch_all_data(
        symbol=commodity,
        expiry='05DEC2025'
    )
    fetcher.export_to_csv(df, f'{commodity.lower()}_data.csv')
```

## 📊 Supported Commodities

| Commodity | Symbol |
|-----------|--------|
| Gold | `GOLD` |
| Silver | `SILVER` |
| Crude Oil | `CRUDEOIL` |
| Natural Gas | `NATURALGAS` |
| Copper | `COPPER` |
| Zinc | `ZINC` |
| Lead | `LEAD` |
| Aluminium | `ALUMINIUM` |
| Nickel | `NICKEL` |

## 📝 DataFrame Columns

The returned DataFrame contains the following columns:

- `Date` - Date in datetime format
- `DateDisplay` - Date in DD/MM/YYYY format
- `Open` - Opening price
- `High` - Highest price
- `Low` - Lowest price
- `Close` - Closing price
- `PreviousClose` - Previous day's closing price
- `Volume` - Trading volume
- `Value` - Trading value
- `OpenInterest` - Open interest
- `Symbol` - Commodity symbol
- `ExpiryDate` - Contract expiry date
- `InstrumentName` - Instrument type (FUTCOM, etc.)

## ⚠️ Important Notes

### Expiry Date Format
Expiry dates must be in **`DDMMMYYYY`** format (e.g., `05DEC2025`, `05FEB2026`)

To find available expiry dates:
1. Visit https://www.mcxindia.com/market-data/bhavcopy
2. Go to "Commodity Wise" tab
3. Select your commodity
4. Check the "Expiry" dropdown for available dates

### Date Range Format
Date ranges must be in **`DD/MM/YYYY`** format (e.g., `06/09/2025`)

Leave `from_date` and `to_date` empty to fetch all available data for the expiry.

## 🔍 Testing

Run the example script:

```bash
python mcx_bhavcopy.py
```

This will:
1. Fetch GOLD data for all dates with 05DEC2025 expiry
2. Fetch GOLD data for a specific date range
3. Export the data to CSV
4. Fetch SILVER data

## 🛠️ Error Handling

The script includes comprehensive error handling:

- Network request failures
- Invalid responses
- Missing data
- Date parsing errors
- Export errors

All errors are logged with descriptive messages.

## 📸 Example Output

```
Date         Open      High      Low       Close     Volume  OpenInterest
2025-12-01  77800.00  77950.00  77650.00  77890.00  1234    12345
2025-12-02  77890.00  78100.00  77750.00  78050.00  1456    12567
2025-12-03  78050.00  78200.00  77900.00  78120.00  1543    12789
```

## 🤝 Contributing

Feel free to submit issues or pull requests for improvements.

## 📄 License

This project is for educational and personal use only. Please respect MCX India's terms of service.

## ⚡ Advanced Usage

### Custom Logging

```python
import logging

# Set logging level
logging.getLogger('mcx_bhavcopy').setLevel(logging.DEBUG)
```

### Batch Processing

```python
from datetime import datetime, timedelta

# Process multiple expiries
expiries = ['05DEC2025', '05JAN2026', '05FEB2026']

all_data = []
for expiry in expiries:
    df = fetcher.fetch_all_data('GOLD', expiry)
    all_data.append(df)

# Combine all data
combined_df = pd.concat(all_data, ignore_index=True)
```

## 📞 Support

For issues or questions, please open an issue on the repository.

---

**Happy Trading! 📈**
