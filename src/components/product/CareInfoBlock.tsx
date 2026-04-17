import { CareIcon, CareIconName } from './CareIcon'
import { useLocale } from '@/lib/i18n'

type CareRule = {
  id: string
  icon: CareIconName
  textUk: string
  textEn: string
}

const CARE_RULES: CareRule[] = [
  {
    id: 'r1',
    icon: 'handwash',
    textUk:
      'Тільки делікатне ручне прання. Не тріть виріб щіткою. Перед пранням зніміть брелоки та всі металеві змінні деталі.',
    textEn:
      'Delicate hand wash only. Do not scrub with a brush. Remove keychains and metal details before washing.',
  },
  {
    id: 'r2',
    icon: 'temp30',
    textUk:
      'У разі забруднення – сполосніть у прохолодній воді 30ºC. Не допускайте потрапляння агресивних хімічних засобів.',
    textEn:
      'If dirty, rinse in cool water (30°C). Avoid aggressive chemical agents.',
  },
  {
    id: 'r3',
    icon: 'dryFlat',
    textUk:
      'Сушіть тільки природним способом, поклавши виріб на рушник у горизонтальному положенні.',
    textEn: 'Dry naturally on a towel in a horizontal position.',
  },
  {
    id: 'r4',
    icon: 'info',
    textUk:
      'Зберігайте сумку в горизонтальному положенні або на полиці, щоб уникнути деформації плетіння.',
    textEn:
      'Store the bag horizontally or on a shelf to prevent weave deformation.',
  },
  {
    id: 'r5',
    icon: 'info',
    textUk:
      'Щоб аксесуар зберігав форму й блиск, уникайте сильного тиску та контакту з гострими предметами.',
    textEn:
      'To keep shape and shine, avoid strong pressure and contact with sharp objects.',
  },
]

export function CareInfoBlock() {
  const locale = useLocale()
  return (
    <div className="mt-4 text-sm leading-relaxed text-gray-800">
      <p className="font-medium mb-4">{locale === 'en' ? 'Care:' : 'Догляд:'}</p>
      <ul className="space-y-4">
        {CARE_RULES.map((rule) => (
          <li key={rule.id} className="flex gap-3">
            <CareIcon name={rule.icon} />
            <p>{locale === 'en' ? rule.textEn : rule.textUk}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
