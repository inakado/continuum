"use client";
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReviewerKeyCreate } from '@continuum/shared';
import { reviewerApi } from '@/lib/assessment/reviewer.api';
import { reviewerQueryKeys } from '@/lib/query/keys';
import { apiErrorMessage } from '@/lib/api/error-message';

export function useReviewerAccess() {
  const client = useQueryClient();
  const keys = useQuery({ queryKey: reviewerQueryKeys.keys(), queryFn: reviewerApi.keys });
  const targets = useQuery({ queryKey: reviewerQueryKeys.targets(), queryFn: reviewerApi.targets });
  const revoke = useMutation({ mutationFn: reviewerApi.revokeKey, onSuccess: () => client.invalidateQueries({ queryKey: reviewerQueryKeys.keys() }) });
  return { keys, targets, revoke };
}

// The one-time secret and issuance password must never enter a TanStack mutation cache.
export function useReviewerKeyCreation() {
  const client = useQueryClient();
  const request = useRef<AbortController | null>(null);
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => () => request.current?.abort(), []);
  function clear() {
    request.current?.abort(); request.current = null;
    setSecret(''); setError(''); setBusy(false);
  }
  async function create(input: ReviewerKeyCreate) {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError('');
    try {
      const result = await reviewerApi.createKey(input, controller.signal);
      if (!controller.signal.aborted) setSecret(result.key);
    } catch (cause) {
      if (!controller.signal.aborted) setError(apiErrorMessage(cause));
    } finally {
      void client.invalidateQueries({ queryKey: reviewerQueryKeys.keys() });
      if (request.current === controller) { request.current = null; setBusy(false); }
    }
  }
  return { secret, busy, error, create, clear };
}
