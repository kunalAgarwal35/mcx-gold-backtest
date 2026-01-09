import { useState, useEffect } from 'react';
import PremiumChart from './components/PremiumChart';
import BacktestPanel from './components/BacktestPanel';

function App() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch("/data.json")
      .then((res) => res.json())
      .then((jsonData) => setData(jsonData))
      .catch((err) => console.error(err));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            MCX Gold Futures
          </h1>
          <p className="text-gray-600">
            Analysis of perpetual Gold Longs using MCX Futures
          </p>
        </header>

        <main className="flex flex-col gap-16">
          <PremiumChart />

          {data.length > 0 && <BacktestPanel fullData={data} />}
        </main>

        <footer className="text-center text-gray-400 text-sm pt-8 border-t border-gray-200">
          <p>© 2026 MCX India Automation Project</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
