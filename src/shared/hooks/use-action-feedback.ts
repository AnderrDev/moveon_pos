'use client'

import { useEffect, useRef } from 'react'
import { useToast } from '@/shared/components/feedback/ToastProvider'

export type FeedbackActionState = {
  status?: 'idle' | 'success' | 'error'
  message?: string
  error: string | null
}

interface UseActionFeedbackOptions<TState extends FeedbackActionState> {
  state: TState
  pending: boolean
  onSuccess?: (state: TState) => void
  successMessage?: string
  errorTitle?: string
  showSuccessToast?: boolean
  showErrorToast?: boolean
}

export function useActionFeedback<TState extends FeedbackActionState>({
  state,
  pending,
  onSuccess,
  successMessage,
  errorTitle = 'No se pudo completar la acción',
  showSuccessToast = true,
  showErrorToast = false,
}: UseActionFeedbackOptions<TState>) {
  const toast = useToast()
  const wasPending = useRef(false)

  useEffect(() => {
    if (!wasPending.current || pending) {
      wasPending.current = pending
      return
    }

    if (state.error) {
      if (showErrorToast) toast.error(state.error, errorTitle)
    } else {
      const message = state.message ?? successMessage
      if (showSuccessToast && message) toast.success(message)
      onSuccess?.(state)
    }

    wasPending.current = pending
  }, [
    pending,
    state,
    toast,
    onSuccess,
    successMessage,
    errorTitle,
    showSuccessToast,
    showErrorToast,
  ])
}
