import type { ProductType } from '@prisma/client'
import type { Locale } from '@/lib/locale'

type ProductGroup = '' | 'BEADS' | 'WEAVING'

export type CategoryFaqItem = {
  question: string
  answer: string
}

export type ShopCategoryConfig = {
  slug: string
  title: string
  metaTitle: string
  metaDescription: string
  intro: string
  faqs: CategoryFaqItem[]
  type?: ProductType
  types?: ProductType[]
  group?: ProductGroup
  redirectTo?: string
}

export type AccessorySubcategoryConfig = {
  slug: string
  label: string
  metaTitle: string
  metaDescription: string
  intro: string
  faqs: CategoryFaqItem[]
  keywords: string[]
}

const SHOP_CATEGORY_CONFIG: Record<string, ShopCategoryConfig> = {
  sumky: {
    slug: 'sumky',
    title: 'Сумки',
    metaTitle: 'Сумки ручної роботи',
    metaDescription:
      'Сумки ручної роботи GERDAN: актуальні моделі на щодень та акцентні образи.',
    intro: `Сумка — це не просто аксесуар, а важлива частина образу, яка може підкреслити стиль, настрій і навіть характер. У категорії сумок ви знайдете різноманітні моделі: плетені сумки, сумки з бісеру, класичні та спортивні варіанти, моделі для вечірніх виходів і повсякденного використання.

Особливе місце займають сумки ручної роботи. Плетені сумки та сумки з бісеру поєднують традиційні техніки та сучасний дизайн, створюючи унікальні аксесуари. Кожна така сумка відрізняється текстурою, кольором і характером, тому вона легко стає центральним елементом образу.

Сумки трендових кольорів допомагають додати яскравий акцент у гардероб. У колекціях можна знайти як класичні чорні або нейтральні моделі, так і сумки у насичених відтінках — рожеві, червоні, зелені або пастельні. Вони чудово поєднуються як з повсякденним стилем, так і з вечірніми образами.

Для активного ритму життя ідеально підходять повсякденні сумки та спортивні моделі. Вони зручні, практичні та місткі, що дозволяє брати із собою все необхідне протягом дня. Для особливих подій можна обрати елегантні вечірні сумки — компактні та ефектні.

Сучасні сумки створюються з урахуванням не лише стилю, але й функціональності. Продумана форма, якісні матеріали та увага до деталей роблять їх надійними аксесуарами, які служать довго.

У нашому магазині представлені різні типи сумок — від мінімалістичних до яскравих дизайнерських моделей. Завдяки великому вибору кожен може знайти сумку, яка ідеально доповнить його стиль.`,

    type: 'BAG',
    faqs: [
      {
        question: 'Які сумки ручної роботи найкраще підходять на щодень?',
        answer:
          'Найчастіше на щодень обирають моделі середнього розміру з нейтральною палітрою, які легко поєднуються з базовим гардеробом.',
      },
      {
        question: 'Чи можна носити сумки GERDAN у мінімалістичних образах?',
        answer:
          'Так, сумки ручної роботи добре працюють як акцент навіть у стриманих образах, якщо решта елементів залишаються лаконічними.',
      },
      {
        question: 'Як підібрати розмір сумки під формат дня?',
        answer:
          'Для щоденних справ зручніші середні та місткі моделі, а для подій і зустрічей часто обирають компактні формати.',
      },
      {
        question: 'Чи є сумки GERDAN хорошим подарунком?',
        answer:
          'Так, ручна робота і впізнаваний дизайн роблять сумку персональним подарунком з високою емоційною цінністю.',
      },
    ],
  },
  bananky: {
    slug: 'bananky',
    title: 'Бананки',
    metaTitle: 'Бананки ручної роботи',
    metaDescription:
      'Бананки GERDAN ручної роботи: компактний формат для міста, подорожей і активного ритму.',
    intro: `Бананка — це практичний і стильний аксесуар, який став невід’ємною частиною сучасного гардеробу. Вона поєднує компактність, функціональність та модний дизайн, що робить її ідеальним вибором для щоденного використання.

Бананки зручно носити на поясі або через плече, тому вони підходять як для активного міського ритму, так і для подорожей. У такій сумці легко розмістити найнеобхідніші речі: телефон, ключі, документи або гаманець.

Сучасні бананки представлені у різних стилях — від мінімалістичних моделей до яскравих дизайнерських варіантів. Вони добре поєднуються з повсякденним одягом, спортивними луками та street style образами.

Компактний розмір, легкість та зручність роблять бананку універсальним аксесуаром, який підходить для прогулянок, подорожей або активного відпочинку.`,
    type: 'BELT_BAG',
    faqs: [
      {
        question: 'Коли бананка зручніша за класичну сумку?',
        answer:
          'Бананка зручна у динамічних сценаріях: прогулянки, подорожі, події, коли важливі вільні руки і компактність.',
      },
      {
        question: 'Як носити бананку у сучасних образах?',
        answer:
          'Найпопулярніші варіанти: через плече або на пояс, з акцентом на чистий силует і мінімум зайвих деталей.',
      },
      {
        question: 'Чи підходить бананка для щоденного використання?',
        answer:
          'Так, якщо потрібен базовий набір речей під рукою і легка, мобільна альтернатива великій сумці.',
      },
      {
        question: 'З чим краще поєднувати бананки GERDAN?',
        answer:
          'Найпростіше комбінувати їх з денімом, тренчами, куртками і базовим трикотажем у нейтральній гамі.',
      },
    ],
  },
  shopery: {
    slug: 'shopery',
    title: 'Шопери',
    metaTitle: 'Шопери ручної роботи',
    metaDescription:
      'Шопери GERDAN ручної роботи: місткі моделі для щоденних справ, офісу і подорожей містом.',
    intro: `Шопер — це універсальна сумка великого розміру, яка поєднує практичність і стиль. Вона ідеально підходить для покупок, навчання, роботи або повсякденних справ.

Шопери відрізняються місткістю та простотою дизайну. У таку сумку легко помістити книги, ноутбук, продукти або інші необхідні речі.

Сучасні шопери часто виготовляються з текстилю або інших міцних матеріалів, що робить їх екологічною альтернативою пластиковим пакетам.`,
    type: 'SHOPPER',
    faqs: [
      {
        question: 'Для яких задач шопер підходить найкраще?',
        answer:
          'Шопер ідеальний для щоденного міського ритму, роботи, навчання та коротких поїздок.',
      },
      {
        question: 'Як вибрати шопер для щоденного носіння?',
        answer:
          'Звертайте увагу на форму, розмір і універсальний колір, щоб сумка легко поєднувалася з базовим гардеробом.',
      },
      {
        question: 'Чи підходить шопер для мінімалістичного стилю?',
        answer:
          'Так, особливо моделі зі стриманим силуетом, які дають акуратний акцент без перевантаження образу.',
      },
      {
        question: 'Чому шопери ручної роботи популярні?',
        answer:
          'Поєднання місткості, індивідуального дизайну і ремісничої якості робить їх сильним щоденним аксесуаром.',
      },
    ],
  },
  chohly: {
    slug: 'chohly',
    title: 'Чохли',
    metaTitle: 'Чохли ручної роботи',
    metaDescription:
      'Чохли GERDAN ручної роботи: компактні аксесуари для телефону й дрібних речей з акцентним дизайном.',
    intro: `Чохли — це практичні аксесуари, які допомагають захистити особисті речі від пошкоджень, пилу або подряпин. Вони поєднують функціональність і стиль, тому можуть бути не лише корисними, але й красивими.

Чохли використовують для зберігання різних предметів: телефонів, окулярів, техніки або аксесуарів. Завдяки компактному розміру їх легко носити у сумці або рюкзаку.`,
    type: 'CASE',
    faqs: [
      {
        question: 'Чим чохли ручної роботи відрізняються від звичайних?',
        answer:
          'Вони мають більш виразну фактуру, індивідуальний вигляд і працюють не лише як функціональна, а й як стилістична деталь.',
      },
      {
        question: 'Чохли GERDAN підходять для подарунка?',
        answer:
          'Так, це компактний подарунковий формат, який легко персоналізувати за кольором і стилем.',
      },
      {
        question: 'Як поєднувати чохол з сумкою?',
        answer:
          'Найкраще працює контраст або повтор ключового кольору сумки, щоб зібрати образ в єдину композицію.',
      },
      {
        question: 'Чи практичні чохли для щоденного використання?',
        answer:
          'Так, за умови акуратного використання вони зручні для щоденних сценаріїв і додають акцент у стилі.',
      },
    ],
  },
  accessories: {
    slug: 'accessories',
    title: 'Аксесуари',
    metaTitle: 'Аксесуари ручної роботи',
    metaDescription:
      'Аксесуари ручної роботи GERDAN: брелоки, гердани, силянки, мітенки, шарфи, шапки та інші акцентні позиції.',
    intro: `Аксесуари — це деталі, які завершують образ і додають йому індивідуальності. У цій категорії представлені різні види аксесуарів: брелоки, гердани, шапки, шарфи, мітенки, резинки, чепчики та силянки.

Такі аксесуари можуть виконувати як декоративну, так і практичну функцію. Наприклад, шарфи та шапки захищають від холоду, а прикраси або брелоки додають стилю.

Багато аксесуарів створюються вручну, що робить їх особливими та унікальними.`,
    types: ['ACCESSORY'],
    faqs: [
      {
        question: 'Які аксесуари найпопулярніші для щоденного стилю?',
        answer:
          'Найчастіше обирають брелоки, гердани та компактні акцентні елементи, які легко інтегруються у базові образи.',
      },
      {
        question: 'Як обрати аксесуар, який пасуватиме до більшості речей?',
        answer:
          'Краще обирати нейтральний або вже присутній у гардеробі колір та лаконічну форму без надмірної декоративності.',
      },
      {
        question: 'Чи можна комбінувати кілька аксесуарів одночасно?',
        answer:
          'Так, але важливо залишати один головний акцент, а решту елементів робити більш стриманими.',
      },
      {
        question: 'Чи підходять аксесуари GERDAN як подарунковий формат?',
        answer:
          'Так, це популярний варіант подарунка, бо аксесуар легко персоналізувати і він має виразний візуальний ефект.',
      },
    ],
  },
  prykrasy: {
    slug: 'prykrasy',
    title: 'Прикраси',
    metaTitle: 'Аксесуари ручної роботи',
    metaDescription:
      'Прикраси перенесено до категорії “Аксесуари”. Перейдіть у розділ для перегляду актуального каталогу.',
    intro: '',
    faqs: [],
    redirectTo: 'accessories',
  },
}

export const ACCESSORY_SUBCATEGORIES: AccessorySubcategoryConfig[] = [
  {
    slug: 'breloky',
    label: 'Брелоки',
    metaTitle: 'Брелоки ручної роботи',
    metaDescription:
      'Брелоки ручної роботи GERDAN для сумок, ключів і подарункових наборів.',
    intro:
      'Брелоки — це швидкий спосіб персоналізувати сумку або зібрати невеликий подарунковий сет.',
    keywords: ['brelok', 'брелок', 'keychain'],
    faqs: [
      {
        question: 'Як підібрати брелок під сумку?',
        answer:
          'Орієнтуйтесь на контраст або повтор ключового кольору сумки, щоб зберегти цілісність образу.',
      },
      {
        question: 'Брелоки підходять для подарунка?',
        answer:
          'Так, це універсальний подарунковий формат, який легко персоналізувати кольором і формою.',
      },
      {
        question: 'Чи можна носити кілька брелоків одночасно?',
        answer:
          'Можна, але краще тримати один головний акцент і додавати другий у стриманішому стилі.',
      },
      {
        question: 'Де брелоки виглядають найдоречніше?',
        answer:
          'Найчастіше їх використовують на ручках сумок, рюкзаках або як декоративний елемент для ключів.',
      },
    ],
  },
  {
    slug: 'gerdany',
    label: 'Гердани',
    metaTitle: 'Гердани ручної роботи',
    metaDescription:
      'Гердани ручної роботи GERDAN як акцентний елемент сучасного образу.',
    intro:
      'Гердани поєднують ремісничу техніку і сучасну стилізацію, додаючи образу характерний акцент.',
    keywords: ['gerdan', 'гердан'],
    faqs: [
      {
        question: 'З яким одягом краще поєднувати гердани?',
        answer:
          'Гердани добре працюють із однотонними топами, сорочками та мінімалістичними силуетами.',
      },
      {
        question: 'Чи підходять гердани для щоденного носіння?',
        answer:
          'Так, особливо у стриманих кольорах і лаконічних формах, які легко вписати в базовий гардероб.',
      },
      {
        question: 'Чи можна комбінувати гердан з іншими прикрасами?',
        answer:
          'Так, але бажано, щоб гердан залишався головним акцентом, а інші прикраси були мінімалістичними.',
      },
      {
        question: 'Чому гердани знову в тренді?',
        answer:
          'Поєднання ручної роботи, локальної ідентичності та сучасної стилізації робить їх актуальними.',
      },
    ],
  },
  {
    slug: 'sylyanky',
    label: 'Силянки',
    metaTitle: 'Силянки ручної роботи',
    metaDescription:
      'Силянки ручної роботи GERDAN: делікатний акцент для щоденних і святкових образів.',
    intro:
      'Силянки — це компактний, виразний аксесуар, який добре працює і в мінімалістичних, і в більш декоративних стилізаціях.',
    keywords: ['sylyank', 'silyank', 'силя'],
    faqs: [
      {
        question: 'Як носити силянки у сучасному стилі?',
        answer:
          'Найкраще силянки поєднувати з простими силуетами та однотонним верхом, щоб зберегти чистий акцент.',
      },
      {
        question: 'Силянки підходять для багатошарових образів?',
        answer:
          'Так, вони добре працюють у багатошарових комплектах, якщо решта прикрас лишається мінімальною.',
      },
      {
        question: 'Чи підходять силянки на подарунок?',
        answer:
          'Так, це персональний подарунок з виразною ремісничою естетикою і символічною цінністю.',
      },
      {
        question: 'Які кольори силянок найуніверсальніші?',
        answer:
          'Найуніверсальніші — контрастні базові поєднання, які легко комбінуються з щоденним гардеробом.',
      },
    ],
  },
  {
    slug: 'mitenky',
    label: 'Мітенки',
    metaTitle: 'Мітенки ручної роботи',
    metaDescription:
      'Мітенки GERDAN ручної роботи як теплий і стильний аксесуар для холодного сезону.',
    intro:
      'Мітенки додають фактуру образу, зберігають комфорт у прохолодну погоду і підкреслюють індивідуальний стиль.',
    keywords: ['mitenk', 'мітенк', 'mitt'],
    faqs: [
      {
        question: 'Коли мітенки практичніші за рукавички?',
        answer:
          'Мітенки зручні, коли потрібна свобода пальців: смартфон, дорога, швидкі повсякденні дії.',
      },
      {
        question: 'З чим стилізувати мітенки?',
        answer:
          'Найкраще з пальтами, в’язаними речами і верхнім одягом спокійних відтінків.',
      },
      {
        question: 'Чи можна поєднувати мітенки з іншими аксесуарами?',
        answer:
          'Так, особливо з шарфами та шапками в близькій кольоровій палітрі.',
      },
      {
        question: 'Мітенки підходять для подарунка взимку?',
        answer: 'Так, це практичний і стильний подарунок для холодного сезону.',
      },
    ],
  },
  {
    slug: 'navushnyky-viazani',
    label: "Навушники в'язані",
    metaTitle: "Навушники в'язані ручної роботи",
    metaDescription:
      "В'язані навушники GERDAN ручної роботи для тепла та стилю у холодний сезон.",
    intro:
      "В'язані навушники — комфортний аксесуар для міжсезоння і зими, який легко інтегрується в міський стиль.",
    keywords: ['навушник', 'earmuff', 'vyazan', 'вязан'],
    faqs: [
      {
        question: "Коли в'язані навушники зручніші за шапку?",
        answer:
          'Коли потрібне локальне тепло і хочеться зберегти зачіску або легший верхній образ.',
      },
      {
        question: "З яким верхнім одягом поєднувати в'язані навушники?",
        answer:
          'Вони добре працюють із пальтами, короткими пуховиками й тренчами у базовій гамі.',
      },
      {
        question: "Чи можна носити в'язані навушники щодня?",
        answer:
          'Так, це комфортний варіант для міських маршрутів у прохолодну погоду.',
      },
      {
        question: "Чи підходять в'язані навушники як подарунок?",
        answer:
          'Так, це сезонний подарунок, який поєднує практичність і виразний стиль.',
      },
    ],
  },
  {
    slug: 'sharfy',
    label: 'Шарфи',
    metaTitle: 'Шарфи ручної роботи',
    metaDescription:
      'Шарфи GERDAN ручної роботи для теплих сезонних образів і щоденного комфорту.',
    intro:
      'Шарфи з цієї підкатегорії додають образу текстуру та завершеність у холодну пору року.',
    keywords: ['шарф', 'scarf'],
    faqs: [
      {
        question: 'Як підібрати шарф під верхній одяг?',
        answer:
          'Найкраще працює контраст до пальта або повтор відтінку з деталей образу: сумки, взуття, рукавичок.',
      },
      {
        question: 'Які шарфи універсальні для щодня?',
        answer:
          'Універсальними вважаються середні за обʼємом моделі у спокійній палітрі.',
      },
      {
        question: 'Чи можна поєднувати шарф і мітенки в одному кольорі?',
        answer: 'Так, це один із найпростіших способів зробити образ цілісним.',
      },
      {
        question: 'Шарф підходить як сезонний подарунок?',
        answer:
          'Так, це практичний подарунок, який часто використовують щодня у холодний сезон.',
      },
    ],
  },
  {
    slug: 'rezynky',
    label: 'Резинки',
    metaTitle: 'Резинки для волосся ручної роботи',
    metaDescription:
      'Резинки ручної роботи GERDAN як декоративний акцент для щоденних зачісок.',
    intro:
      'Резинки для волосся — компактний аксесуар, який допомагає швидко додати образу індивідуальний акцент.',
    keywords: ['rezynk', 'резинк', 'scrunch'],
    faqs: [
      {
        question: 'Як підібрати резинку під щоденний стиль?',
        answer:
          'Краще обирати відтінки, що повторюють деталі в одязі або аксесуарах для цілісного вигляду.',
      },
      {
        question: 'Чи доречні резинки як подарунок?',
        answer:
          'Так, це доступний і практичний формат подарунка, який легко персоналізувати.',
      },
      {
        question: 'Чи можна комбінувати резинки з іншими аксесуарами GERDAN?',
        answer:
          'Так, вони добре працюють у парі з сумками і брелоками в близькій кольоровій палітрі.',
      },
      {
        question: 'Резинки підходять лише для повсякденних образів?',
        answer:
          'Ні, залежно від моделі їх можна інтегрувати і в більш зібрані, подієві стилізації.',
      },
    ],
  },
  {
    slug: 'shapky',
    label: 'Шапки',
    metaTitle: 'Шапки ручної роботи',
    metaDescription:
      'Шапки GERDAN ручної роботи для холодного сезону: комфорт, фактура і стиль.',
    intro:
      'Шапки з цієї підкатегорії створені для тепла і візуального балансу в осінньо-зимових образах.',
    keywords: ['шапк', 'hat', 'beanie'],
    faqs: [
      {
        question: 'Як підібрати шапку до форми обличчя?',
        answer:
          'Зазвичай обирають модель, що врівноважує пропорції і гармонійно поєднується з лініями верхнього одягу.',
      },
      {
        question: 'З яким одягом шапки GERDAN поєднуються найкраще?',
        answer:
          'Вони добре працюють із пальтами, пуховиками та фактурним трикотажем.',
      },
      {
        question: 'Чи варто комбінувати шапку з шарфом в одному кольорі?',
        answer:
          'Так, це класичне поєднання для цілісного і зібраного сезонного образу.',
      },
      {
        question: 'Шапка ручної роботи підходить на подарунок?',
        answer:
          'Так, це практичний сезонний подарунок, який часто використовується щодня.',
      },
    ],
  },
  {
    slug: 'chepchyky',
    label: 'Чепчики',
    metaTitle: 'Чепчики ручної роботи',
    metaDescription:
      'Чепчики GERDAN ручної роботи як виразний сезонний аксесуар для стильних образів.',
    intro:
      'Чепчики — акцентна позиція для тих, хто хоче додати образу характер і сучасне прочитання ремісничих форм.',
    keywords: ['чепчик', 'chepch', 'bonnet'],
    faqs: [
      {
        question: 'Коли чепчик найкраще виглядає в образі?',
        answer:
          'Найкраще чепчик працює у мінімалістичних комплектах, де він стає головним акцентом.',
      },
      {
        question: 'З чим поєднувати чепчики ручної роботи?',
        answer:
          'Їх часто комбінують із базовими пальтами, тренчами й однотонним трикотажем.',
      },
      {
        question: 'Чи підходить чепчик для щоденного носіння?',
        answer:
          'Так, якщо обрати модель у стриманій палітрі, яку легко поєднувати з верхнім гардеробом.',
      },
      {
        question: 'Чепчики можуть бути подарунковим варіантом?',
        answer:
          'Так, це оригінальний подарунок для тих, хто цінує нестандартні аксесуари ручної роботи.',
      },
    ],
  },
]

type LocalizedShopCategoryFields = Pick<
  ShopCategoryConfig,
  'title' | 'metaTitle' | 'metaDescription' | 'intro' | 'faqs'
>

type LocalizedAccessorySubcategoryFields = Pick<
  AccessorySubcategoryConfig,
  'label' | 'metaTitle' | 'metaDescription' | 'intro' | 'faqs'
>

const SHOP_CATEGORY_EN_CONTENT: Partial<
  Record<string, LocalizedShopCategoryFields>
> = {
  sumky: {
    title: 'Bags',
    metaTitle: 'Handmade Bags',
    metaDescription:
      'GERDAN handmade bags: everyday essentials and statement pieces.',
    intro:
      'Bags in this category combine craftsmanship with modern styling for everyday and occasion looks.',
    faqs: [
      {
        question: 'Which handmade bags work best for everyday use?',
        answer:
          'Medium-size bags in neutral colors are usually the most versatile for daily outfits.',
      },
      {
        question: 'Can GERDAN bags fit minimalist outfits?',
        answer:
          'Yes, handmade bags can be a strong accent while the rest of the look stays clean and simple.',
      },
      {
        question: 'How should I choose the right bag size?',
        answer:
          'Choose roomier formats for daily errands and compact formats for meetings or events.',
      },
      {
        question: 'Are GERDAN bags a good gift choice?',
        answer:
          'Yes, handmade quality and distinctive design make them a personal and memorable gift.',
      },
    ],
  },
  bananky: {
    title: 'Belt Bags',
    metaTitle: 'Handmade Belt Bags',
    metaDescription:
      'GERDAN handmade belt bags: compact format for city life, travel, and active days.',
    intro:
      'Belt bags are a practical, lightweight accessory for everyday movement and quick city routes.',
    faqs: [
      {
        question: 'When is a belt bag better than a classic bag?',
        answer:
          'It works best in dynamic scenarios where compactness and free hands matter most.',
      },
      {
        question: 'How to style a belt bag in modern looks?',
        answer:
          'Most often worn crossbody or on the waist with a clean silhouette and minimal extra detail.',
      },
      {
        question: 'Is a belt bag suitable for daily use?',
        answer:
          'Yes, it is a great option when you only need everyday essentials close at hand.',
      },
      {
        question: 'What pairs best with GERDAN belt bags?',
        answer:
          'They pair easily with denim, trench coats, jackets, and neutral knitwear.',
      },
    ],
  },
  shopery: {
    title: 'Shoppers',
    metaTitle: 'Handmade Shoppers',
    metaDescription:
      'GERDAN handmade shoppers: roomy bags for everyday routines, office, and city errands.',
    intro:
      'Shoppers are roomy and practical bags designed for everyday tasks, work, and short trips.',
    faqs: [
      {
        question: 'What is a shopper best used for?',
        answer:
          'A shopper is ideal for daily city life, work, study, and short day-to-day routes.',
      },
      {
        question: 'How to choose a shopper for regular wear?',
        answer:
          'Focus on shape, size, and a versatile color that fits your core wardrobe.',
      },
      {
        question: 'Can a shopper match a minimalist style?',
        answer:
          'Yes, especially clean silhouettes that add structure without visual overload.',
      },
      {
        question: 'Why are handmade shoppers popular?',
        answer:
          'Their mix of capacity, individual design, and craft quality makes them a strong daily accessory.',
      },
    ],
  },
  chohly: {
    title: 'Cases',
    metaTitle: 'Handmade Cases',
    metaDescription:
      'GERDAN handmade cases: compact accessories for phones and essentials with a distinct look.',
    intro:
      'Cases help protect small personal items while adding a clear handmade accent to the overall look.',
    faqs: [
      {
        question: 'How are handmade cases different from standard ones?',
        answer:
          'They offer stronger texture, a more individual look, and a stylistic role beyond basic function.',
      },
      {
        question: 'Are GERDAN cases suitable as a gift?',
        answer:
          'Yes, they are compact and easy to personalize by color and style preferences.',
      },
      {
        question: 'How to pair a case with a bag?',
        answer:
          'A contrast tone or a repeated key color from the bag works best for a cohesive look.',
      },
      {
        question: 'Are cases practical for daily use?',
        answer:
          'Yes, with regular careful use they are convenient for daily routines and add a visible accent.',
      },
    ],
  },
  accessories: {
    title: 'Accessories',
    metaTitle: 'Handmade Accessories',
    metaDescription:
      'GERDAN handmade accessories: keychains, gerdans, sylyanky, mittens, scarves, beanies, and more.',
    intro:
      'Accessories in this category add personality and final balance to everyday and seasonal outfits.',
    faqs: [
      {
        question: 'Which accessories are most popular for daily styling?',
        answer:
          'Keychains, gerdans, and compact accent pieces are the most common everyday picks.',
      },
      {
        question: 'How to choose an accessory that matches most outfits?',
        answer:
          'Go for a neutral or already-present wardrobe color and a concise, versatile form.',
      },
      {
        question: 'Can I combine multiple accessories at once?',
        answer:
          'Yes, but it is better to keep one leading accent and make the rest more restrained.',
      },
      {
        question: 'Are GERDAN accessories good for gifting?',
        answer:
          'Yes, they are easy to personalize and create a strong visual and emotional effect.',
      },
    ],
  },
  prykrasy: {
    title: 'Jewelry',
    metaTitle: 'Handmade Accessories',
    metaDescription:
      'Jewelry has been moved to the Accessories category. Open that section to browse current items.',
    intro: '',
    faqs: [],
  },
}

const ACCESSORY_SUBCATEGORY_EN_CONTENT: Partial<
  Record<string, LocalizedAccessorySubcategoryFields>
> = {
  breloky: {
    label: 'Keychains',
    metaTitle: 'Handmade Keychains',
    metaDescription:
      'GERDAN handmade keychains for bags, keys, and small gift sets.',
    intro:
      'Keychains are a quick way to personalize a bag or build a compact gift set.',
    faqs: [
      {
        question: 'How do I choose a keychain for my bag?',
        answer:
          'Use a contrast color or repeat a key bag shade to keep the look cohesive.',
      },
      {
        question: 'Are keychains a good gift option?',
        answer:
          'Yes, they are versatile and easy to personalize by color and shape.',
      },
      {
        question: 'Can I wear more than one keychain at once?',
        answer:
          'Yes, but keep one dominant accent and add the second in a calmer style.',
      },
      {
        question: 'Where do keychains look most natural?',
        answer:
          'Most often on bag handles, backpacks, or as a decorative key detail.',
      },
    ],
  },
  gerdany: {
    label: 'Gerdans',
    metaTitle: 'Handmade Gerdans',
    metaDescription:
      'GERDAN handmade gerdans as an expressive accent for modern outfits.',
    intro:
      'Gerdans combine traditional craft techniques with modern styling for a clear focal point.',
    faqs: [
      {
        question: 'What clothing works best with gerdans?',
        answer:
          'They pair well with plain tops, shirts, and minimalist silhouettes.',
      },
      {
        question: 'Are gerdans suitable for daily wear?',
        answer:
          'Yes, especially in restrained colors and concise forms that fit basic wardrobes.',
      },
      {
        question: 'Can I combine a gerdan with other jewelry?',
        answer:
          'Yes, but let the gerdan stay the main accent and keep other pieces minimal.',
      },
      {
        question: 'Why are gerdans trending again?',
        answer:
          'The mix of handmade craft, local identity, and modern styling keeps them relevant.',
      },
    ],
  },
  sylyanky: {
    label: 'Sylyanky',
    metaTitle: 'Handmade Sylyanky',
    metaDescription:
      'GERDAN handmade sylyanky: a delicate accent for everyday and occasion looks.',
    intro:
      'Sylyanky are compact statement accessories that fit both minimalist and more decorative styling.',
    faqs: [
      {
        question: 'How to wear sylyanky in a modern way?',
        answer:
          'Pair them with simple silhouettes and a plain top to keep the accent clear.',
      },
      {
        question: 'Do sylyanky work in layered outfits?',
        answer:
          'Yes, they work well in layered looks when other jewelry remains minimal.',
      },
      {
        question: 'Are sylyanky suitable for gifting?',
        answer:
          'Yes, they are a personal gift with strong craft aesthetics and symbolic value.',
      },
      {
        question: 'Which sylyanky colors are the most universal?',
        answer:
          'High-contrast basic combinations are usually the easiest to mix with daily wardrobes.',
      },
    ],
  },
  mitenky: {
    label: 'Mittens',
    metaTitle: 'Handmade Mittens',
    metaDescription:
      'GERDAN handmade mittens as a warm and stylish accessory for cold weather.',
    intro:
      'Mittens add texture, improve comfort in cool weather, and highlight personal style.',
    faqs: [
      {
        question: 'When are mittens more practical than gloves?',
        answer:
          'They are useful when finger freedom matters: smartphone use, commuting, and quick routines.',
      },
      {
        question: 'What should I pair mittens with?',
        answer:
          'They work best with coats, knitwear, and outerwear in calm tones.',
      },
      {
        question: 'Can I combine mittens with other accessories?',
        answer:
          'Yes, especially with scarves and beanies in a related color palette.',
      },
      {
        question: 'Are mittens a good winter gift?',
        answer:
          'Yes, they are both practical and stylish for the cold season.',
      },
    ],
  },
  'navushnyky-viazani': {
    label: 'Knitted Earmuffs',
    metaTitle: 'Handmade Knitted Earmuffs',
    metaDescription:
      'GERDAN handmade knitted earmuffs for warmth and style in the cold season.',
    intro:
      'Knitted earmuffs are a comfortable accessory for transitional and winter weather in city styling.',
    faqs: [
      {
        question: 'When are knitted earmuffs better than a beanie?',
        answer:
          'When you need local warmth while keeping your hairstyle or a lighter upper look.',
      },
      {
        question: 'What outerwear matches knitted earmuffs?',
        answer:
          'They pair well with coats, short puffers, and trench coats in neutral tones.',
      },
      {
        question: 'Can knitted earmuffs be worn every day?',
        answer:
          'Yes, they are comfortable for regular city routes in cool weather.',
      },
      {
        question: 'Are knitted earmuffs a good gift?',
        answer:
          'Yes, they are a seasonal gift that combines practicality with style.',
      },
    ],
  },
  sharfy: {
    label: 'Scarves',
    metaTitle: 'Handmade Scarves',
    metaDescription:
      'GERDAN handmade scarves for warm seasonal looks and daily comfort.',
    intro:
      'Scarves in this subcategory add texture and visual completeness during colder months.',
    faqs: [
      {
        question: 'How do I choose a scarf for outerwear?',
        answer:
          'A coat contrast or a repeated tone from bag, shoes, or gloves usually works best.',
      },
      {
        question: 'Which scarves are most universal for daily wear?',
        answer:
          'Medium-volume scarves in a calm palette are typically the most versatile.',
      },
      {
        question: 'Can I match scarf and mittens in one color?',
        answer:
          'Yes, this is one of the simplest ways to make a look cohesive.',
      },
      {
        question: 'Is a scarf a good seasonal gift?',
        answer:
          'Yes, it is practical and often used every day during colder weather.',
      },
    ],
  },
  rezynky: {
    label: 'Hair Ties',
    metaTitle: 'Handmade Hair Ties',
    metaDescription:
      'GERDAN handmade hair ties as a decorative accent for daily hairstyles.',
    intro:
      'Hair ties are compact accessories that quickly add personality to a look.',
    faqs: [
      {
        question: 'How do I choose a hair tie for everyday styling?',
        answer:
          'Pick shades that repeat details from your outfit or other accessories.',
      },
      {
        question: 'Are hair ties suitable as a gift?',
        answer:
          'Yes, they are practical, affordable, and easy to personalize.',
      },
      {
        question: 'Can I combine hair ties with other GERDAN accessories?',
        answer:
          'Yes, they pair especially well with bags and keychains in related tones.',
      },
      {
        question: 'Are hair ties only for casual looks?',
        answer:
          'No, depending on the model they can also work in more polished outfits.',
      },
    ],
  },
  shapky: {
    label: 'Beanies',
    metaTitle: 'Handmade Beanies',
    metaDescription:
      'GERDAN handmade beanies for cold season comfort, texture, and style.',
    intro:
      'Beanies in this subcategory are designed for warmth and visual balance in autumn-winter outfits.',
    faqs: [
      {
        question: 'How do I choose a beanie for my face shape?',
        answer:
          'Choose a form that balances facial proportions and matches outerwear lines.',
      },
      {
        question: 'What clothing pairs best with GERDAN beanies?',
        answer:
          'They pair well with coats, puffers, and textured knitwear.',
      },
      {
        question: 'Should I match a beanie and scarf in one color?',
        answer:
          'Yes, it is a classic way to build a cohesive seasonal outfit.',
      },
      {
        question: 'Is a handmade beanie a good gift?',
        answer:
          'Yes, it is a practical seasonal gift used frequently in daily life.',
      },
    ],
  },
  chepchyky: {
    label: 'Bonnets',
    metaTitle: 'Handmade Bonnets',
    metaDescription:
      'GERDAN handmade bonnets as expressive seasonal accessories for styled looks.',
    intro:
      'Bonnets are an accent choice for people who want character and a modern interpretation of craft forms.',
    faqs: [
      {
        question: 'When does a bonnet look best in an outfit?',
        answer:
          'It looks best in minimalist sets where the bonnet is the primary visual accent.',
      },
      {
        question: 'What should I pair handmade bonnets with?',
        answer:
          'They are often styled with basic coats, trench coats, and plain knitwear.',
      },
      {
        question: 'Is a bonnet suitable for everyday wear?',
        answer:
          'Yes, if you choose a restrained palette that is easy to combine with outerwear.',
      },
      {
        question: 'Can bonnets be a gift option?',
        answer:
          'Yes, they are an original gift for people who value non-standard handmade accessories.',
      },
    ],
  },
}

function localizeShopCategoryConfig(
  config: ShopCategoryConfig,
  locale: Locale,
): ShopCategoryConfig {
  if (locale !== 'en') return config
  const localized = SHOP_CATEGORY_EN_CONTENT[config.slug]
  if (!localized) return config
  return { ...config, ...localized }
}

function localizeAccessorySubcategoryConfig(
  config: AccessorySubcategoryConfig,
  locale: Locale,
): AccessorySubcategoryConfig {
  if (locale !== 'en') return config
  const localized = ACCESSORY_SUBCATEGORY_EN_CONTENT[config.slug]
  if (!localized) return config
  return { ...config, ...localized }
}

const ACCESSORY_SUBCATEGORY_BY_SLUG = Object.fromEntries(
  ACCESSORY_SUBCATEGORIES.map((item) => [item.slug, item]),
) as Record<string, AccessorySubcategoryConfig>

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[`'’ʼ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function getShopCategoryConfig(slug: string): ShopCategoryConfig | null {
  return SHOP_CATEGORY_CONFIG[slug] ?? null
}

export function getLocalizedShopCategoryConfig(
  slug: string,
  locale: Locale,
): ShopCategoryConfig | null {
  const base = getShopCategoryConfig(slug)
  if (!base) return null
  return localizeShopCategoryConfig(base, locale)
}

export function getMainShopCategorySlugs(): string[] {
  return Object.values(SHOP_CATEGORY_CONFIG)
    .filter((item) => !item.redirectTo)
    .map((item) => item.slug)
}

export function getAccessorySubcategoryConfig(
  slug: string,
): AccessorySubcategoryConfig | null {
  return ACCESSORY_SUBCATEGORY_BY_SLUG[slug] ?? null
}

export function getLocalizedAccessorySubcategoryConfig(
  slug: string,
  locale: Locale,
): AccessorySubcategoryConfig | null {
  const base = getAccessorySubcategoryConfig(slug)
  if (!base) return null
  return localizeAccessorySubcategoryConfig(base, locale)
}

export function getLocalizedAccessorySubcategories(
  locale: Locale,
): AccessorySubcategoryConfig[] {
  if (locale !== 'en') return ACCESSORY_SUBCATEGORIES
  return ACCESSORY_SUBCATEGORIES.map((item) =>
    localizeAccessorySubcategoryConfig(item, locale),
  )
}

export function getAccessorySubcategorySlugs(): string[] {
  return ACCESSORY_SUBCATEGORIES.map((item) => item.slug)
}

export function matchAccessorySubcategory(
  product: { name: string; slug: string },
  subcategorySlug: string,
): boolean {
  const subcategory = getAccessorySubcategoryConfig(subcategorySlug)
  if (!subcategory) return true

  const haystack = normalizeText(`${product.name} ${product.slug}`)
  return subcategory.keywords.some((keyword) =>
    haystack.includes(normalizeText(keyword)),
  )
}
