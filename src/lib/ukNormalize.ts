export function norm(s: string) {
  const map: Record<string, string> = {
    yo: 'е',
    ye: 'є',
    yi: 'ї',
    y: 'и',
    i: 'і',
    e: 'е',
    g: 'г',
    h: 'х',
    // спрощений трансліт ENG/RU → укр. (достатньо для міст)
    a: 'а',
    b: 'б',
    v: 'в',
    k: 'к',
    m: 'м',
    n: 'н',
    o: 'о',
    p: 'п',
    r: 'р',
    s: 'с',
    t: 'т',
    l: 'л',
    d: 'д',
    f: 'ф',
    u: 'у',
    z: 'з',
  }
  let x = s
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')

  x = x.replace(/[a-z]/g, (ch) => map[ch] ?? ch)

  return x.replace(/\s+/g, ' ').trim()
}
