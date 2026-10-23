import { useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'

export function AuthScreen() {
  const [isRegister, setIsRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { login, register, loginAsDemo, isLoading, error, clearError } = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isRegister) {
      await register(username, email, password)
    } else {
      await login(username, password)
    }
  }

  const toggleMode = () => {
    setIsRegister(!isRegister)
    clearError()
    setUsername('')
    setEmail('')
    setPassword('')
  }

  const quickLogin = async (user: string, pass: string) => {
    setUsername(user)
    setPassword(pass)
    await login(user, pass)
  }

  return (
    <div className="flex items-center justify-center h-screen bg-[#0c0a14] p-4 select-none relative overflow-hidden">
      {/* Luz ambiente de fundo no tom do morcego */}
      <div className="absolute top-1/4 w-[500px] h-[500px] bg-purple-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-[350px] h-[350px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md p-8 rounded-3xl shadow-2xl bg-[#141121]/90 backdrop-blur-2xl border border-purple-500/20 relative z-10">
        <div className="text-center mb-6">
          {/* Logo do Morcego ContalK */}
          <div className="relative w-24 h-24 mx-auto mb-4 group">
            <div className="absolute inset-0 rounded-full bg-purple-600/40 blur-xl animate-pulse" />
            <img
              src="/logo.jpg"
              alt="ContalK Logo"
              className="relative w-24 h-24 rounded-full object-cover border-2 border-purple-400/50 shadow-2xl transition-transform duration-300 group-hover:scale-105"
            />
          </div>

          <h1 className="text-3xl font-black text-white tracking-wide">
            Contal<span className="text-purple-400">K</span>
          </h1>
          <p className="text-[#a49fb5] text-xs mt-1.5 font-medium tracking-wide">
            {isRegister ? 'Crie sua conta no ContalK para começar' : 'Voz, vídeo e tela em alta performance'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-[11px] font-bold text-purple-300/80 uppercase tracking-wider mb-1.5">
                Nome de Usuário
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#0e0c17] border border-purple-900/40 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all text-sm"
                placeholder="ex: johndoe"
                required
                minLength={3}
                maxLength={32}
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-purple-300/80 uppercase tracking-wider mb-1.5">
              {isRegister ? 'Email' : 'Usuário ou Email'}
            </label>
            <input
              type={isRegister ? 'email' : 'text'}
              value={isRegister ? email : username}
              onChange={(e) => (isRegister ? setEmail(e.target.value) : setUsername(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-[#0e0c17] border border-purple-900/40 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all text-sm"
              placeholder={isRegister ? 'seu@email.com' : 'alice ou alice@contalk.local'}
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-purple-300/80 uppercase tracking-wider mb-1.5">
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#0e0c17] border border-purple-900/40 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all text-sm"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-purple-600/30 hover:shadow-purple-600/50 disabled:opacity-50 disabled:cursor-not-allowed mt-2 text-sm tracking-wide"
          >
            {isLoading ? 'Autenticando...' : isRegister ? 'Criar Conta' : 'Entrar no ContalK'}
          </button>
        </form>

        {/* Atalhos de Contas de Teste Rápidas */}
        <div className="mt-6">
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-purple-900/40" />
            <span className="flex-shrink mx-3 text-purple-400/60 text-[10px] uppercase font-bold tracking-wider">
              Acesso Rápido de Teste
            </span>
            <div className="flex-grow border-t border-purple-900/40" />
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              onClick={() => quickLogin('alice', 'alice123')}
              type="button"
              className="py-2 px-3 bg-[#0e0c17] hover:bg-purple-900/30 border border-purple-900/30 hover:border-purple-500/40 text-xs text-gray-200 rounded-xl transition-all flex items-center justify-between"
            >
              <span className="font-medium">👩 Alice</span>
              <span className="text-[10px] text-purple-400">alice123</span>
            </button>
            <button
              onClick={() => quickLogin('bob', 'bob12345')}
              type="button"
              className="py-2 px-3 bg-[#0e0c17] hover:bg-purple-900/30 border border-purple-900/30 hover:border-purple-500/40 text-xs text-gray-200 rounded-xl transition-all flex items-center justify-between"
            >
              <span className="font-medium">👨 Bob</span>
              <span className="text-[10px] text-purple-400">bob12345</span>
            </button>
            <button
              onClick={() => quickLogin('carol', 'carol123')}
              type="button"
              className="py-2 px-3 bg-[#0e0c17] hover:bg-purple-900/30 border border-purple-900/30 hover:border-purple-500/40 text-xs text-gray-200 rounded-xl transition-all flex items-center justify-between"
            >
              <span className="font-medium">👩 Carol</span>
              <span className="text-[10px] text-purple-400">carol123</span>
            </button>
            <button
              onClick={() => quickLogin('dave', 'dave1234')}
              type="button"
              className="py-2 px-3 bg-[#0e0c17] hover:bg-purple-900/30 border border-purple-900/30 hover:border-purple-500/40 text-xs text-gray-200 rounded-xl transition-all flex items-center justify-between"
            >
              <span className="font-medium">👨 Dave</span>
              <span className="text-[10px] text-purple-400">dave1234</span>
            </button>
          </div>

          <button
            onClick={loginAsDemo}
            type="button"
            className="w-full mt-2.5 py-2 bg-purple-950/40 hover:bg-purple-900/40 border border-purple-800/30 text-xs text-purple-300 font-medium rounded-xl transition-all flex items-center justify-center gap-1.5"
          >
            <span>🦇</span>
            <span>Entrar como Visitante Anônimo</span>
          </button>
        </div>

        <div className="mt-5 text-center">
          <p className="text-[#a49fb5] text-xs">
            {isRegister ? 'Já possui uma conta?' : 'Precisa de uma nova conta?'}{' '}
            <button
              onClick={toggleMode}
              className="text-purple-400 hover:text-purple-300 hover:underline font-semibold transition-colors"
            >
              {isRegister ? 'Fazer login' : 'Registrar-se'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
