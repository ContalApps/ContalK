// Marca do ConTalk: balão de conversa com ondas de voz (mesmo desenho de build/icon.svg, em currentColor).
export function BrandMark({className=''}:{className?:string}) {
  return <span className={`ct-brand-mark ${className}`} aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeLinejoin="round"><path d="M19 11h10a9.5 9.5 0 0 1 9.5 9.5v2A9.5 9.5 0 0 1 29 32h-9l-7 5 1.5-6.2A9.5 9.5 0 0 1 9.5 22.5v-2A9.5 9.5 0 0 1 19 11Z" strokeWidth="3.2"/><g fill="currentColor" stroke="none"><rect x="17.4" y="18.3" width="3.2" height="7" rx="1.6"/><rect x="22.4" y="15.8" width="3.2" height="12" rx="1.6"/><rect x="27.4" y="18.3" width="3.2" height="7" rx="1.6"/></g></svg></span>
}
