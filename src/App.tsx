import { useEffect } from 'react'
import { useAuthStore } from './store/useAuthStore'
import { AuthScreen } from './components/AuthScreen'
import { ConTALKLayout } from './components/ConTALKLayout'
import { TitleBar } from './components/TitleBar'

function App() {
  const { isAuthenticated, isLoading, checkSession } = useAuthStore()

  useEffect(() => {
    checkSession()
  }, [checkSession])

  if (isLoading && !isAuthenticated) {
    return (
      <div className="ct-session-shell"><TitleBar/><div className="ct-session-content flex items-center justify-center bg-[#0c0a14] relative overflow-hidden select-none">
        {/* Glow ambient background no tom roxo do morcego */}
        <div className="absolute w-[450px] h-[450px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse" />

        <div className="text-center z-10 flex flex-col items-center">
          <div className="relative w-28 h-28 mb-5 group">
            <div className="absolute inset-0 rounded-full bg-purple-600/40 blur-xl animate-pulse" />
            <img
              src="./contalk-avatar.png"
              alt="ConTALK Logo"
              className="relative w-28 h-28 rounded-full shadow-2xl border-2 border-purple-400/60 object-cover"
            />
          </div>
          <h1 className="text-white text-3xl font-black tracking-wider mb-1.5 flex items-center gap-1">
            Con<span className="text-purple-400">TALK</span>
          </h1>
          <p className="text-purple-300/80 text-xs font-semibold tracking-widest uppercase mb-6">
            Comunicação de Alta Performance
          </p>
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-purple-950/50 border border-purple-800/40 text-xs text-purple-300 font-medium shadow-lg">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
            Iniciando ConTALK...
          </div>
        </div>
      </div></div>
    )
  }

  if (!isAuthenticated) {
    return <div className="ct-session-shell"><TitleBar/><AuthScreen/></div>
  }

  return <ConTALKLayout />
}

export default App
