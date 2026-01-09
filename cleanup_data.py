
import os
import glob
import logging

logging.basicConfig(level=logging.INFO)
DIR = "gold_daily_ohlc"

def cleanup_small_files():
    files = glob.glob(os.path.join(DIR, "*.csv"))
    count = 0
    for f in files:
        size = os.path.getsize(f)
        # 2KB threshold (empty/header-only files are ~100-700 bytes)
        if size < 2048:
            try:
                os.remove(f)
                logging.info(f"Deleted small file: {f} ({size} bytes)")
                count += 1
            except Exception as e:
                logging.error(f"Error deleting {f}: {e}")
                
    logging.info(f"Cleanup complete. Deleted {count} files.")

if __name__ == "__main__":
    cleanup_small_files()
