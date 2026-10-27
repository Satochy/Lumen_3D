'use client'

import { useActionState, useState } from 'react'
import {
  updateProfileAction,
  createAddressAction,
  deleteAddressAction,
  setDefaultAddressAction,
  sendEmailVerificationAction,
  type ActionResponse,
} from '@/app/actions/profile_actions'
import { User as UserIcon, Camera, CheckCircle2, MailWarning, MapPin, Trash2, Star } from 'lucide-react'

interface AddressItem {
  id: string
  street: string
  number: string
  complement: string | null
  neighborhood: string
  city: string
  state: string
  zipCode: string
  isDefault: boolean
}

interface ProfileClientProps {
  user: {
    id: string
    email: string
    username: string
    name: string | null
    avatarUrl: string | null
    phone: string | null
    cpf: string | null
    birthDate: string | null
    emailConfirmedAt: string | null
  }
  addresses: AddressItem[]
}

const initialActionState: ActionResponse = { success: false, error: null }

export default function Profile_Client({ user, addresses }: ProfileClientProps) {
  const [profileState, profileAction, isSavingProfile] = useActionState(
    updateProfileAction,
    initialActionState
  )
  const [addressState, addressAction, isSavingAddress] = useActionState(
    createAddressAction,
    initialActionState
  )

  const [previewUrl, setPreviewUrl] = useState<string | null>(user.avatarUrl)
  const [emailStatus, setEmailStatus] = useState<string | null>(null)
  const [sendingEmail, setSendingEmail] = useState(false)

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPreviewUrl(URL.createObjectURL(file))
    }
  }

  const handleSendVerification = async () => {
    setSendingEmail(true)
    setEmailStatus(null)
    const res = await sendEmailVerificationAction()
    if (res.success) {
      setEmailStatus('E-mail de verificação enviado! Confira sua caixa de entrada.')
    } else {
      setEmailStatus(res.error || 'Não foi possível enviar o e-mail de verificação.')
    }
    setSendingEmail(false)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Coluna 1 e 2: Dados da Conta e Foto */}
      <div className="lg:col-span-2 space-y-8">
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white">Dados Pessoais & Exibição</h2>
              <p className="text-xs text-slate-400">
                Atualize sua foto, username e informações para compras.
              </p>
            </div>

            {/* Status do E-mail */}
            <div className="flex items-center gap-2">
              {user.emailConfirmedAt ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  E-mail Verificado
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleSendVerification}
                  disabled={sendingEmail}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition cursor-pointer disabled:opacity-50"
                >
                  <MailWarning className="w-3.5 h-3.5" />
                  {sendingEmail ? 'Enviando...' : 'Verificar E-mail'}
                </button>
              )}
            </div>
          </div>

          {emailStatus && (
            <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-300">
              {emailStatus}
            </div>
          )}

          {profileState.error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400">
              {profileState.error}
            </div>
          )}

          {profileState.success && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400">
              Perfil atualizado com sucesso!
            </div>
          )}

          <form action={profileAction} className="space-y-5">
            {/* Avatar Upload */}
            <div className="flex items-center gap-5">
              <div className="relative w-20 h-20 rounded-full bg-slate-950 border-2 border-cyan-500/40 overflow-hidden flex items-center justify-center shrink-0">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={user.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserIcon className="w-8 h-8 text-slate-500" />
                )}
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="avatar-upload"
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5 text-cyan-400" />
                  Escolher Foto de Perfil
                </label>
                <input
                  id="avatar-upload"
                  name="avatar"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                <p className="text-[11px] text-slate-500">JPG, PNG ou WebP até 5 MB.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Username (Exibição)
                </label>
                <input
                  name="username"
                  type="text"
                  required
                  defaultValue={user.username}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Nome Completo
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  defaultValue={user.name ?? ''}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  E-mail da Conta
                </label>
                <input
                  type="email"
                  disabled
                  value={user.email}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950/50 border border-slate-800/60 text-sm text-slate-500 cursor-not-allowed"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Data de Nascimento
                </label>
                <input
                  name="birthDate"
                  type="date"
                  defaultValue={user.birthDate ?? ''}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Telefone / WhatsApp
                </label>
                <input
                  name="phone"
                  type="text"
                  placeholder="(15) 99999-9999"
                  defaultValue={user.phone ?? ''}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  CPF (para emissão / envio)
                </label>
                <input
                  name="cpf"
                  type="text"
                  placeholder="000.000.000-00"
                  defaultValue={user.cpf ?? ''}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSavingProfile}
                className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-lg transition cursor-pointer"
              >
                {isSavingProfile ? 'Salvando...' : 'Salvar Dados do Perfil'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Coluna 3: Endereços de Entrega */}
      <div className="space-y-6">
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <MapPin className="w-4 h-4 text-cyan-400" />
            <h2 className="text-base font-bold text-white">Meus Endereços</h2>
          </div>

          {addresses.length === 0 ? (
            <p className="text-xs text-slate-400">Nenhum endereço cadastrado ainda.</p>
          ) : (
            <div className="space-y-3">
              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                    addr.isDefault
                      ? 'border-cyan-500/40 bg-cyan-950/20'
                      : 'border-slate-800 bg-slate-950/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-200">
                      {addr.street}, {addr.number}
                    </span>
                    {addr.isDefault && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                        Padrão
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400">
                    {addr.neighborhood} — {addr.city}/{addr.state} • CEP {addr.zipCode}
                  </p>
                  <div className="flex items-center gap-3 pt-1">
                    {!addr.isDefault && (
                      <button
                        type="button"
                        onClick={() => setDefaultAddressAction(addr.id)}
                        className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:underline cursor-pointer"
                      >
                        <Star className="w-3 h-3" /> Tornar padrão
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteAddressAction(addr.id)}
                      className="inline-flex items-center gap-1 text-[11px] text-rose-400 hover:underline cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" /> Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Novo Endereço */}
          <form action={addressAction} className="space-y-3 pt-4 border-t border-slate-800">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Adicionar Endereço
            </h3>

            {addressState.error && (
              <p className="text-xs text-rose-400">{addressState.error}</p>
            )}

            <input
              name="zipCode"
              type="text"
              required
              placeholder="CEP (00000-000)"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                name="street"
                type="text"
                required
                placeholder="Rua / Avenida"
                className="col-span-2 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
              />
              <input
                name="number"
                type="text"
                required
                placeholder="Nº"
                className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
              />
            </div>
            <input
              name="complement"
              type="text"
              placeholder="Complemento (opcional)"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
            />
            <input
              name="neighborhood"
              type="text"
              required
              placeholder="Bairro"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                name="city"
                type="text"
                required
                placeholder="Cidade"
                className="col-span-2 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
              />
              <input
                name="state"
                type="text"
                required
                maxLength={2}
                placeholder="UF"
                className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white uppercase"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input name="isDefault" type="checkbox" className="accent-cyan-500" />
              Definir como endereço principal
            </label>

            <button
              type="submit"
              disabled={isSavingAddress}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 font-bold text-xs rounded-lg transition cursor-pointer"
            >
              {isSavingAddress ? 'Adicionando...' : '+ Salvar Endereço'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}