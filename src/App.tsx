import { useEffect } from 'react'
import { useAuthStore } from './store/useAuthStore'
import { AuthScreen } from './components/AuthScreen'
import { ConTALKLayout } from './components/ConTALKLayout'
import { TitleBar } from './components/TitleBar'
import { BrandMark } from './components/BrandMark'

function App() {
  const { isAuthenticated, isLoading, checkSession } = useAuthStore()

  useEffect(() => {
    checkSession()
  }, [checkSession])

  if (isLoading && !isAuthenticated) {
    return (
      <div className="ct-session-shell"><TitleBar/><div className="ct-session-content ct-boot" role="status"><BrandMark/><span>Iniciando ConTALK…</span></div></div>
    )
  }

  if (!isAuthenticated) {
    return <div className="ct-session-shell"><TitleBar/><AuthScreen/></div>
  }

  return <ConTALKLayout />
}

export default App
