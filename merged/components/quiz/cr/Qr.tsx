'use client';
/** A join QR code made in the browser from the join URL (no network call, no tracking). The URL is also printed as text for anyone who cannot scan. */
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function Qr({ value, size = 168 }: { value: string; size?: number }) {
  const [src, setSrc] = useState('');
  useEffect(() => { let live = true; QRCode.toDataURL(value, { margin: 1, width: size * 2, color: { dark: '#17253A', light: '#FFF7E8' }, errorCorrectionLevel: 'M' }).then((u) => { if (live) setSrc(u); }).catch(() => { if (live) setSrc(''); }); return () => { live = false; }; }, [value, size]);
  // eslint-disable-next-line @next/next/no-img-element -- a generated data URL
  return src ? <img className="cr-qr" src={src} width={size} height={size} alt={`QR code that opens ${value}`} /> : <div className="cr-qr ph" style={{ width: size, height: size }} aria-hidden="true" />;
}
