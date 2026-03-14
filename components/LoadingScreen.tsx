import React from 'react';
import { Hourglass } from 'lucide-react';

export const LoadingScreen: React.FC = () => {
  return (
    <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/40 backdrop-blur-xl text-center p-6">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-yellow-500 rounded-full blur-xl opacity-20 animate-pulse"></div>
        <Hourglass className="w-20 h-20 text-yellow-400 animate-spin-slow relative z-10" />
      </div>

      <h3 className="text-2xl font-bold text-white mb-2 brand-font">Traveling Through Time...</h3>
      <p className="text-slate-400 max-w-md animate-pulse">
        Our AI chronometer is reconstructing your appearance based on historical archives.
      </p>
    </div>
  );
};
