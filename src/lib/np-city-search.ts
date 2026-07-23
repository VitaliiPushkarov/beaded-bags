const APOSTROPHE_RE = /[\u02bc\u02bb\u2018\u2019\u201b\u00b4`]/g
const HYPHEN_RE = /[\u2010-\u2015\u2212]/g
const CYRILLIC_RE = /[А-Яа-яЁёІіЇїЄєҐґ]/

const LATIN_CITY_ALIASES: Record<string, string> = {
  kiev: 'Київ',
  kyiv: 'Київ',
  lvov: 'Львів',
  lviv: 'Львів',
  odessa: 'Одеса',
  odesa: 'Одеса',
  kharkiv: 'Харків',
  kharkov: 'Харків',
  dnepr: 'Дніпро',
  dnipro: 'Дніпро',
  dnipropetrovsk: 'Дніпро',
  zaporizhia: 'Запоріжжя',
  zaporizhzhia: 'Запоріжжя',
  zaporozhye: 'Запоріжжя',
  'ivano frankivsk': 'Івано-Франківськ',
  'ivano-frankivsk': 'Івано-Франківськ',
  ternopil: 'Тернопіль',
  chernivtsi: 'Чернівці',
  rovno: 'Рівне',
  rivne: 'Рівне',
  lutsk: 'Луцьк',
  poltava: 'Полтава',
  chernigov: 'Чернігів',
  chernihiv: 'Чернігів',
  cherkassy: 'Черкаси',
  cherkasy: 'Черкаси',
  sumy: 'Суми',
  zhitomir: 'Житомир',
  zhytomyr: 'Житомир',
  uzhgorod: 'Ужгород',
  uzhhorod: 'Ужгород',
  nikolaev: 'Миколаїв',
  nikolayev: 'Миколаїв',
  mykolaiv: 'Миколаїв',
  kherson: 'Херсон',
  kamenskoe: "Кам'янське",
  kamianske: "Кам'янське",
  kamyanske: "Кам'янське",
  'belaya tserkov': 'Біла Церква',
  'bila tserkva': 'Біла Церква',
  'sofiivska borshchahivka': 'Софіївська Борщагівка',
}

function addUnique(values: string[], value: string) {
  if (value && !values.includes(value)) values.push(value)
}

function latinAliasKey(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(APOSTROPHE_RE, '')
    .replace(HYPHEN_RE, '-')
    .replace(/[^a-z0-9-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripSettlementPrefix(value: string) {
  return value.replace(
    /^(?:м|с|смт|сел|місто|село|селище)\.?\s+/iu,
    '',
  )
}

function withLikelyApostrophes(value: string) {
  return value.replace(/([бпвмфрБПВМФР])([яюєїЯЮЄЇ])/g, "$1'$2")
}

export function normalizeNpCityQuery(value: string) {
  return value
    .normalize('NFC')
    .replace(APOSTROPHE_RE, "'")
    .replace(HYPHEN_RE, '-')
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeCityComparable(value: string) {
  return normalizeNpCityQuery(value)
    .toLowerCase()
    .replace(/['-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildNpCityQueryVariants(raw: string) {
  const variants: string[] = []
  const normalized = normalizeNpCityQuery(raw)
  const withoutPrefix = stripSettlementPrefix(normalized)
  const alias = LATIN_CITY_ALIASES[latinAliasKey(raw)]

  for (const candidate of [
    normalized,
    withoutPrefix,
    withoutPrefix.replace(/\s+/g, '-'),
    withLikelyApostrophes(normalized),
    alias,
  ]) {
    const value = normalizeNpCityQuery(candidate || '')
    if (value.length >= 2 && CYRILLIC_RE.test(value)) addUnique(variants, value)
  }

  return variants
}

export function dedupeCityOptions<
  T extends {
    settlementRef?: string
    ref?: string
    area?: string
    region?: string
    type?: string
    name: string
  },
>(rows: T[]) {
  const seen = new Set<string>()

  return rows.filter((row) => {
    const key =
      row.settlementRef ||
      row.ref ||
      [row.area, row.region, row.type, row.name].join('|')

    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
