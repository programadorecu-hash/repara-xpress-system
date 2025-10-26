import api from './api';

export async function fetchCashTransactions(accountId, { skip, limit } = {}) {
  if (!accountId) {
    throw new Error('accountId is required to fetch transactions');
  }

  const params = {};
  if (typeof skip !== 'undefined') {
    params.skip = skip;
  }
  if (typeof limit !== 'undefined') {
    params.limit = limit;
  }

  const response = await api.get(`/cash-accounts/${accountId}/transactions/`, {
    params,
  });
  return response.data;
}

export async function createCashTransaction(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('A payload object is required to create a cash transaction');
  }

  const response = await api.post('/cash-transactions/', payload);
  return response.data;
}
