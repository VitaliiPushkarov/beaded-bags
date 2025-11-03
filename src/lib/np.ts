export type NPResp<T> = { success: boolean; data: T; errors: string[] }

const NP_URL = 'https://api.novaposhta.ua/v2.0/json/'

export async function npCall<T>(
  modelName: 'AddressGeneral' | 'Address',
  calledMethod: string,
  methodProperties: Record<string, string | number | boolean | null | undefined>
) {
  const apiKey = process.env.NOVA_POSHTA_API_KEY!
  if (!apiKey) throw new Error('Missing NOVA_POSHTA_API_KEY')

  const res = await fetch(NP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({
      apiKey,
      modelName,
      calledMethod,
      methodProperties,
    }),
  })

  const json = (await res.json()) as NPResp<T>
  if (!json.success) {
    throw new Error(json.errors?.join(', ') || 'NP error')
  }
  return json.data
}
