import { CareIcon, CareIconName } from './CareIcon'

type CareRule = {
  id: string
  icon: CareIconName
  text: string
}

const CARE_RULES: CareRule[] = [
  {
    id: 'r1',
    icon: 'handwash',
    text: 'Тільки делікатне ручне прання. Не тріть виріб щіткою. Перед пранням зніміть брелоки та всі металеві змінні деталі.',
  },
  {
    id: 'r2',
    icon: 'temp30',
    text: 'У разі забруднення – сполосніть у прохолодній воді 30ºC. Не допускайте потрапляння агресивних хімічних засобів.',
  },
  {
    id: 'r3',
    icon: 'dryFlat',
    text: 'Сушіть тільки природним способом, поклавши виріб на рушник у горизонтальному положенні.',
  },
  {
    id: 'r4',
    icon: 'info',
    text: 'Зберігайте сумку в горизонтальному положенні або на полиці, щоб уникнути деформації плетіння.',
  },
  {
    id: 'r5',
    icon: 'info',
    text: 'Щоб аксесуар зберігав форму й блиск, уникайте сильного тиску та контакту з гострими предметами.',
  },
]

export function CareInfoBlock() {
  return (
    <div className="mt-4 text-sm leading-relaxed text-gray-800">
      <p className="font-medium mb-4">Догляд:</p>
      <ul className="space-y-4">
        {CARE_RULES.map((rule) => (
          <li key={rule.id} className="flex gap-3">
            <CareIcon name={rule.icon} />
            <p>{rule.text}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
