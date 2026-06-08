'use client';

import React, { useState } from 'react';
import { Lock, Delete, Play, Users } from 'lucide-react';
import { loginWithPin, UserSession } from '@/lib/api';
import Image from 'next/image';

interface PinLoginProps {
  onLoginSuccessAction: (user: UserSession) => void;
}

export default function PinLogin({ onLoginSuccessAction }: PinLoginProps) {
  const [pin, setPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Numpad tıklama
  const handleKeyPress = (val: string) => {
    if (pin.length < 4) {
      const nextPin = pin + val;
      setPin(nextPin);
      setErrorMsg('');
      
      // 4 haneye ulaştığında otomatik doğrula
      if (nextPin.length === 4) {
        verifyPin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setErrorMsg('');
  };

  const handleClear = () => {
    setPin('');
    setErrorMsg('');
  };

  // PIN doğrulama API çağrısı
  const verifyPin = async (enteredPin: string) => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const user = await loginWithPin(enteredPin);
      onLoginSuccessAction(user);
    } catch (err: any) {
      setErrorMsg(err.message || 'Hatalı PIN Kodu!');
      setPin(''); // Hatalı girişte PIN'i temizle
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 min-h-screen">
      <div className="glass-panel w-full max-w-sm rounded-3xl p-6 md:p-8 shadow-2xl border-indigo-500/10 flex flex-col items-center animate-scale-in">
        
        {/* Logo */}
        <div className="mb-4 flex flex-col items-center animate-pulse">
          <Image 
            src="/logo.png" 
            alt="GustoPOS Logo" 
            width={200} 
            height={80} 
            className="object-contain"
            priority
          />
        </div>
        <p className="text-xs text-slate-400 mb-6 flex items-center space-x-1">
          <Users className="w-3.5 h-3.5 text-slate-500" />
          <span>Lütfen 4 Haneli PIN Kodunuzu Girin</span>
        </p>

        {/* PIN Ekranı (Noktalar) */}
        <div className="flex justify-center space-x-4 mb-6">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                pin.length > idx
                  ? 'bg-indigo-500 border-indigo-500 shadow-md shadow-indigo-500/50 scale-110'
                  : 'bg-transparent border-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Hata Mesajı */}
        <div className="h-6 mb-4 flex items-center justify-center">
          {errorMsg && (
            <p className="text-rose-400 text-xs font-semibold animate-shake">
              {errorMsg}
            </p>
          )}
          {isLoading && (
            <p className="text-indigo-400 text-xs font-semibold animate-pulse">
              Doğrulanıyor...
            </p>
          )}
        </div>

        {/* Numpad Arayüzü */}
        <div className="grid grid-cols-3 gap-3.5 w-full max-w-[280px]">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((val) => (
            <button
              key={val}
              disabled={isLoading}
              onClick={() => handleKeyPress(val)}
              className="active-press w-16 h-16 rounded-full bg-slate-900/60 hover:bg-slate-800 border border-slate-800/80 text-white font-heading font-black text-xl flex items-center justify-center transition cursor-pointer select-none disabled:opacity-40"
            >
              {val}
            </button>
          ))}
          
          {/* C (Temizle) */}
          <button
            disabled={isLoading || pin.length === 0}
            onClick={handleClear}
            className="active-press w-16 h-16 rounded-full bg-slate-950 hover:bg-slate-900 border border-slate-900/60 text-slate-400 hover:text-white font-bold text-xs flex items-center justify-center transition cursor-pointer select-none"
          >
            Temizle
          </button>
          
          {/* 0 */}
          <button
            disabled={isLoading}
            onClick={() => handleKeyPress('0')}
            className="active-press w-16 h-16 rounded-full bg-slate-900/60 hover:bg-slate-800 border border-slate-800/80 text-white font-heading font-black text-xl flex items-center justify-center transition cursor-pointer select-none disabled:opacity-40"
          >
            0
          </button>
          
          {/* Backspace */}
          <button
            disabled={isLoading || pin.length === 0}
            onClick={handleBackspace}
            className="active-press w-16 h-16 rounded-full bg-slate-950 hover:bg-slate-900 border border-slate-900/60 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer select-none"
          >
            <Delete className="w-5 h-5 text-rose-400" />
          </button>
        </div>

        {/* Alt Bilgilendirme */}
        <div className="mt-8 text-[10px] text-slate-500 text-center space-y-1">
          <p>Demo Girişleri: Müdür (0000) • Garson Ahmet (1111)</p>
          <p>© GustoPOS Restoran Otomasyonu</p>
        </div>

      </div>
    </div>
  );
}
