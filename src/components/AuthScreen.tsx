import { useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'
export function AuthScreen() {
  const [registering,setRegistering]=useState(false)
  const [username,setUsername]=useState('');const [email,setEmail]=useState('');const [password,setPassword]=useState('')
  const {login,register,isLoading,error,clearError}=useAuthStore()
  return <div className="ct-app ct-auth"><form className="ct-edit-dialog" onSubmit={async e=>{e.preventDefault();if(registering)await register(username,email,password);else await login(username,password)}}><img className="ct-auth-logo" src="./contalk-avatar.png" alt="ConTALK"/><h1>{registering?'Criar conta':'Bem-vindo ao ConTALK'}</h1><label>{registering?'Nome de usuário':'Usuário ou e-mail'}<input required autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)}/></label>{registering&&<label>E-mail<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>}<label>Senha<input type="password" required minLength={6} autoComplete={registering?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<p role="alert">{error}</p>}<button className="ct-primary" disabled={isLoading}>{isLoading?'Aguarde...':registering?'Criar minha conta':'Entrar'}</button><button type="button" onClick={()=>{setRegistering(!registering);clearError()}}>{registering?'Já tenho conta':'Quero criar uma conta'}</button></form></div>
}
