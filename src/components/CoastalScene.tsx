import { useId } from 'react'

export function CoastalScene({ className = 'ct-nightscape ct-coastal-scene' }: { className?: string }) {
  const id = useId().replace(/:/g, '')
  return <svg className={className} viewBox="0 0 1000 320" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id={`${id}-sky`} x2="0" y2="1"><stop stopColor="#b2767b"/><stop offset=".55" stopColor="#e4a48d"/><stop offset="1" stopColor="#eac49a"/></linearGradient><linearGradient id={`${id}-sea`} x2="0" y2="1"><stop stopColor="#648e87"/><stop offset="1" stopColor="#315d59"/></linearGradient></defs>
    <path fill={`url(#${id}-sky)`} d="M0 0h1000v320H0z"/><circle cx="753" cy="126" r="63" fill="#f4d4a6"/>
    <path d="M0 212h1000v108H0z" fill={`url(#${id}-sea)`}/><g fill="none" stroke="#b4bca0" opacity=".45"><path d="M710 227h98m-120 12h142m-104 14h72m-105 15h132"/><path d="M350 228h140m-210 29h170M870 253h130"/></g>
    <g fill="#40605b"><path d="M170 213v-65h35v-15h45v80M261 213V95h39v-9h18v127M329 213v-83h51v83M388 213v-54h38v-28h20v82M455 213v-91h43v-14h18v105M530 213v-62h58v62"/><path d="M278 86V59h4v27m119 45v-19h4v19"/></g>
    <g fill="#d4bb9b" opacity=".55">{[156,175,194].map(y=><path key={y} d={`M180 ${y}h60v3h-60m28 4h30v3h-30M270 ${y}h23v3h-23m66-2h35v3h-35m129-3h27v3h-27`}/>)}</g>
    <path d="M0 291c140-30 263-7 405-19s230-12 338 3 171 17 257 1v44H0z" fill="#28443f"/>
    <g fill="#233e37"><path d="M899 320c-8-92-26-168-37-232l9-1c26 79 41 158 48 233z"/><path d="M864 93c-36-42-73-34-99-18 40-8 64 1 91 29-51-10-89 9-104 43 29-24 56-31 99-31-34 20-48 44-47 78 12-30 30-50 58-63 2 41 21 66 48 83-16-29-25-52-26-88 36 15 56 35 69 65-1-39-23-67-60-83 34-3 64 9 87 32-13-34-50-55-90-46 15-22 35-31 64-35-33-11-66-2-90 34z"/></g>
    <g fill="#2c4940" transform="translate(103 75) scale(.68)"><path d="M40 360c17-111 25-177 29-260h9c6 83-1 178-14 260z"/><path d="M73 102c-23-36-66-39-97-21 33-3 61 11 75 28-43-2-72 15-85 43 29-15 49-20 78-20-23 25-32 54-25 83 9-33 22-52 42-68 13 35 30 51 63 59-26-26-36-45-42-70 41 4 68 19 86 43-9-36-39-58-77-61 27-13 57-11 86 2-23-29-62-32-93-18 4-24 22-44 43-55-30 1-52 20-54 55z"/></g>
    <g stroke="#365a50" strokeWidth="2" fill="none" opacity=".8"><path d="m614 96 10 3 10-3m-60 31 8 3 8-3"/></g>
  </svg>
}
