'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { initMercadoPago, Payment } from '@mercadopago/sdk-react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  QrCode,
  RefreshCw,
} from 'lucide-react'
import { processOrderPaymentAction } from '@/app/actions/order_actions'
import { verifyOrderPaymentStatusAction } from '@/app/actions/mercadopago_actions'

export interface MercadoPagoBrickProps {
  preferenceId: string | null
  orderId: string
  amount: number
  payerEmail?: string
  payerName?: string | null
}

const PUBLIC_KEY = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY || ''

if (PUBLIC_KEY) {
  initMercadoPago(PUBLIC_KEY, { locale: 'pt-BR' })
}

export default function MercadoPagoBrick({
  preferenceId,
  orderId,
  amount,
  payerEmail,
  payerName,
}: MercadoPagoBrickProps) {
  const router = useRouter()
  const [isApproved, setIsApproved] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [pixData, setPixData] = useState<{
    paymentId?: string
    qrCode: string | null
    qrCodeBase64: string | null
    ticketUrl: string | null
  } | null>(null)
  const [copiedPix, setCopiedPix] = useState(false)
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)

  const nameParts = (payerName || '').trim().split(/\s+/)
  const firstName = nameParts[0] || undefined
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined

  const handleCopyPix = async () => {
    if (!pixData?.qrCode) return
    try {
      await navigator.clipboard.writeText(pixData.qrCode)
      setCopiedPix(true)
      setTimeout(() => setCopiedPix(false), 3000)
    } catch {
      setErrorMessage(
        'Não foi possível copiar automaticamente. Selecione e copie o código PIX.'
      )
    }
  }

  if (isApproved) {
    return (
      <div className="p-8 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-4">
        <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-white">Pagamento Confirmado!</h3>
          <p className="text-xs text-slate-300">
            Recebemos a confirmação do seu pagamento. Seu pedido já está sendo preparado pela equipe Lúmen 3D.
          </p>
        </div>
        <Link
          href="/profile/orders"
          className="inline-block px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl transition"
        >
          Acompanhar em Meus Pedidos
        </Link>
      </div>
    )
  }

  if (pixData && (pixData.qrCode || pixData.qrCodeBase64)) {
    return (
      <div className="p-6 rounded-2xl bg-slate-950/80 border border-cyan-500/30 space-y-5 text-center">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold">
            <QrCode className="w-4 h-4" />
            PIX Gerado com Sucesso
          </div>
          <h3 className="text-base font-bold text-white pt-1">
            Escaneie o QR Code ou use o PIX Copia e Cola
          </h3>
          <p className="text-xs text-slate-400">
            Após o pagamento no aplicativo do seu banco, a confirmação ocorre automaticamente em poucos segundos.
          </p>
        </div>

        {pixData.qrCodeBase64 && (
          <div className="bg-white p-4 rounded-2xl w-52 h-52 mx-auto flex items-center justify-center shadow-lg">
            <img
              src={`data:image/png;base64,${pixData.qrCodeBase64}`}
              alt="QR Code PIX"
              className="w-full h-full object-contain"
            />
          </div>
        )}

        {pixData.qrCode && (
          <div className="space-y-2 text-left">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Código PIX (Copia e Cola)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={pixData.qrCode}
                className="flex-1 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 font-mono focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyPix}
                className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                {copiedPix ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            disabled={isCheckingStatus}
            onClick={async () => {
              setIsCheckingStatus(true)
              setErrorMessage(null)
              try {
                const check = await verifyOrderPaymentStatusAction(
                  orderId,
                  pixData.paymentId
                )
                if (check.isPaid) {
                  setIsApproved(true)
                }
                router.refresh()
              } finally {
                setIsCheckingStatus(false)
              }
            }}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs transition inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-cyan-400 ${
                isCheckingStatus ? 'animate-spin' : ''
              }`}
            />
            <span>
              {isCheckingStatus
                ? 'Verificando...'
                : 'Já paguei • Verificar Status'}
            </span>
          </button>
          <Link
            href="/profile/orders"
            className="px-4 py-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-bold text-xs transition"
          >
            Ir para Meus Pedidos
          </Link>
        </div>
      </div>
    )
  }

  if (!PUBLIC_KEY) {
    return (
      <div className="p-6 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-2">
        <div className="flex items-center gap-2 font-bold text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Chave pública do Mercado Pago não configurada</span>
        </div>
        <p className="text-slate-300 leading-relaxed">
          Defina{' '}
          <code className="text-cyan-400 font-mono">
            NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY
          </code>{' '}
          e <code className="text-cyan-400 font-mono">MERCADOPAGO_ACCESS_TOKEN</code>{' '}
          no seu arquivo <code className="font-mono">.env</code> e reinicie o servidor para renderizar o Checkout Bricks.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="rounded-xl overflow-hidden border border-slate-800/80 bg-slate-950/60 p-2 sm:p-4">
        <Payment
          initialization={{
            amount,
            ...(preferenceId ? { preferenceId } : {}),
            payer: {
              email: payerEmail,
              firstName,
              lastName,
            },
          }}
          customization={{
            paymentMethods: {
              bankTransfer: 'all',
              creditCard: 'all',
              debitCard: 'all',
              maxInstallments: 12,
            },
            visual: {
              style: {
                theme: 'dark',
              },
            },
          }}
          onSubmit={async ({ formData }) => {
            setErrorMessage(null)
            const result = await processOrderPaymentAction(orderId, formData)

            if (!result.success) {
              setErrorMessage(
                result.error ||
                  'Não foi possível concluir o pagamento. Verifique os dados e tente novamente.'
              )
              return
            }

            if (result.status === 'approved') {
              setIsApproved(true)
              router.refresh()
              return
            }

            if (result.qrCode || result.qrCodeBase64) {
              setPixData({
                paymentId: result.paymentId,
                qrCode: result.qrCode ?? null,
                qrCodeBase64: result.qrCodeBase64 ?? null,
                ticketUrl: result.ticketUrl ?? null,
              })
              return
            }

            router.push('/profile/orders')
          }}
          onError={(error) => {
            console.error('Erro no Mercado Pago Payment Brick:', error)
            setErrorMessage(
              'Não foi possível inicializar o módulo de pagamento. Verifique sua conexão ou chave pública.'
            )
          }}
        />
      </div>
    </div>
  )
}
