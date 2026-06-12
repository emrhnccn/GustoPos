'use client';

/**
 * BackgroundOrbs — Hareketli aurora blob bileşeni.
 * Büyük, bulanık, yavaş hareket eden renkli ışık topları.
 * GPU-friendly: yalnızca transform kullanır, layout tetiklemez.
 */
export default function BackgroundOrbs() {
  return (
    <>
      <style>{`
        .orb-container {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          overflow: hidden;
        }

        .orb {
          position: absolute;
          border-radius: 50%;
          will-change: transform;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          animation-direction: alternate;
        }

        /* ── Orb 1: Gold — sol üst ── */
        .orb-1 {
          width: 900px;
          height: 900px;
          background: radial-gradient(circle, rgba(245,158,11,0.5) 0%, rgba(180,83,9,0.25) 40%, transparent 72%);
          filter: blur(90px);
          top: -250px;
          left: -200px;
          animation-name: orb-move-1;
          animation-duration: 13s;
        }

        /* ── Orb 2: Orange — sağ alt ── */
        .orb-2 {
          width: 800px;
          height: 800px;
          background: radial-gradient(circle, rgba(234,88,12,0.45) 0%, rgba(154,52,18,0.2) 40%, transparent 72%);
          filter: blur(80px);
          bottom: -200px;
          right: -150px;
          animation-name: orb-move-2;
          animation-duration: 16s;
        }

        /* ── Orb 3: Light Gold — orta sağ ── */
        .orb-3 {
          width: 650px;
          height: 650px;
          background: radial-gradient(circle, rgba(251,191,36,0.4) 0%, rgba(217,119,6,0.18) 45%, transparent 72%);
          filter: blur(75px);
          top: 25%;
          right: -120px;
          animation-name: orb-move-3;
          animation-duration: 19s;
        }

        /* ── Orb 4: Soft Orange — sol alt ── */
        .orb-4 {
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(249,115,22,0.4) 0%, rgba(194,65,12,0.15) 45%, transparent 72%);
          filter: blur(70px);
          bottom: 5%;
          left: 5%;
          animation-name: orb-move-4;
          animation-duration: 21s;
        }

        /* ── Orb 5: Warm Bronze — merkez üst ── */
        .orb-5 {
          width: 550px;
          height: 550px;
          background: radial-gradient(circle, rgba(217,119,6,0.35) 0%, rgba(120,53,15,0.15) 45%, transparent 72%);
          filter: blur(70px);
          top: 10%;
          left: 38%;
          animation-name: orb-move-5;
          animation-duration: 24s;
        }

        /* ── Hareket animasyonları: geniş ve belirgin ── */
        @keyframes orb-move-1 {
          0%   { transform: translate(0, 0) scale(1); }
          30%  { transform: translate(180px, 130px) scale(1.15); }
          60%  { transform: translate(80px, 260px) scale(0.88); }
          100% { transform: translate(220px, 160px) scale(1.20); }
        }

        @keyframes orb-move-2 {
          0%   { transform: translate(0, 0) scale(1); }
          35%  { transform: translate(-200px, -140px) scale(1.18); }
          65%  { transform: translate(-100px, -280px) scale(0.85); }
          100% { transform: translate(-240px, -170px) scale(1.22); }
        }

        @keyframes orb-move-3 {
          0%   { transform: translate(0, 0) scale(1); }
          40%  { transform: translate(-160px, 180px) scale(1.12); }
          70%  { transform: translate(-240px, -90px) scale(0.82); }
          100% { transform: translate(-120px, 220px) scale(1.16); }
        }

        @keyframes orb-move-4 {
          0%   { transform: translate(0, 0) scale(1); }
          45%  { transform: translate(200px, -120px) scale(1.20); }
          80%  { transform: translate(100px, -220px) scale(0.80); }
          100% { transform: translate(240px, -150px) scale(1.14); }
        }

        @keyframes orb-move-5 {
          0%   { transform: translate(0, 0) scale(1); }
          25%  { transform: translate(-120px, 150px) scale(1.25); }
          55%  { transform: translate(150px, 90px) scale(0.75); }
          80%  { transform: translate(-90px, 200px) scale(1.18); }
          100% { transform: translate(120px, -90px) scale(0.85); }
        }

        /* İçeriği orb'ların üstünde tut */
        body > *:not(.orb-container) {
          position: relative;
          z-index: 1;
        }
      `}</style>

      <div className="orb-container" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div className="orb orb-4" />
        <div className="orb orb-5" />
      </div>
    </>
  );
}
