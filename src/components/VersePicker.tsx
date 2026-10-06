import { useEffect, useMemo, useRef, useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import { num } from '../lib/format';
import type { Verse } from '../lib/types';

interface Props {
  verses: Verse[];
  value: number | undefined;
  onPick: (ayah: number) => void;
}

/** Searchable verse picker: type a number (Arabic or Latin digits) or a word of the verse; Enter picks the first match. */
export function VersePicker({ verses, value, onPick }: Props) {
  const { t } = useSettings();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const matches = useMemo(() => {
    const raw = q.trim().replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    if (!raw) return verses;
    if (/^\d+$/.test(raw)) return verses.filter((v) => String(v.n).startsWith(raw));
    const needle = raw.replace(/[ً-ٰٟ]/g, '');
    return verses.filter((v) => v.e.includes(needle));
  }, [q, verses]);

  const pick = (n: number) => { onPick(n); setQ(''); setOpen(false); };

  return (
    <div className="picker" ref={box}>
      <input
        className="picker__input"
        value={q}
        placeholder={value ? `${t('ayah')} ${num(value, 'ar')}` : t('pickVerse')}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setCursor(0); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, matches.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
          else if (e.key === 'Enter' && matches[cursor]) { e.preventDefault(); pick(matches[cursor].n); }
          else if (e.key === 'Escape') setOpen(false);
        }}
        aria-label={t('goToVerse')}
      />
      {open && matches.length > 0 && (
        <div className="picker__list" role="listbox">
          {matches.slice(0, 300).map((v, i) => (
            <button key={v.n} className={`picker__item ${i === cursor ? 'is-active' : ''} ${v.n === value ? 'is-current' : ''}`} onClick={() => pick(v.n)} role="option" aria-selected={v.n === value}>
              <span className="picker__item-n">{num(v.n, 'ar')}</span>
              <span className="picker__item-hint quran-text" dir="rtl">{v.w.slice(0, 6).join(' ')}{v.w.length > 6 ? ' …' : ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
